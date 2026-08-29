import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CATALOG_CACHE_KEY,
  CATALOG_TTL_MS,
  CATALOG_URL,
  type FontEntry,
  clearCatalogCache,
  fetchCatalog,
  searchFonts,
  toFontEntry,
} from '@/fonts/catalog'
import { CURATED_FONTS } from '@/fonts/curated'

const RAW = [
  {
    id: 'noto-sans-sc',
    family: 'Noto Sans SC',
    category: 'sans-serif',
    subsets: ['chinese-simplified', 'latin'],
    weights: [400, 700],
    styles: ['normal'],
    variable: true,
    type: 'google',
  },
  {
    id: 'inter',
    family: 'Inter',
    category: 'sans-serif',
    subsets: ['latin'],
    weights: [400, 700],
    styles: ['normal'],
    variable: true,
    type: 'google',
  },
  {
    id: 'material-icons',
    family: 'Material Icons',
    category: 'icons',
    subsets: ['latin'],
    weights: [400],
    type: 'google',
  },
  {
    id: 'some-self-hosted',
    family: 'Some Self Hosted',
    category: 'serif',
    subsets: ['latin'],
    weights: [400],
    type: 'other',
  },
]

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

/**
 * vitest 跑在 Node 24 上时 globalThis.localStorage 被运行时自身的实验实现占位，
 * jsdom 的那份注入不进来，所以这里自备一个内存 Storage。
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

let store: Storage

function seedCache(at: number, fonts: FontEntry[]): void {
  store.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at, fonts }))
}

beforeEach(() => {
  store = memoryStorage()
  vi.stubGlobal('localStorage', store)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toFontEntry', () => {
  it('只保留需要的字段并派生 cjk', () => {
    expect(toFontEntry(RAW[0])).toEqual({
      id: 'noto-sans-sc',
      family: 'Noto Sans SC',
      category: 'sans-serif',
      subsets: ['chinese-simplified', 'latin'],
      weights: [400, 700],
      cjk: 'sc',
    })
  })

  it('丢弃图标字体、非 google 来源与残缺条目', () => {
    expect(toFontEntry(RAW[2])).toBeNull()
    expect(toFontEntry(RAW[3])).toBeNull()
    expect(toFontEntry({ family: 'No Id', type: 'google' })).toBeNull()
    expect(toFontEntry(null)).toBeNull()
  })

  it('weights 缺失时补 400', () => {
    expect(toFontEntry({ id: 'x', family: 'X', type: 'google', subsets: [] })?.weights).toEqual([
      400,
    ])
  })
})

describe('fetchCatalog', () => {
  it('缓存未过期时直接命中，不发请求', async () => {
    const cached: FontEntry[] = [
      { id: 'cached', family: 'Cached', category: 'serif', subsets: ['latin'], weights: [400] },
    ]
    seedCache(Date.now() - 1000, cached)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalog()).resolves.toEqual(cached)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('缓存过期后重新拉取并回写', async () => {
    seedCache(Date.now() - CATALOG_TTL_MS - 1, [
      { id: 'stale', family: 'Stale', category: 'serif', subsets: ['latin'], weights: [400] },
    ])
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => okResponse(RAW))
    vi.stubGlobal('fetch', fetchMock)

    const list = await fetchCatalog()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(CATALOG_URL)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(list.map((f) => f.id)).toEqual(['noto-sans-sc', 'inter'])

    const written = JSON.parse(store.getItem(CATALOG_CACHE_KEY) ?? '{}') as {
      at: number
      fonts: FontEntry[]
    }
    expect(written.fonts.map((f) => f.id)).toEqual(['noto-sans-sc', 'inter'])
    expect(Date.now() - written.at).toBeLessThan(CATALOG_TTL_MS)
  })

  it('force 时无视新鲜缓存', async () => {
    seedCache(Date.now(), [
      { id: 'cached', family: 'Cached', category: 'serif', subsets: ['latin'], weights: [400] },
    ])
    const fetchMock = vi.fn(async () => okResponse(RAW))
    vi.stubGlobal('fetch', fetchMock)

    await fetchCatalog({ force: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('请求失败且无缓存时回落精选清单', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(fetchCatalog()).resolves.toBe(CURATED_FONTS)
  })

  it('请求失败但有过期缓存时用过期缓存', async () => {
    const stale: FontEntry[] = [
      { id: 'stale', family: 'Stale', category: 'serif', subsets: ['latin'], weights: [400] },
    ]
    seedCache(Date.now() - CATALOG_TTL_MS - 1, stale)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 }) as unknown as Response),
    )
    await expect(fetchCatalog()).resolves.toEqual(stale)
  })

  it('缓存内容损坏时当作没有缓存', async () => {
    store.setItem(CATALOG_CACHE_KEY, '{ not json')
    const fetchMock = vi.fn(async () => okResponse(RAW))
    vi.stubGlobal('fetch', fetchMock)
    await fetchCatalog()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('并发调用共享同一次请求', async () => {
    const fetchMock = vi.fn(async () => okResponse(RAW))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([fetchCatalog(), fetchCatalog()])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(a).toEqual(b)
  })

  it('clearCatalogCache 清掉缓存键', () => {
    seedCache(Date.now(), [])
    clearCatalogCache()
    expect(store.getItem(CATALOG_CACHE_KEY)).toBeNull()
  })
})

describe('searchFonts', () => {
  const list: FontEntry[] = [
    { id: 'inter', family: 'Inter', category: 'sans-serif', subsets: ['latin'], weights: [400] },
    {
      id: 'noto-sans-sc',
      family: 'Noto Sans SC',
      category: 'sans-serif',
      subsets: ['chinese-simplified'],
      weights: [400],
      cjk: 'sc',
    },
    {
      id: 'noto-serif-tc',
      family: 'Noto Serif TC',
      category: 'serif',
      subsets: ['chinese-traditional'],
      weights: [400],
      cjk: 'tc',
    },
    {
      id: 'pacifico',
      family: 'Pacifico',
      category: 'handwriting',
      subsets: ['latin'],
      weights: [400],
    },
  ]

  it('空查询返回全部', () => {
    expect(searchFonts(list, '')).toHaveLength(4)
  })

  it('前缀命中排在中间命中之前', () => {
    const hits = searchFonts(list, 'noto')
    expect(hits.map((f) => f.id)).toEqual(['noto-sans-sc', 'noto-serif-tc'])
  })

  it('忽略空格与连字符也能命中', () => {
    expect(searchFonts(list, 'notosans').map((f) => f.id)).toEqual(['noto-sans-sc'])
  })

  it('按分类与脚本过滤', () => {
    expect(searchFonts(list, '', { category: 'handwriting' }).map((f) => f.id)).toEqual([
      'pacifico',
    ])
    expect(searchFonts(list, '', { cjk: 'sc' }).map((f) => f.id)).toEqual(['noto-sans-sc'])
    expect(searchFonts(list, '', { cjk: 'none' }).map((f) => f.id)).toEqual(['inter', 'pacifico'])
  })

  it('最近使用置顶并保序', () => {
    const hits = searchFonts(list, '', { recent: ['Pacifico', 'Noto Serif TC'] })
    expect(hits.slice(0, 2).map((f) => f.id)).toEqual(['pacifico', 'noto-serif-tc'])
  })

  it('limit 截断结果', () => {
    expect(searchFonts(list, '', { limit: 2 })).toHaveLength(2)
  })
})
