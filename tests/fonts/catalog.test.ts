import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CATALOG_CACHE_KEY,
  CATALOG_TTL_MS,
  CATALOG_URL,
  FALLBACK_WEIGHTS,
  type FontEntry,
  clearCatalogCache,
  displayName,
  fetchCatalog,
  findFontEntry,
  langOfScript,
  nameLang,
  searchFonts,
  toFontEntry,
  weightsOf,
} from '@/fonts/catalog'
import { CURATED_FONTS } from '@/fonts/curated'
import { memoryStorage as store } from '../setup'

const RAW = [
  {
    id: 'noto-sans-sc',
    family: 'Noto Sans SC',
    category: 'sans-serif',
    subsets: ['chinese-simplified', 'latin'],
    weights: [400, 700],
    styles: ['normal'],
    variable: true,
    version: '5.3.0',
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

function seedCache(at: number, fonts: FontEntry[]): void {
  store.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at, fonts }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearCatalogCache()
})

describe('toFontEntry', () => {
  it('只保留需要的字段并派生 cjk', () => {
    expect(toFontEntry(RAW[0])).toEqual({
      id: 'noto-sans-sc',
      family: 'Noto Sans SC',
      weights: [400, 700],
      version: '5.3.0',
      cjk: 'sc',
    })
  })

  it('丢弃图标字体、非 google 来源与残缺条目', () => {
    expect(toFontEntry(RAW[2])).toBeNull()
    expect(toFontEntry(RAW[3])).toBeNull()
    expect(toFontEntry({ family: 'No Id', type: 'google' })).toBeNull()
    expect(toFontEntry(null)).toBeNull()
  })

  it('字重只收九档，其余丢弃', () => {
    expect(
      toFontEntry({ id: 'x', family: 'X', type: 'google', weights: [950, 700, '400', 450, 1] })
        ?.weights,
    ).toEqual([400, 700])
    expect(toFontEntry({ id: 'x', family: 'X', type: 'google', weights: [950] })?.weights).toEqual([
      400,
    ])
  })

  it('weights 缺失时补 400', () => {
    expect(toFontEntry({ id: 'x', family: 'X', type: 'google', subsets: [] })?.weights).toEqual([
      400,
    ])
  })
})

describe('fetchCatalog', () => {
  it('缓存未过期时直接命中，不发请求', async () => {
    const cached: FontEntry[] = [{ id: 'cached', family: 'Cached', weights: [400] }]
    seedCache(Date.now() - 1000, cached)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalog()).resolves.toEqual(cached)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('缓存过期后重新拉取并回写', async () => {
    seedCache(Date.now() - CATALOG_TTL_MS - 1, [{ id: 'stale', family: 'Stale', weights: [400] }])
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
    seedCache(Date.now(), [{ id: 'cached', family: 'Cached', weights: [400] }])
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
    const stale: FontEntry[] = [{ id: 'stale', family: 'Stale', weights: [400] }]
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
    { id: 'inter', family: 'Inter', weights: [400] },
    {
      id: 'noto-sans-sc',
      family: 'Noto Sans SC',
      weights: [400],
      cjk: 'sc',
    },
    {
      id: 'noto-serif-tc',
      family: 'Noto Serif TC',
      weights: [400],
      cjk: 'tc',
    },
    {
      id: 'pacifico',
      family: 'Pacifico',
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

  it('按脚本过滤', () => {
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

  it('cjk 给一组脚本时收其中任一种', () => {
    expect(searchFonts(list, '', { cjk: ['tc', 'hk'] }).map((f) => f.id)).toEqual(['noto-serif-tc'])
    expect(searchFonts(list, '', { cjk: ['sc', 'tc'] }).map((f) => f.id)).toEqual([
      'noto-sans-sc',
      'noto-serif-tc',
    ])
  })

  it('keepOrder 在空查询时保持原序，有查询时照常按命中强度排', () => {
    const reversed = [...list].reverse()
    expect(searchFonts(reversed, '', { keepOrder: true }).map((f) => f.id)).toEqual([
      'pacifico',
      'noto-serif-tc',
      'noto-sans-sc',
      'inter',
    ])
    expect(searchFonts(reversed, 'noto', { keepOrder: true }).map((f) => f.id)).toEqual([
      'noto-sans-sc',
      'noto-serif-tc',
    ])
  })
})

describe('findFontEntry', () => {
  it('精选清单按 family 命中，不看大小写与首尾空白', () => {
    expect(findFontEntry('  noto sans sc  ')?.id).toBe('noto-sans-sc')
    expect(findFontEntry('ZCOOL KUAILE')?.id).toBe('zcool-kuaile')
  })

  it('精选清单之外查本地目录缓存，过期也照样命中', () => {
    seedCache(Date.now() - CATALOG_TTL_MS * 5, [
      { id: 'cached-sans', family: 'Cached Sans', weights: [300, 500] },
    ])
    expect(findFontEntry('cached sans')?.id).toBe('cached-sans')
  })

  it('fetchCatalog 拉到新目录后查找随之更新', async () => {
    const fresh = { id: 'fresh-sans', family: 'Fresh Sans', weights: [400], type: 'google' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse([fresh])),
    )
    expect(findFontEntry('Fresh Sans')).toBeUndefined()
    await fetchCatalog({ force: true })
    expect(findFontEntry('fresh sans')?.id).toBe('fresh-sans')
  })

  it('哪里都没有时返回 undefined', () => {
    expect(findFontEntry('Nonexistent Font')).toBeUndefined()
  })
})

describe('weightsOf', () => {
  it('查到条目时给它的字重表', () => {
    expect(weightsOf('Bebas Neue')).toEqual([400])
  })

  it('未知 family 给通用档位', () => {
    expect(weightsOf('Nonexistent Font')).toBe(FALLBACK_WEIGHTS)
  })
})

describe('displayName', () => {
  it('上传字体去掉命名空间后缀，名字里的中文照原样', () => {
    expect(displayName('My Font-upload', 'upload')).toBe('My Font')
    expect(displayName('站酷快乐体-upload', 'upload')).toBe('站酷快乐体')
  })

  it('Google 字体有原生名写原生名，没有的写 family', () => {
    expect(displayName('ZCOOL KuaiLe', 'google')).toBe('站酷快乐体')
    expect(displayName('Inter', 'google')).toBe('Inter')
    expect(displayName('Tail-upload', 'google')).toBe('Tail-upload')
  })

  it('系统字体写本地化名', () => {
    expect(displayName('PingFang SC', 'system')).toBe('苹方-简')
    expect(displayName('Hiragino Sans', 'system')).toBe('ヒラギノ角ゴシック')
    expect(displayName('system-ui', 'system')).toBe('system-ui')
  })

  it('原型链上的键不当成原生名', () => {
    expect(displayName('constructor', 'google')).toBe('constructor')
  })
})

describe('按原生名搜索', () => {
  const list = [
    toFontEntry({
      id: 'zcool-kuaile',
      family: 'ZCOOL KuaiLe',
      category: 'display',
      subsets: ['chinese-simplified', 'latin'],
      weights: [400],
      type: 'google',
    }),
    toFontEntry(RAW[1]),
  ].filter((entry): entry is FontEntry => entry !== null)

  it('原生名的前缀与片段都能命中，西文 family 照样能搜', () => {
    expect(searchFonts(list, '站酷').map((f) => f.id)).toEqual(['zcool-kuaile'])
    expect(searchFonts(list, '快乐').map((f) => f.id)).toEqual(['zcool-kuaile'])
    expect(searchFonts(list, 'kuaile').map((f) => f.id)).toEqual(['zcool-kuaile'])
  })
})

describe('langOfScript 与 nameLang', () => {
  it('五种书写系统各有语言标签', () => {
    expect(langOfScript('sc')).toBe('zh-Hans')
    expect(langOfScript('tc')).toBe('zh-Hant')
    expect(langOfScript('hk')).toBe('zh-HK')
    expect(langOfScript('jp')).toBe('ja')
    expect(langOfScript('kr')).toBe('ko')
  })

  it('原生名按书写系统标，西文 family 标 en，上传字体不标', () => {
    expect(nameLang('ZCOOL KuaiLe', 'google')).toBe('zh-Hans')
    expect(nameLang('Chiron Sung HK', 'google')).toBe('zh-HK')
    expect(nameLang('Jua', 'google')).toBe('ko')
    expect(nameLang('Apple SD Gothic Neo', 'system')).toBe('ko')
    expect(nameLang('Noto Sans SC', 'google')).toBe('en')
    expect(nameLang('system-ui', 'system')).toBe('en')
    expect(nameLang('Brush-upload', 'upload')).toBeUndefined()
  })
})
