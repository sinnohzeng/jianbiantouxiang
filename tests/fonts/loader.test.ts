import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
import {
  DEFAULT_FONT_TIMEOUT_MS,
  fontFamilyCss,
  isFontReady,
  loadFontForConfig,
  nearestWeight,
  quoteFamily,
  resetFontLoaderState,
} from '@/fonts/loader'
import { clearUploadedFonts, registerUploadedFont } from '@/fonts/upload'

type Outcome = 'load' | 'error' | 'hang'

/** 每个 href 的模拟结果，默认挂起，测试按需覆盖。 */
let route: (href: string) => Outcome
let hrefs: string[]
let fontsLoad: ReturnType<typeof vi.fn>

function config(patch: Partial<AvatarConfig['typography']> = {}, text = 'AB'): AvatarConfig {
  return {
    ...DEFAULT_CONFIG,
    text,
    typography: { ...DEFAULT_CONFIG.typography, ...patch },
  }
}

beforeEach(() => {
  resetFontLoaderState()
  hrefs = []
  route = () => 'hang'
  fontsLoad = vi.fn(async () => [{}])

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
  clearUploadedFonts()
  resetFontLoaderState()
})

describe('quoteFamily', () => {
  it.each([
    ['Inter', 'Inter'],
    ['Noto Sans SC', '"Noto Sans SC"'],
    ['Sample-upload', 'Sample-upload'],
    ['', ''],
  ])('%s -> %s', (input, output) => {
    expect(quoteFamily(input)).toBe(output)
  })
})

describe('fontFamilyCss', () => {
  it('目标字体在最前，系统栈兜底', () => {
    const css = fontFamilyCss(config({ fontFamily: 'Noto Sans SC' }))
    expect(css.startsWith('"Noto Sans SC", ')).toBe(true)
    expect(css).toContain('system-ui')
    expect(css).toContain('sans-serif')
  })

  it('手写体补 cursive 泛型', () => {
    expect(fontFamilyCss(config({ fontFamily: 'Ma Shan Zheng' }))).toContain('cursive')
  })

  it('空 family 只留系统栈', () => {
    expect(fontFamilyCss(config({ fontFamily: '  ' }))).not.toContain('""')
  })
})

describe('nearestWeight', () => {
  it('取最接近的可用字重，等距时偏大', () => {
    expect(nearestWeight([400], 700)).toBe(400)
    expect(nearestWeight([300, 400, 700], 500)).toBe(400)
    expect(nearestWeight([300, 700], 500)).toBe(700)
    expect(nearestWeight([], 700)).toBe(700)
  })
})

describe('loadFontForConfig 非网络分支', () => {
  it('system 直接返回，不注入样式表', async () => {
    await expect(loadFontForConfig(config({ fontSource: 'system' }))).resolves.toEqual({
      family: DEFAULT_CONFIG.typography.fontFamily,
      source: 'system',
      ok: true,
    })
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
    await expect(
      loadFontForConfig(config({ fontSource: 'upload', fontFamily: family })),
    ).resolves.toEqual({ family, source: 'upload', ok: true })
    vi.unstubAllGlobals()
  })

  it('upload 未注册时回系统字体且 ok 为 false', async () => {
    await expect(
      loadFontForConfig(config({ fontSource: 'upload', fontFamily: 'Ghost-upload' })),
    ).resolves.toEqual({ family: 'Ghost-upload', source: 'system', ok: false })
  })
})

describe('loadFontForConfig 网络降级', () => {
  it('css2 成功时不碰镜像', async () => {
    route = (href) => (href.includes('fonts.googleapis.com') ? 'load' : 'error')
    const result = await loadFontForConfig(config({ fontFamily: 'Inter', fontWeight: 700 }))
    expect(result).toEqual({ family: 'Inter', source: 'google', ok: true })
    expect(hrefs).toHaveLength(1)
    expect(hrefs[0]).toContain('fonts.googleapis.com/css2')
    expect(isFontReady('Inter')).toBe(true)
  })

  it('探测样本取配置文字去重后的字符', async () => {
    route = () => 'load'
    await loadFontForConfig(config({ fontFamily: 'Inter' }, '猪猪家族'))
    expect(fontsLoad).toHaveBeenCalledWith('700 32px Inter', '猪家族')
  })

  it('css2 超时后依次切 cdn 与 gcore，顺序固定', async () => {
    route = (href) => (href.includes('gcore.jsdelivr.net') ? 'load' : 'hang')
    const result = await loadFontForConfig(
      config({ fontFamily: 'Noto Sans SC', fontWeight: 700 }),
      {
        timeoutMs: 20,
      },
    )
    expect(result).toEqual({ family: 'Noto Sans SC', source: 'mirror', ok: true })
    expect(hrefs).toEqual([
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&display=swap',
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@latest/700.css',
      'https://gcore.jsdelivr.net/npm/@fontsource/noto-sans-sc@latest/700.css',
    ])
  })

  it('第一个镜像可用时不再试第二个', async () => {
    route = (href) => (href.includes('cdn.jsdelivr.net') ? 'load' : 'hang')
    const result = await loadFontForConfig(
      config({ fontFamily: 'ZCOOL KuaiLe', fontWeight: 400 }),
      {
        timeoutMs: 20,
      },
    )
    expect(result.source).toBe('mirror')
    expect(hrefs).toHaveLength(2)
    expect(hrefs.some((h) => h.includes('gcore'))).toBe(false)
  })

  it('三档都失败时回系统字体', async () => {
    route = () => 'error'
    const result = await loadFontForConfig(config({ fontFamily: 'Inter' }), { timeoutMs: 20 })
    expect(result).toEqual({ family: 'Inter', source: 'system', ok: false })
    expect(hrefs).toHaveLength(3)
    expect(isFontReady('Inter')).toBe(false)
  })

  it('字重按字体实际提供的值夹取，避免 css2 返回 400', async () => {
    route = (href) => (href.includes('fonts.googleapis.com') ? 'load' : 'hang')
    await loadFontForConfig(config({ fontFamily: 'Bebas Neue', fontWeight: 700 }))
    expect(hrefs[0]).toContain('wght@400')
  })

  it('document.fonts 匹配不到字形时继续降级', async () => {
    fontsLoad.mockResolvedValue([])
    route = () => 'load'
    const result = await loadFontForConfig(config({ fontFamily: 'Inter' }), { timeoutMs: 20 })
    expect(result.ok).toBe(false)
    expect(hrefs).toHaveLength(3)
  })
})

describe('loadFontForConfig 去重', () => {
  it('并发调用共享同一个 Promise，只注入一次', async () => {
    route = () => 'load'
    const cfg = config({ fontFamily: 'Inter', fontWeight: 700 })
    const a = loadFontForConfig(cfg)
    const b = loadFontForConfig(cfg)
    expect(a).toBe(b)
    await Promise.all([a, b])
    expect(hrefs).toHaveLength(1)
  })

  it('成功后再调用走内存缓存', async () => {
    route = () => 'load'
    const cfg = config({ fontFamily: 'Inter', fontWeight: 700 })
    await loadFontForConfig(cfg)
    await loadFontForConfig(cfg)
    expect(hrefs).toHaveLength(1)
    expect(fontsLoad).toHaveBeenCalledOnce()
  })

  it('失败不写缓存，重试会重新注入', async () => {
    route = () => 'error'
    const cfg = config({ fontFamily: 'Inter' })
    await loadFontForConfig(cfg, { timeoutMs: 20 })
    const first = hrefs.length
    await loadFontForConfig(cfg, { timeoutMs: 20 })
    expect(hrefs.length).toBeGreaterThan(first)
  })
})

describe('默认超时', () => {
  it('对齐规约里的 4 秒', () => {
    expect(DEFAULT_FONT_TIMEOUT_MS).toBe(4000)
  })
})
