import { encodeCanvas, type EncodeOptions } from '@/export/encode'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeCanvas, opNames, type FakeCanvasRegistry } from './fake-canvas'

const ONE_MB = 1024 * 1024

interface ToBlobCall {
  canvas: HTMLCanvasElement
  type: string
  quality: number | undefined
}

let calls: ToBlobCall[] = []
let registry: FakeCanvasRegistry

/** 用体积模型替换真实编码：给定质量返回一个可预测的字节数。 */
function stubToBlob(sizeOf: (quality: number | undefined, type: string) => number): void {
  const impl = function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ): void {
    const mime = type ?? 'image/png'
    calls.push({ canvas: this, type: mime, quality })
    callback({ size: sizeOf(quality, mime), type: mime } as Blob)
  } as unknown as HTMLCanvasElement['toBlob']
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(impl)
}

function sourceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  return canvas
}

function options(partial: Partial<EncodeOptions> = {}): EncodeOptions {
  return { format: 'jpg', sizeTarget: '1mb', bgColor: '#ffffff', ...partial }
}

beforeEach(() => {
  calls = []
  registry = installFakeCanvas()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encodeCanvas PNG', () => {
  it('只编一次且不传质量', async () => {
    stubToBlob(() => 100)
    const result = await encodeCanvas(sourceCanvas(), options({ format: 'png' }))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('image/png')
    expect(calls[0]?.quality).toBeUndefined()
    expect(result.quality).toBe(1)
    expect(result.hitTarget).toBe(true)
  })

  it('超过目标体积既不二分也不报没达标：PNG 没有质量可压，体积档对它不适用', async () => {
    stubToBlob(() => 4 * ONE_MB)
    const result = await encodeCanvas(sourceCanvas(), options({ format: 'png' }))

    expect(calls).toHaveLength(1)
    // 报 false 会让导出面板弹出“压到质量下限仍超出目标体积”，而这个二分过程根本没发生
    expect(result.hitTarget).toBe(true)
  })

  it('不限制体积时恒为达标', async () => {
    stubToBlob(() => 9 * ONE_MB)
    const result = await encodeCanvas(
      sourceCanvas(),
      options({ format: 'png', sizeTarget: 'none' }),
    )

    expect(result.hitTarget).toBe(true)
  })
})

describe('encodeCanvas JPG', () => {
  it('不限制体积时按 spec §3.5 的质量 0.92 编一次', async () => {
    stubToBlob((q) => Math.round(3_000_000 * (q ?? 1)))
    const result = await encodeCanvas(sourceCanvas(), options({ sizeTarget: 'none' }))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('image/jpeg')
    expect(calls[0]?.quality).toBe(0.92)
    expect(result.quality).toBe(0.92)
    expect(result.hitTarget).toBe(true)
  })

  it('有体积目标时仍从默认质量 0.85 起编', async () => {
    stubToBlob((q) => Math.round(3_000_000 * (q ?? 1)))
    await encodeCanvas(sourceCanvas(), options({ sizeTarget: '2mb' }))

    expect(calls[0]?.quality).toBe(0.85)
  })

  it('编码前把透明区铺成底色', async () => {
    stubToBlob(() => 100)
    const source = sourceCanvas()
    await encodeCanvas(source, options({ sizeTarget: 'none', bgColor: '#ff0000' }))

    // 铺底色发生在一张新画布上，原画布不被改写
    expect(registry.entries).toHaveLength(1)
    expect(registry.entries[0]?.canvas).not.toBe(source)
    expect(opNames(registry.opsAt(0))).toEqual(['set:fillStyle', 'fillRect', 'drawImage'])
    expect(registry.opsAt(0)[0]?.args[0]).toBe('#ff0000')
    expect(calls[0]?.canvas).toBe(registry.entries[0]?.canvas)
  })

  it('超目标时二分质量并收敛到目标区间内', async () => {
    stubToBlob((q) => Math.round(1_500_000 * (q ?? 1)))
    const result = await encodeCanvas(sourceCanvas(), options())

    expect(result.hitTarget).toBe(true)
    expect(result.blob.size).toBeLessThanOrEqual(ONE_MB)
    expect(result.blob.size).toBeGreaterThanOrEqual(ONE_MB * 0.92)
    expect(result.quality).toBeGreaterThanOrEqual(0.6)
    expect(result.quality).toBeLessThanOrEqual(0.85)
    // 一次默认质量加上若干轮二分，总轮数不超过 1 + 6 + 1
    expect(calls.length).toBeGreaterThan(1)
    expect(calls.length).toBeLessThanOrEqual(8)
  })

  it('二分的质量始终落在 0.6 到 0.95 之间', async () => {
    stubToBlob((q) => Math.round(1_500_000 * (q ?? 1)))
    await encodeCanvas(sourceCanvas(), options())

    for (const call of calls) {
      expect(call.quality).toBeGreaterThanOrEqual(0.6)
      expect(call.quality).toBeLessThanOrEqual(0.95)
    }
  })

  it('只有质量下限能达标时，补一次下限编码', async () => {
    stubToBlob((q) => ((q ?? 1) <= 0.6 ? 900_000 : 2 * ONE_MB))
    const result = await encodeCanvas(sourceCanvas(), options())

    expect(result.quality).toBe(0.6)
    expect(result.hitTarget).toBe(true)
    expect(calls.at(-1)?.quality).toBe(0.6)
    expect(calls).toHaveLength(8)
  })

  it('目标不可达时返回下限质量并报告没达标', async () => {
    stubToBlob((q) => Math.round(5_000_000 * (q ?? 1)))
    const result = await encodeCanvas(sourceCanvas(), options())

    expect(result.hitTarget).toBe(false)
    expect(result.quality).toBe(0.6)
    expect(result.blob.size).toBeGreaterThan(ONE_MB)
  })

  it('2mb 档的目标是 2048 KB', async () => {
    stubToBlob((q) => Math.round(3_000_000 * (q ?? 1)))
    const result = await encodeCanvas(sourceCanvas(), options({ sizeTarget: '2mb' }))

    expect(result.hitTarget).toBe(true)
    expect(result.blob.size).toBeLessThanOrEqual(2048 * 1024)
  })
})

describe('encodeCanvas WebP', () => {
  it('不限制体积档也用 0.9，不跟着 JPG 抬到 0.92；且保留透明，不铺底色', async () => {
    stubToBlob(() => 100)
    const source = sourceCanvas()
    const result = await encodeCanvas(source, options({ format: 'webp', sizeTarget: 'none' }))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('image/webp')
    expect(calls[0]?.quality).toBe(0.9)
    expect(calls[0]?.canvas).toBe(source)
    expect(registry.entries).toHaveLength(0)
    expect(result.quality).toBe(0.9)
  })

  it('同样走体积二分', async () => {
    stubToBlob((q) => Math.round(1_500_000 * (q ?? 1)))
    const result = await encodeCanvas(sourceCanvas(), options({ format: 'webp' }))

    expect(calls.length).toBeGreaterThan(1)
    expect(result.blob.size).toBeLessThanOrEqual(ONE_MB)
  })
})

describe('supportsWebP', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('返回 image/webp 判为支持，且只探测一次', async () => {
    stubToBlob(() => 10)
    const { supportsWebP } = await import('@/export/encode')

    expect(await supportsWebP()).toBe(true)
    expect(await supportsWebP()).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('浏览器改吐 PNG 时判为不支持', async () => {
    const impl = function (this: HTMLCanvasElement, callback: BlobCallback): void {
      callback({ size: 10, type: 'image/png' } as Blob)
    } as unknown as HTMLCanvasElement['toBlob']
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(impl)
    const { supportsWebP } = await import('@/export/encode')

    expect(await supportsWebP()).toBe(false)
  })

  it('编码抛错时判为不支持', async () => {
    const impl = function (this: HTMLCanvasElement, callback: BlobCallback): void {
      callback(null)
    } as unknown as HTMLCanvasElement['toBlob']
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(impl)
    const { supportsWebP } = await import('@/export/encode')

    expect(await supportsWebP()).toBe(false)
  })
})
