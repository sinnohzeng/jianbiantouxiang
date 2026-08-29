/**
 * 离屏渲染的降级与释放。jsdom 没有 WebGL2，ShaderMount 与能力探测都换成假的，
 * 断言的是 render.ts 自己的分支：尺寸没等到、挂载建不出来、用完还不还上下文。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderGradient } from '@/engine/render'
import { DEFAULT_CONFIG } from '@/state/config'

const state = vi.hoisted(() => ({
  webgl2: true,
  maxSize: 4096,
  settleSize: true,
  constructThrows: false,
  revalidated: 0,
  mounts: [] as { canvasElement: HTMLCanvasElement; disposed: boolean; frames: number[] }[],
}))

vi.mock('@/engine/caps', () => ({
  getRenderCaps: () => ({ webgl2: state.webgl2, maxSize: state.maxSize }),
  hasWebGL2: () => state.webgl2,
  resetRenderCaps: () => {},
  revalidateWebGL2: () => {
    state.revalidated += 1
    return false
  },
}))

vi.mock('@/engine/shader-mount', () => ({
  ShaderMount: class {
    canvasElement: HTMLCanvasElement
    disposed = false
    frames: number[] = []

    constructor(
      parent: HTMLElement,
      _fragmentShader: string,
      _uniforms: unknown,
      _attributes: unknown,
      _speed: number,
      frame: number,
    ) {
      if (state.constructThrows) throw new Error('Paper Shaders: WebGL is not supported')
      this.canvasElement = document.createElement('canvas')
      parent.prepend(this.canvasElement)
      // 真实实现靠 ResizeObserver 定画布像素，这里直接照容器的布局尺寸给
      if (state.settleSize) {
        this.canvasElement.width = Math.round(Number.parseFloat(parent.style.width))
        this.canvasElement.height = Math.round(Number.parseFloat(parent.style.height))
      }
      this.frames.push(frame)
      state.mounts.push(this)
    }

    setUniforms(): void {}

    setFrame(frame: number): void {
      this.frames.push(frame)
    }

    dispose(): void {
      this.disposed = true
    }
  },
}))

interface Op {
  name: string
  args: unknown[]
}

const drawn: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; ops: Op[] }[] = []
const lost: HTMLCanvasElement[] = []

function webgl2Stub(canvas: HTMLCanvasElement): unknown {
  return {
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext: () => void lost.push(canvas) } : null,
  }
}

function createRecordingContext(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = []
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      ops.push({ name, args })
    }
  const ctx = {
    fillRect: record('fillRect'),
    drawImage: record('drawImage'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    putImageData: record('putImageData'),
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
    createRadialGradient: (...args: unknown[]) => {
      ops.push({ name: 'createRadialGradient', args })
      return { addColorStop: record('addColorStop') }
    },
    createPattern: (...args: unknown[]) => {
      ops.push({ name: 'createPattern', args })
      return { setTransform: record('setTransform') }
    },
    fillStyle: null as unknown,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops }
}

/** 第一张取过 2D 上下文的画布就是 renderGradient 的产出。 */
function outputOps(): Op[] {
  return drawn[0]?.ops ?? []
}

function opNames(ops: Op[]): string[] {
  return ops.map((op) => op.name)
}

beforeEach(() => {
  state.webgl2 = true
  state.maxSize = 4096
  state.settleSize = true
  state.constructThrows = false
  state.revalidated = 0
  state.mounts = []
  drawn.length = 0
  lost.length = 0

  const impl = function (this: HTMLCanvasElement, kind: string): unknown {
    if (kind === 'webgl2') return webgl2Stub(this)
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

describe('renderGradient 的 shader 路径', () => {
  it('尺寸就绪就画 shader 那张画布，收尾丢上下文并把画布缩到 1×1', async () => {
    const before = document.body.childElementCount
    await renderGradient(DEFAULT_CONFIG, 256, 256)

    const mount = state.mounts[0]
    expect(state.mounts).toHaveLength(1)
    expect(opNames(outputOps())).toContain('drawImage')
    expect(mount?.disposed).toBe(true)
    // dispose 不丢上下文，这一步是本仓自己补的
    expect(lost).toHaveLength(1)
    expect(mount?.canvasElement.width).toBe(1)
    expect(document.body.childElementCount).toBe(before)
  })

  it('等不到画布尺寸就退到 2D 近似，不画那张 300×150 的拉伸图', async () => {
    state.settleSize = false
    const realNow = Date.now.bind(Date)
    let calls = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      calls += 1
      // 第一次算 deadline 用真实时间，之后直接越过上限，省下 2 秒空等
      return calls > 1 ? realNow() + 10_000 : realNow()
    })

    const onFallback = vi.fn()
    await renderGradient(DEFAULT_CONFIG, 256, 256, { onFallback })

    expect(onFallback).toHaveBeenCalledExactlyOnceWith('size-timeout')
    expect(opNames(outputOps())).not.toContain('drawImage')
    expect(opNames(outputOps())).toContain('createRadialGradient')
    // 尺寸等不到不是能力问题，不该动能力缓存
    expect(state.revalidated).toBe(0)
    // 这条路径同样要把上下文还回去
    expect(lost).toHaveLength(1)
  })

  it('挂载建不出来时复核能力并报 mount-failed', async () => {
    state.constructThrows = true
    const onFallback = vi.fn()
    await renderGradient(DEFAULT_CONFIG, 256, 256, { onFallback })

    expect(onFallback).toHaveBeenCalledExactlyOnceWith('mount-failed')
    expect(state.revalidated).toBe(1)
    expect(opNames(outputOps())).toContain('createRadialGradient')
  })

  it('没有 WebGL2 时报 no-webgl2，不去建挂载', async () => {
    state.webgl2 = false
    const onFallback = vi.fn()
    await renderGradient(DEFAULT_CONFIG, 256, 256, { onFallback })

    expect(onFallback).toHaveBeenCalledExactlyOnceWith('no-webgl2')
    expect(state.mounts).toHaveLength(0)
    expect(state.revalidated).toBe(0)
  })

  it('回调抛错不影响出图', async () => {
    state.webgl2 = false
    const canvas = await renderGradient(DEFAULT_CONFIG, 128, 128, {
      onFallback: () => {
        throw new Error('调用方自己炸了')
      },
    })
    expect(canvas.width).toBe(128)
  })

  it('silk 走兜底也补颗粒，与 shader 路径的产出口径一致', async () => {
    state.webgl2 = false
    const config = {
      ...DEFAULT_CONFIG,
      style: 'silk' as const,
      styleParams: { ...DEFAULT_CONFIG.styleParams, grain: 0.6 },
    }
    await renderGradient(config, 256, 256)
    expect(opNames(outputOps())).toContain('createPattern')
  })
})
