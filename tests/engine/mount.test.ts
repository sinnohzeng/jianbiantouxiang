import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@/state/config'
import { resetRenderCaps } from '@/engine/caps'
import { createGradientMount } from '@/engine/mount'

/** jsdom 没有 WebGL2，这里覆盖的是无 WebGL2 时的 CSS 兜底路径。 */
describe('createGradientMount 在无 WebGL2 环境', () => {
  beforeEach(() => {
    resetRenderCaps()
  })

  it('挂载即把渐变写到容器背景上', () => {
    const container = document.createElement('div')
    const mount = createGradientMount(container, DEFAULT_CONFIG)
    expect(container.style.background).toContain('radial-gradient(')
    mount.dispose()
  })

  it('update 换 seed 就换背景', () => {
    const container = document.createElement('div')
    const mount = createGradientMount(container, { ...DEFAULT_CONFIG, seed: 'a' })
    const first = container.style.background
    mount.update({ ...DEFAULT_CONFIG, seed: 'b' })
    expect(container.style.background).not.toBe(first)
    mount.dispose()
  })

  it('dispose 之后清空背景且不再响应 update', () => {
    const container = document.createElement('div')
    const mount = createGradientMount(container, DEFAULT_CONFIG)
    mount.dispose()
    expect(container.style.background).toBe('')
    mount.update({ ...DEFAULT_CONFIG, seed: 'after-dispose' })
    expect(container.style.background).toBe('')
  })

  it('重复 dispose 不抛错', () => {
    const container = document.createElement('div')
    const mount = createGradientMount(container, DEFAULT_CONFIG)
    mount.dispose()
    expect(() => mount.dispose()).not.toThrow()
  })

  it('四种 style 都能挂上', () => {
    for (const style of ['mesh', 'flow', 'silk', 'grain'] as const) {
      const container = document.createElement('div')
      const mount = createGradientMount(container, { ...DEFAULT_CONFIG, style })
      expect(container.style.background).toContain('radial-gradient(')
      mount.dispose()
    }
  })
})

interface Op {
  name: string
  args: unknown[]
}

/** jsdom 没有 2D 后端，用记录型上下文顶上，断言颗粒层到底画没画。 */
function createRecordingContext(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = []
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      ops.push({ name, args })
    }
  const ctx = {
    fillRect: record('fillRect'),
    save: record('save'),
    restore: record('restore'),
    putImageData: record('putImageData'),
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    createPattern: (...args: unknown[]) => {
      ops.push({ name: 'createPattern', args })
      return { setTransform: record('setTransform') }
    },
    fillStyle: null as unknown,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops }
}

/** 颗粒层要读容器的布局尺寸，jsdom 不排版，这里直接钉住。 */
function createSizedContainer(edge = 320): HTMLDivElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: edge, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: edge, configurable: true })
  return container
}

const SILK = {
  ...DEFAULT_CONFIG,
  style: 'silk' as const,
  styleParams: { ...DEFAULT_CONFIG.styleParams, grain: 0.6 },
}

function grainLayer(container: HTMLElement): HTMLCanvasElement | null {
  return container.querySelector<HTMLCanvasElement>('canvas[data-slot="preview-grain"]')
}

/**
 * silk 没有颗粒 uniform，导出那份颗粒是 render.ts 在 2D 阶段补的。
 * 预览这层补的是同一份，否则 silk 下拖颗粒滑杆预览纹丝不动、导出却有颗粒。
 */
describe('silk 的颗粒层', () => {
  const drawn: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; ops: Op[] }[] = []

  beforeEach(() => {
    resetRenderCaps()
    drawn.length = 0
    const impl = function (this: HTMLCanvasElement, kind: string): unknown {
      if (kind !== '2d') return null
      const found = drawn.find((entry) => entry.canvas === this)
      if (found) return found.ctx
      const { ctx, ops } = createRecordingContext()
      drawn.push({ canvas: this, ctx, ops })
      return ctx
    } as unknown as HTMLCanvasElement['getContext']
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(impl)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('挂上一张 overlay 混合的画布并真的画了颗粒', () => {
    const container = createSizedContainer()
    const mount = createGradientMount(container, SILK)

    const layer = grainLayer(container)
    expect(layer).not.toBeNull()
    expect(layer?.style.mixBlendMode).toBe('overlay')
    expect(layer?.width).toBe(320)
    expect(layer?.height).toBe(320)

    const ops = drawn.find((entry) => entry.canvas === layer)?.ops ?? []
    expect(ops.map((op) => op.name)).toContain('createPattern')
    expect(ops.map((op) => op.name)).toContain('fillRect')
    mount.dispose()
  })

  it('shader 自带颗粒的三种质感不叠这一层', () => {
    for (const style of ['mesh', 'flow', 'grain'] as const) {
      const container = createSizedContainer()
      const mount = createGradientMount(container, { ...SILK, style })
      expect(grainLayer(container)).toBeNull()
      mount.dispose()
    }
  })

  it('颗粒拖到 0 就撤掉这一层，拖回来再挂上', () => {
    const container = createSizedContainer()
    const mount = createGradientMount(container, SILK)
    expect(grainLayer(container)).not.toBeNull()

    mount.update({ ...SILK, styleParams: { ...SILK.styleParams, grain: 0 } })
    expect(grainLayer(container)).toBeNull()

    mount.update({ ...SILK, styleParams: { ...SILK.styleParams, grain: 0.3 } })
    expect(grainLayer(container)).not.toBeNull()
    mount.dispose()
  })

  it('换颗粒强度会重画这一层', () => {
    const container = createSizedContainer()
    const mount = createGradientMount(container, SILK)
    const layer = grainLayer(container)
    const ops = drawn.find((entry) => entry.canvas === layer)?.ops ?? []
    const first = ops.length

    mount.update({ ...SILK, styleParams: { ...SILK.styleParams, grain: 0.2 } })
    expect(ops.length).toBeGreaterThan(first)
    // 同一张画布复用，不是每次 update 都新挂一张
    expect(container.querySelectorAll('canvas[data-slot="preview-grain"]')).toHaveLength(1)
    mount.dispose()
  })

  it('dispose 之后画布从容器里摘掉', () => {
    const container = createSizedContainer()
    const mount = createGradientMount(container, SILK)
    expect(grainLayer(container)).not.toBeNull()
    mount.dispose()
    expect(grainLayer(container)).toBeNull()
  })

  it('容器还没有布局尺寸时不挂画布', () => {
    const container = document.createElement('div')
    const mount = createGradientMount(container, SILK)
    expect(grainLayer(container)).toBeNull()
    mount.dispose()
  })
})
