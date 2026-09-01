import { composeWith, type ComposeDeps } from '@/export/compose-core'
import type { Graphic } from '@/graphics/types'
import type { Rect } from '@/text/layout'
import { normalizeConfig, type AvatarConfig, type PartialConfig } from '@/state/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  indexOfOp,
  installFakeCanvas,
  opNames,
  type FakeCanvasRegistry,
  type Op,
} from './fake-canvas'

/** 排版结果在合成里是不透明的，用一个标记对象就够断言传递链路。 */
const LAYOUT = { marker: 'layout', graphic: undefined }

interface Harness {
  deps: ComposeDeps<typeof LAYOUT>
  order: string[]
  gradient: HTMLCanvasElement
  drawText: ReturnType<typeof vi.fn>
  resolveInk: ReturnType<typeof vi.fn>
  layoutText: ReturnType<typeof vi.fn>
  drawHighlight: ReturnType<typeof vi.fn>
  drawGraphic: ReturnType<typeof vi.fn>
  loadGraphicForConfig: ReturnType<typeof vi.fn>
}

function makeHarness(plate = false): Harness {
  const order: string[] = []
  // 渐变画布只被 drawImage 与释放动到，用一个最小的替身即可
  const gradient = { width: 2048, height: 2048 } as HTMLCanvasElement

  const drawHighlight = vi.fn(() => {
    order.push('drawHighlight')
  })
  const drawGraphic = vi.fn(() => {
    order.push('drawGraphic')
  })
  const layoutText = vi.fn(() => {
    order.push('layoutText')
    return LAYOUT
  })
  const loadGraphicForConfig = vi.fn(async () => {
    order.push('loadGraphicForConfig')
    return null
  })
  // 真实现自己处理 custom：颜色直接用配置里的，也不判底板，替身照这个口径来
  const resolveInk = vi.fn((_ctx: unknown, _layout: unknown, config: AvatarConfig) => {
    order.push('resolveInk')
    return config.typography.colorMode === 'custom'
      ? { color: config.typography.color, plate: false }
      : { color: '#123456', plate }
  })
  const drawText = vi.fn(() => {
    order.push('drawText')
  })

  const deps: ComposeDeps<typeof LAYOUT> = {
    loadFontForConfig: vi.fn(async () => {
      order.push('loadFontForConfig')
      return { family: 'Noto Sans SC', source: 'google', ok: true }
    }),
    loadGraphicForConfig,
    renderGradient: vi.fn(async () => {
      order.push('renderGradient')
      return gradient
    }),
    drawHighlight,
    drawGraphic,
    layoutText,
    resolveInk,
    drawText,
  }

  return {
    deps,
    order,
    gradient,
    drawText,
    resolveInk,
    layoutText,
    drawHighlight,
    drawGraphic,
    loadGraphicForConfig,
  }
}

function configOf(partial: PartialConfig = {}): AvatarConfig {
  return normalizeConfig({ text: '猪猪家族', ...partial })
}

let registry: FakeCanvasRegistry

beforeEach(() => {
  registry = installFakeCanvas()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function opsOfOutput(): Op[] {
  return registry.opsAt(0)
}

describe('composeWith 流程', () => {
  it('按 字体 → 渐变 → 高光 → 排版 → 取色 → 绘字 的顺序调用依赖', async () => {
    const h = makeHarness()
    await composeWith(configOf(), 512, 512, h.deps)

    expect(h.order).toEqual([
      'loadGraphicForConfig',
      'loadFontForConfig',
      'renderGradient',
      'drawHighlight',
      'layoutText',
      'resolveInk',
      'drawText',
    ])
  })

  it('返回按请求尺寸新建的画布', async () => {
    const h = makeHarness()
    const canvas = await composeWith(configOf(), 640, 480, h.deps)

    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
  })

  it('先铺底色再画渐变', async () => {
    const h = makeHarness()
    await composeWith(configOf({ exportOptions: { bgColor: '#ff0000' } }), 512, 512, h.deps)

    const ops = opsOfOutput()
    expect(opNames(ops).slice(0, 3)).toEqual(['set:fillStyle', 'fillRect', 'drawImage'])
    expect(ops[0]?.args[0]).toBe('#ff0000')
    expect(ops[2]?.args[0]).toBe(h.gradient)
    expect(ops[2]?.args.slice(1)).toEqual([0, 0, 512, 512])
  })

  it('画完就把渐变中间画布缩到 1×1 释放', async () => {
    const h = makeHarness()
    await composeWith(configOf(), 512, 512, h.deps)

    expect(h.gradient.width).toBe(1)
    expect(h.gradient.height).toBe(1)
  })

  it('高光强度与种子透传，种子为空时用文字', async () => {
    const h = makeHarness()
    await composeWith(configOf({ highlight: 0.4, seed: '' }), 512, 256, h.deps)

    expect(h.drawHighlight).toHaveBeenCalledWith(expect.anything(), 512, 256, 0.4, '猪猪家族')
  })

  it('显式种子优先于文字', async () => {
    const h = makeHarness()
    await composeWith(configOf({ seed: 'abc123' }), 512, 512, h.deps)

    expect(h.drawHighlight.mock.calls[0]?.[4]).toBe('abc123')
  })
})

describe('composeWith 文字', () => {
  it('自动色把排版结果交给取色，再把颜色交给绘字', async () => {
    const h = makeHarness()
    const config = configOf({ typography: { colorMode: 'auto' } })
    await composeWith(config, 512, 512, h.deps)

    expect(h.resolveInk).toHaveBeenCalledWith(expect.anything(), LAYOUT, config)
    expect(h.drawText).toHaveBeenCalledWith(expect.anything(), LAYOUT, config, '#123456')
  })

  it('取色只调一次，颜色与底板出自同一次采样', async () => {
    const h = makeHarness(true)
    await composeWith(configOf(), 512, 512, h.deps)

    expect(h.resolveInk).toHaveBeenCalledTimes(1)
  })

  it('自定义色直接用配置里的颜色', async () => {
    const h = makeHarness()
    await composeWith(
      configOf({ typography: { colorMode: 'custom', color: '#0a0a0a' } }),
      512,
      512,
      h.deps,
    )

    expect(h.drawText.mock.calls[0]?.[3]).toBe('#0a0a0a')
  })

  it('图标徽章把图形矩形交给 drawGraphic，颜色来自同一次取色', async () => {
    const h = makeHarness(true)
    const image = { width: 128, height: 128 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 128, height: 128 }
    const rect: Rect = { x: 10, y: 20, width: 100, height: 80 }
    h.loadGraphicForConfig.mockResolvedValue(graphic)
    h.layoutText.mockReturnValue({ ...LAYOUT, graphic: rect })
    const config = configOf({
      text: '产品设计部',
      typography: { colorMode: 'auto' },
      layout: { icon: { source: 'builtin', id: 'tree-palm' } },
    })

    await composeWith(config, 512, 512, h.deps)

    // 这条用例盯消费端：删掉 composeWith 里的 drawGraphic 调用它必须变红，
    // 不是只断言排版产物里有 graphic 字段。
    expect(h.drawGraphic).toHaveBeenCalledTimes(1)
    expect(h.drawGraphic.mock.calls[0]?.[1]).toBe(graphic)
    expect(h.drawGraphic.mock.calls[0]?.[2]).toEqual(rect)
    expect(h.drawGraphic.mock.calls[0]?.[4]).toBe('#123456')
  })

  it('文字为空但图形存在时仍画图形', async () => {
    const h = makeHarness()
    const image = { width: 128, height: 128 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 128, height: 128 }
    const rect: Rect = { x: 0, y: 0, width: 100, height: 100 }
    h.loadGraphicForConfig.mockResolvedValue(graphic)
    h.layoutText.mockReturnValue({ ...LAYOUT, graphic: rect })

    await composeWith(configOf({ text: '' }), 512, 512, h.deps)

    expect(h.drawGraphic).toHaveBeenCalledTimes(1)
    expect(h.drawText).not.toHaveBeenCalled()
  })

  it('文字为空白时跳过排版与绘字', async () => {
    const h = makeHarness()
    await composeWith(configOf({ text: '   ' }), 512, 512, h.deps)

    expect(h.layoutText).not.toHaveBeenCalled()
    expect(h.drawText).not.toHaveBeenCalled()
    expect(h.order).toEqual([
      'loadGraphicForConfig',
      'loadFontForConfig',
      'renderGradient',
      'drawHighlight',
    ])
  })
})

describe('composeWith 自动底板', () => {
  it('像素判定要底板时把 effect 换成胶囊，用户的 config 不动', async () => {
    const h = makeHarness(true)
    const config = configOf({ typography: { colorMode: 'auto' } })
    await composeWith(config, 512, 512, h.deps)

    expect(h.resolveInk).toHaveBeenCalledWith(expect.anything(), LAYOUT, config)
    expect(h.drawText.mock.calls[0]?.[2]).toMatchObject({ typography: { effect: 'pill' } })
    expect(config.typography.effect).toBe('shadow')
  })

  it('不要底板时原样把 config 交给取色与绘字', async () => {
    const h = makeHarness(false)
    const config = configOf()
    await composeWith(config, 512, 512, h.deps)

    expect(h.drawText.mock.calls[0]?.[2]).toBe(config)
  })

  it('用户自己选了效果就不覆盖', async () => {
    const h = makeHarness(true)
    const config = configOf({ typography: { effect: 'outline' } })
    await composeWith(config, 512, 512, h.deps)

    expect(h.drawText.mock.calls[0]?.[2]).toBe(config)
  })

  it('自定义文字色时底板判定不改配置', async () => {
    const h = makeHarness(true)
    const config = configOf({ typography: { colorMode: 'custom', color: '#0a0a0a' } })
    await composeWith(config, 512, 512, h.deps)

    expect(h.drawText.mock.calls[0]?.[2]).toBe(config)
    expect(h.drawText.mock.calls[0]?.[3]).toBe('#0a0a0a')
  })
})

describe('composeWith 形状遮罩', () => {
  it('圆形用 destination-in 裁出内接圆，且在绘字之后', async () => {
    const h = makeHarness()
    await composeWith(configOf({ canvas: { shape: 'circle' } }), 512, 256, h.deps)

    const ops = opsOfOutput()
    const names = opNames(ops)
    expect(names).toContain('set:globalCompositeOperation')
    expect(ops.find((op) => op.name === 'set:globalCompositeOperation')?.args[0]).toBe(
      'destination-in',
    )
    // 短边 256，内接圆半径 128，圆心在画布中心
    expect(ops.find((op) => op.name === 'arc')?.args.slice(0, 3)).toEqual([256, 128, 128])
    expect(indexOfOp(ops, 'set:globalCompositeOperation')).toBeGreaterThan(
      indexOfOp(ops, 'drawImage'),
    )
    expect(names.at(-1)).toBe('restore')
  })

  it('圆角用四段 arcTo，半径按短边比例换算', async () => {
    const h = makeHarness()
    await composeWith(configOf({ canvas: { shape: 'rounded', radius: 0.25 } }), 400, 800, h.deps)

    const ops = opsOfOutput()
    const arcTo = ops.filter((op) => op.name === 'arcTo')
    expect(arcTo).toHaveLength(4)
    // 短边 400，圆角 0.25 → 100
    expect(arcTo[0]?.args).toEqual([400, 0, 400, 100, 100])
    expect(ops.some((op) => op.name === 'arc')).toBe(false)
  })

  it('圆角半径超过短边一半时收到半边长，避免路径自交', async () => {
    const h = makeHarness()
    await composeWith(configOf({ canvas: { shape: 'rounded', radius: 0.5 } }), 400, 800, h.deps)

    const arcTo = opsOfOutput().filter((op) => op.name === 'arcTo')
    expect(arcTo[0]?.args.at(-1)).toBe(200)
  })

  it('方形不做遮罩', async () => {
    const h = makeHarness()
    await composeWith(configOf({ canvas: { shape: 'square' } }), 512, 512, h.deps)

    expect(opNames(opsOfOutput())).not.toContain('set:globalCompositeOperation')
  })

  it('圆角半径为 0 时同样不做遮罩', async () => {
    const h = makeHarness()
    await composeWith(configOf({ canvas: { shape: 'rounded', radius: 0 } }), 512, 512, h.deps)

    expect(opNames(opsOfOutput())).not.toContain('set:globalCompositeOperation')
  })
})

describe('composeWith 中途失败的画布释放', () => {
  it('拿不到输出画布的 2D 上下文时，渐变画布当场释放', async () => {
    const h = makeHarness()
    const nullContext = function (): null {
      return null
    } as unknown as HTMLCanvasElement['getContext']
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(nullContext)

    await expect(composeWith(configOf(), 4096, 4096, h.deps)).rejects.toThrow(
      '无法获取 2D 画布上下文',
    )
    // 4096 的渐变画布是 64 MB，抛错就丢下不管的话，用户重试时内存压力更大
    expect(h.gradient.width).toBe(1)
    expect(h.gradient.height).toBe(1)
  })

  it('绘制途中抛错时，渐变与输出两张画布都释放', async () => {
    const h = makeHarness()
    h.drawHighlight.mockImplementation(() => {
      throw new Error('高光炸了')
    })

    await expect(composeWith(configOf(), 4096, 4096, h.deps)).rejects.toThrow('高光炸了')
    // 调用方拿不到内部画布的引用，它只能在 composeWith 里释放
    expect(registry.entries[0]?.canvas.width).toBe(1)
    expect(h.gradient.width).toBe(1)
  })
})
