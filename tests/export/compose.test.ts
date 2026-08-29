import { composeWith, type ComposeDeps } from '@/export/compose-core'
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
const LAYOUT = { marker: 'layout' }

interface Harness {
  deps: ComposeDeps<typeof LAYOUT>
  order: string[]
  gradient: HTMLCanvasElement
  drawText: ReturnType<typeof vi.fn>
  pickTextColor: ReturnType<typeof vi.fn>
  layoutText: ReturnType<typeof vi.fn>
  drawHighlight: ReturnType<typeof vi.fn>
}

function makeHarness(): Harness {
  const order: string[] = []
  // 渐变画布只被 drawImage 与释放动到，用一个最小的替身即可
  const gradient = { width: 2048, height: 2048 } as HTMLCanvasElement

  const drawHighlight = vi.fn(() => {
    order.push('drawHighlight')
  })
  const layoutText = vi.fn(() => {
    order.push('layoutText')
    return LAYOUT
  })
  const pickTextColor = vi.fn(() => {
    order.push('pickTextColor')
    return '#123456'
  })
  const drawText = vi.fn(() => {
    order.push('drawText')
  })

  const deps: ComposeDeps<typeof LAYOUT> = {
    loadFontForConfig: vi.fn(async () => {
      order.push('loadFontForConfig')
      return { family: 'Noto Sans SC', source: 'google', ok: true }
    }),
    renderGradient: vi.fn(async () => {
      order.push('renderGradient')
      return gradient
    }),
    drawHighlight,
    layoutText,
    pickTextColor,
    drawText,
  }

  return { deps, order, gradient, drawText, pickTextColor, layoutText, drawHighlight }
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
      'loadFontForConfig',
      'renderGradient',
      'drawHighlight',
      'layoutText',
      'pickTextColor',
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

    expect(h.pickTextColor).toHaveBeenCalledWith(expect.anything(), LAYOUT, config)
    expect(h.drawText).toHaveBeenCalledWith(expect.anything(), LAYOUT, config, '#123456')
  })

  it('自定义色不走取色，直接用配置里的颜色', async () => {
    const h = makeHarness()
    await composeWith(
      configOf({ typography: { colorMode: 'custom', color: '#0a0a0a' } }),
      512,
      512,
      h.deps,
    )

    expect(h.pickTextColor).not.toHaveBeenCalled()
    expect(h.drawText.mock.calls[0]?.[3]).toBe('#0a0a0a')
  })

  it('文字为空白时跳过排版与绘字', async () => {
    const h = makeHarness()
    await composeWith(configOf({ text: '   ' }), 512, 512, h.deps)

    expect(h.layoutText).not.toHaveBeenCalled()
    expect(h.drawText).not.toHaveBeenCalled()
    expect(h.order).toEqual(['loadFontForConfig', 'renderGradient', 'drawHighlight'])
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
