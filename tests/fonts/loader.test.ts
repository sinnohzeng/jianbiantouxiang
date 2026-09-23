import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CATALOG_CACHE_KEY, CATALOG_URL, clearCatalogCache } from '@/fonts/catalog'
import { fontString } from '@/fonts/family'
import {
  DEFAULT_FONT_TIMEOUT_MS,
  fontJobs,
  loadFontsForConfig,
  resetFontLoaderState,
  topUpGlyphs,
} from '@/fonts/loader'
import { clearUploadedFonts, registerUploadedFont } from '@/fonts/upload'
import { normalizeConfig, type AvatarConfig, type FontChoice } from '@/state/config'

type Outcome = 'load' | 'error' | 'hang'

/** 每个 href 的模拟结果，默认挂起，测试按需覆盖。 */
let route: (href: string) => Outcome
let hrefs: string[]
let fontsLoad: ReturnType<typeof vi.fn>
let fetchSpy: ReturnType<typeof vi.fn>

const INTER: FontChoice = { family: 'Inter', source: 'google', weight: 700 }
const KUAILE: FontChoice = { family: 'ZCOOL KuaiLe', source: 'google', weight: 400 }
/** document.fonts.load 收到的简写：探测字号 32px，带完整家族链。 */
const INTER_PROBE = fontString(INTER, 32)

function config(
  line1: Partial<FontChoice> = {},
  text = 'AB',
  line2: FontChoice | null = null,
): AvatarConfig {
  return normalizeConfig({
    text,
    typography: { line1: { font: { ...INTER, ...line1 } }, line2: { font: line2 } },
  })
}

/** 单字体配置只有一条结果，取出来断言。 */
async function loadOne(cfg: AvatarConfig, opts?: { timeoutMs?: number }) {
  const [result] = await loadFontsForConfig(cfg, opts)
  return result
}

function catalogFetched(): boolean {
  return fetchSpy.mock.calls.some((call) => String(call[0]) === CATALOG_URL)
}

beforeEach(() => {
  resetFontLoaderState()
  clearCatalogCache()
  hrefs = []
  route = () => 'hang'
  fontsLoad = vi.fn(async () => [{}])
  fetchSpy = vi.fn(async () => new Response('[]'))
  vi.stubGlobal('fetch', fetchSpy)

  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: fontsLoad, add: vi.fn(), delete: vi.fn() },
  })

  // 不真的挂进 DOM，避免 jsdom 去请求外链；按 route 决定派发哪个事件
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    const link = node as unknown as HTMLLinkElement
    hrefs.push(link.href)
    const outcome = route(link.href)
    if (outcome !== 'hang') {
      queueMicrotask(() => link.dispatchEvent(new Event(outcome)))
    }
    return node
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearUploadedFonts()
  resetFontLoaderState()
  clearCatalogCache()
})

describe('fontJobs', () => {
  it('两行同一款字体时合并成一条，文字拼在一起', () => {
    expect(fontJobs(config({}, '飞书\n先锋'))).toEqual([{ font: INTER, text: '飞书先锋' }])
  })

  it('两行字体不同时各一条', () => {
    expect(fontJobs(config({}, '飞书\n先锋', KUAILE))).toEqual([
      { font: INTER, text: '飞书' },
      { font: KUAILE, text: '先锋' },
    ])
  })

  it('第二行钉了别款字体但没有文字时只有第一行', () => {
    expect(fontJobs(config({}, '飞书', KUAILE))).toEqual([{ font: INTER, text: '飞书' }])
  })

  it('第一行为空时只加载第二行的生效字体', () => {
    expect(fontJobs(config({}, '\n说明', KUAILE))).toEqual([{ font: KUAILE, text: '说明' }])
  })

  it('两行都空时给第一行字体，文字留空', () => {
    expect(fontJobs(config({}, '', KUAILE))).toEqual([{ font: INTER, text: '' }])
  })
})

describe('loadFontsForConfig 非网络分支', () => {
  it('system 直接返回，不注入样式表', async () => {
    const font: FontChoice = { family: 'PingFang SC', source: 'system', weight: 700 }
    await expect(loadOne(config(font))).resolves.toEqual({ font, via: 'system', ok: true })
    expect(hrefs).toHaveLength(0)
  })

  it('upload 命中已注册的 family', async () => {
    vi.stubGlobal(
      'FontFace',
      class {
        load(): Promise<void> {
          return Promise.resolve()
        }
      },
    )
    const file = new File([new Uint8Array(8)], 'Sample.ttf')
    const { family } = await registerUploadedFont(file)
    const font: FontChoice = { family, source: 'upload', weight: 700 }
    await expect(loadOne(config(font))).resolves.toEqual({ font, via: 'upload', ok: true })
  })

  it('upload 未注册时回系统字体且 ok 为 false', async () => {
    const font: FontChoice = { family: 'Ghost-upload', source: 'upload', weight: 700 }
    await expect(loadOne(config(font))).resolves.toEqual({ font, via: 'system', ok: false })
  })
})

describe('loadFontsForConfig 网络降级', () => {
  it('css2 成功时不碰镜像', async () => {
    route = (href) => (href.includes('fonts.googleapis.com') ? 'load' : 'error')
    await expect(loadOne(config())).resolves.toEqual({ font: INTER, via: 'google', ok: true })
    expect(hrefs).toHaveLength(1)
    expect(hrefs[0]).toContain('fonts.googleapis.com/css2')
  })

  it('探测样本取文字去重后的字符，简写带完整家族链', async () => {
    route = () => 'load'
    await loadOne(config({}, '猪猪家族'))
    expect(fontsLoad).toHaveBeenCalledWith(INTER_PROBE, '猪家族')
  })

  it('css2 超时后依次切 cdn 与 fastly，顺序固定', async () => {
    route = (href) => (href.includes('fastly.jsdelivr.net') ? 'load' : 'hang')
    const font: FontChoice = { family: 'Noto Sans SC', source: 'google', weight: 700 }
    const result = await loadOne(config(font), { timeoutMs: 20 })
    expect(result).toEqual({ font, via: 'mirror', ok: true })
    expect(hrefs).toEqual([
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&display=swap',
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.0/700.css',
      'https://fastly.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.0/700.css',
    ])
  })

  it('第一个镜像可用时不再试第二个', async () => {
    route = (href) => (href.includes('cdn.jsdelivr.net') ? 'load' : 'hang')
    const result = await loadOne(config(KUAILE), { timeoutMs: 20 })
    expect(result?.via).toBe('mirror')
    expect(hrefs).toHaveLength(2)
    expect(hrefs.some((h) => h.includes('fastly'))).toBe(false)
  })

  it('三档都失败时回系统字体', async () => {
    route = () => 'error'
    const result = await loadOne(config(), { timeoutMs: 20 })
    expect(result).toEqual({ font: INTER, via: 'system', ok: false })
    expect(hrefs).toHaveLength(3)
  })

  it('字重按字体实际提供的值夹取，避免 css2 返回 400', async () => {
    route = (href) => (href.includes('fonts.googleapis.com') ? 'load' : 'hang')
    await loadOne(config({ family: 'Bebas Neue', weight: 700 }))
    expect(hrefs[0]).toContain('wght@400')
  })

  it('document.fonts 匹配不到字形时继续降级', async () => {
    fontsLoad.mockResolvedValue([])
    route = () => 'load'
    const result = await loadOne(config(), { timeoutMs: 20 })
    expect(result?.ok).toBe(false)
    expect(hrefs).toHaveLength(3)
  })
})

describe('loadFontsForConfig 按行加载', () => {
  it('两行同一款字体只请求一次，只有一条结果', async () => {
    route = () => 'load'
    const results = await loadFontsForConfig(config({}, '飞书\n先锋'))
    expect(results).toEqual([{ font: INTER, via: 'google', ok: true }])
    expect(hrefs).toHaveLength(1)
  })

  it('两行字体不同时并行加载，各一条结果', async () => {
    route = () => 'load'
    const pending = loadFontsForConfig(config({}, '飞书\n先锋', KUAILE))
    // 两款的 css2 在同一轮里注入，不等前一款加载完
    expect(hrefs).toHaveLength(2)
    expect(hrefs[1]).toContain('family=ZCOOL+KuaiLe:wght@400')
    await expect(pending).resolves.toEqual([
      { font: INTER, via: 'google', ok: true },
      { font: KUAILE, via: 'google', ok: true },
    ])
  })
})

describe('目录条目同步查找', () => {
  const DAY = 24 * 60 * 60 * 1000

  it('精选清单命中时用精选的 id 与版本，不请求目录接口', async () => {
    route = (href) => (href.includes('cdn.jsdelivr.net') ? 'load' : 'hang')
    await loadOne(config(KUAILE), { timeoutMs: 20 })
    expect(hrefs[1]).toMatch(/\/@fontsource\/zcool-kuaile@\d+\.\d+\.\d+\/400\.css$/)
    expect(catalogFetched()).toBe(false)
  })

  it('本地目录缓存过期 30 天也照样命中', async () => {
    localStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({
        at: Date.now() - 30 * DAY,
        fonts: [{ id: 'cached-sans', family: 'Cached Sans', weights: [400], version: '1.2.3' }],
      }),
    )
    route = (href) => (href.includes('cdn.jsdelivr.net') ? 'load' : 'hang')
    await loadOne(config({ family: 'cached sans', weight: 700 }), { timeoutMs: 20 })
    expect(hrefs[0]).toContain('wght@400')
    expect(hrefs[1]).toBe('https://cdn.jsdelivr.net/npm/@fontsource/cached-sans@1.2.3/400.css')
    expect(catalogFetched()).toBe(false)
  })

  it('精选与缓存都不中时按 family 猜 id，字重原样请求', async () => {
    route = (href) => (href.includes('cdn.jsdelivr.net') ? 'load' : 'hang')
    await loadOne(config({ family: 'Unknown Display', weight: 700 }), { timeoutMs: 20 })
    expect(hrefs[1]).toBe('https://cdn.jsdelivr.net/npm/@fontsource/unknown-display@latest/700.css')
    expect(catalogFetched()).toBe(false)
  })
})

describe('loadFontsForConfig 去重与补字', () => {
  it('并发调用共享同一次网络加载，只注入一次', async () => {
    route = () => 'load'
    const cfg = config()
    const [a, b] = await Promise.all([loadOne(cfg), loadOne(cfg)])
    expect(a).toEqual(b)
    expect(hrefs).toHaveLength(1)
    expect(fontsLoad).toHaveBeenCalledOnce()
  })

  it('并发调用文字不同时，各自补齐自己的新字', async () => {
    route = () => 'load'
    await Promise.all([loadOne(config({}, 'AB')), loadOne(config({}, '中'))])
    expect(hrefs).toHaveLength(1)
    expect(fontsLoad.mock.calls.map((call) => call[1])).toEqual(['AB', '中'])
  })

  it('字重不同是另一款字体，各自加载', async () => {
    route = () => 'load'
    await loadOne(config())
    await loadOne(config({ weight: 400 }))
    expect(hrefs).toHaveLength(2)
  })

  it('成功后再调用走内存缓存', async () => {
    route = () => 'load'
    await loadOne(config())
    await loadOne(config())
    expect(hrefs).toHaveLength(1)
    expect(fontsLoad).toHaveBeenCalledOnce()
  })

  it('缓存命中后遇到新字仍补一次 load，只补差集', async () => {
    route = () => 'load'
    await loadOne(config({}, 'AB'))
    expect(fontsLoad).toHaveBeenCalledOnce()

    await loadOne(config({}, 'A B 中文'))
    expect(hrefs).toHaveLength(1)
    expect(fontsLoad).toHaveBeenCalledTimes(2)
    expect(fontsLoad.mock.calls[1]).toEqual([INTER_PROBE, '中文'])

    // 补过的字进了账，同一段文字不再重复 load
    await loadOne(config({}, '中文AB'))
    expect(fontsLoad).toHaveBeenCalledTimes(2)
  })

  it('首次探测被 64 字上限截断时，剩下的字随后补齐', async () => {
    route = () => 'load'
    const text = Array.from({ length: 80 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('')
    await loadOne(config({}, text))
    expect(fontsLoad).toHaveBeenCalledTimes(2)
    expect(fontsLoad.mock.calls[0]?.[1]).toBe(text.slice(0, 64))
    expect(fontsLoad.mock.calls[1]?.[1]).toBe(text.slice(64))
  })

  it('补拉超时不记账，下次调用还会重试', async () => {
    route = () => 'load'
    await loadOne(config({}, 'AB'))

    fontsLoad.mockImplementation(() => new Promise(() => {}))
    const cfg = config({}, 'AB中')
    await expect(loadOne(cfg, { timeoutMs: 20 })).resolves.toMatchObject({ ok: true })
    expect(fontsLoad).toHaveBeenCalledTimes(2)

    fontsLoad.mockImplementation(async () => [{}])
    await loadOne(cfg, { timeoutMs: 20 })
    expect(fontsLoad).toHaveBeenCalledTimes(3)
    expect(fontsLoad.mock.calls[2]).toEqual([INTER_PROBE, '中'])
  })

  it('加载失败回系统字体时不补拉', async () => {
    route = () => 'error'
    await loadOne(config({}, 'AB'), { timeoutMs: 20 })
    expect(fontsLoad).not.toHaveBeenCalled()
  })

  it('失败不写缓存，重试会重新注入', async () => {
    route = () => 'error'
    await loadOne(config(), { timeoutMs: 20 })
    const first = hrefs.length
    await loadOne(config(), { timeoutMs: 20 })
    expect(hrefs.length).toBeGreaterThan(first)
  })
})

describe('topUpGlyphs', () => {
  it('没加载过或加载失败的字体不发 load', async () => {
    await expect(topUpGlyphs(config({}, '中文'))).resolves.toBe(false)
    expect(fontsLoad).not.toHaveBeenCalled()

    route = () => 'error'
    await loadOne(config({}, 'AB'), { timeoutMs: 20 })
    await expect(topUpGlyphs(config({}, 'AB中'))).resolves.toBe(false)
    expect(fontsLoad).not.toHaveBeenCalled()
  })

  it('已就绪的字体只补新字，补到新字才返回 true', async () => {
    route = () => 'load'
    await loadOne(config({}, 'AB'))
    expect(fontsLoad).toHaveBeenCalledOnce()

    await expect(topUpGlyphs(config({}, 'AB'))).resolves.toBe(false)
    expect(fontsLoad).toHaveBeenCalledOnce()

    await expect(topUpGlyphs(config({}, 'AB中'))).resolves.toBe(true)
    expect(fontsLoad.mock.calls[1]).toEqual([INTER_PROBE, '中'])
  })

  it('按行补：第二行的新字补给第二行的字体', async () => {
    route = () => 'load'
    await loadFontsForConfig(config({}, 'AB\nCD', KUAILE))
    fontsLoad.mockClear()

    await expect(topUpGlyphs(config({}, 'AB\nCD中', KUAILE))).resolves.toBe(true)
    expect(fontsLoad.mock.calls).toEqual([[fontString(KUAILE, 32), '中']])
  })
})

describe('默认超时', () => {
  it('对齐规约里的 4 秒', () => {
    expect(DEFAULT_FONT_TIMEOUT_MS).toBe(4000)
  })
})
