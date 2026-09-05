/**
 * 内置品牌图形的加载四态：SVG 成功、PNG 成功、取不到回 null、同一 id 只加载一次。
 *
 * 模块级缓存是按文件生存的，每个用例先 resetModules 再动态 import，拿一份干净的缓存。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>'

/** 会真的触发 onload 的假 Image；naturalWidth 为 0 时走 brand.ts 的兜底尺寸。 */
class FakeImage {
  static loaded: string[] = []
  static fail = false
  decoding = 'async'
  naturalWidth = 128
  naturalHeight = 96
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(value: string) {
    FakeImage.loaded.push(value)
    queueMicrotask(() => {
      if (FakeImage.fail) this.onerror?.()
      else this.onload?.()
    })
  }
}

// jsdom 没有 Blob URL，这里只换掉两个静态方法，URL 构造器留着别动
const realCreateObjectURL = URL.createObjectURL
const realRevokeObjectURL = URL.revokeObjectURL

function stubImage(): void {
  FakeImage.loaded = []
  FakeImage.fail = false
  vi.stubGlobal('Image', FakeImage)
  URL.createObjectURL = () => 'blob:brand'
  URL.revokeObjectURL = () => {}
}

async function brandModule() {
  vi.resetModules()
  return await import('@/graphics/brand')
}

beforeEach(() => {
  stubImage()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  URL.createObjectURL = realCreateObjectURL
  URL.revokeObjectURL = realRevokeObjectURL
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('品牌图形加载', () => {
  it('SVG 条目走 fetch 消毒再转 Image，尺寸取图片原生尺寸', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SVG })
    vi.stubGlobal('fetch', fetchMock)

    const { loadBrandGraphic } = await brandModule()
    const graphic = await loadBrandGraphic('github')

    expect(fetchMock).toHaveBeenCalledWith('/brand/github.svg')
    expect(graphic).not.toBeNull()
    expect(graphic?.kind).toBe('image')
    expect(graphic?.width).toBe(128)
    expect(graphic?.height).toBe(96)
    expect(FakeImage.loaded).toEqual(['blob:brand'])
  })

  it('PNG 条目直接给 Image，不发 fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { loadBrandGraphic } = await brandModule()
    const graphic = await loadBrandGraphic('doubao-work')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(graphic?.kind).toBe('image')
    expect(FakeImage.loaded).toEqual(['/brand/doubao-work.png'])
  })

  it('纯白变体也认，按 SVG 取', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SVG })
    vi.stubGlobal('fetch', fetchMock)

    const { loadBrandGraphic } = await brandModule()
    await loadBrandGraphic('github-light')

    expect(fetchMock).toHaveBeenCalledWith('/brand/github-light.svg')
  })

  it('404 回 null，只 warn 不抛', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const { loadBrandGraphic } = await brandModule()

    await expect(loadBrandGraphic('github')).resolves.toBeNull()
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('索引里没有的 id 回 null，不打网络', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { loadBrandGraphic } = await brandModule()

    await expect(loadBrandGraphic('../secret')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('同一个 id 第二次命中缓存，fetch 只发一次', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => SVG })
    vi.stubGlobal('fetch', fetchMock)

    const { loadBrandGraphic } = await brandModule()
    const first = await loadBrandGraphic('lark')
    const second = await loadBrandGraphic('lark')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })
})
