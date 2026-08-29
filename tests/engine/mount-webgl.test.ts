/**
 * 预览挂载在“有 WebGL2”这条路径上的生命周期。jsdom 拿不到真上下文，
 * ShaderMount 与能力探测都换成假的，断言的是 mount.ts 自己的分支：
 * 上下文被判掉之后有没有人管，主动释放会不会被当成被判掉，建不出来会不会静默。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGradientMount } from '@/engine/mount'
import { DEFAULT_CONFIG } from '@/state/config'

interface FakeMount {
  canvasElement: HTMLCanvasElement
  disposed: boolean
  uniformCalls: number
}

const state = vi.hoisted(() => ({
  constructThrows: false,
  revalidateResult: false,
  revalidated: 0,
  mounts: [] as {
    canvasElement: HTMLCanvasElement
    disposed: boolean
    uniformCalls: number
  }[],
}))

vi.mock('@/engine/caps', () => ({
  getRenderCaps: () => ({ webgl2: true, maxSize: 4096 }),
  hasWebGL2: () => true,
  resetRenderCaps: () => {},
  revalidateWebGL2: () => {
    state.revalidated += 1
    return state.revalidateResult
  },
}))

vi.mock('@/engine/shader-mount', () => ({
  ShaderMount: class {
    canvasElement: HTMLCanvasElement
    disposed = false
    uniformCalls = 0

    constructor(parent: HTMLElement) {
      const canvas = document.createElement('canvas')
      // 真实实现也是先把画布塞进容器再取上下文，失败时画布已经在 DOM 里了
      parent.prepend(canvas)
      if (state.constructThrows) throw new Error('Paper Shaders: WebGL is not supported')
      this.canvasElement = canvas
      state.mounts.push(this)
    }

    setUniforms(): void {
      this.uniformCalls += 1
    }

    setFrame(): void {}

    dispose(): void {
      this.disposed = true
      this.canvasElement.remove()
    }
  },
}))

/** 真浏览器里 loseContext 会派发 webglcontextlost，这里照做，好验证监听摘没摘干净。 */
function webgl2Stub(canvas: HTMLCanvasElement): unknown {
  return {
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context'
        ? {
            loseContext: () => {
              canvas.dispatchEvent(new Event('webglcontextlost'))
            },
          }
        : null,
  }
}

function stubWebGLContext(): void {
  const impl = function (this: HTMLCanvasElement, kind: string): unknown {
    if (kind !== 'webgl2') return null
    return webgl2Stub(this)
  } as unknown as HTMLCanvasElement['getContext']
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(impl)
}

function lose(mount: FakeMount): void {
  mount.canvasElement.dispatchEvent(new Event('webglcontextlost'))
}

beforeEach(() => {
  state.constructThrows = false
  state.revalidateResult = false
  state.revalidated = 0
  state.mounts = []
  stubWebGLContext()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('预览挂载的上下文丢失', () => {
  it('被浏览器判掉后报出来、落回 CSS 近似，并重建一个新的', async () => {
    const container = document.createElement('div')
    const onFallback = vi.fn()
    const mount = createGradientMount(container, DEFAULT_CONFIG, { onFallback })
    await vi.waitFor(() => expect(state.mounts).toHaveLength(1))

    const first = state.mounts[0]
    expect(first).toBeDefined()
    lose(first as FakeMount)

    expect(onFallback).toHaveBeenCalledWith('context-lost')
    expect(container.style.background).toContain('radial-gradient(')
    expect(first?.disposed).toBe(true)

    await vi.waitFor(() => expect(state.mounts).toHaveLength(2), { timeout: 2000 })
    expect(container.style.background).toBe('')
    mount.dispose()
  })

  it('反复被判掉时重建有上限，不会无限重来', async () => {
    const container = document.createElement('div')
    const mount = createGradientMount(container, DEFAULT_CONFIG)
    await vi.waitFor(() => expect(state.mounts).toHaveLength(1))

    for (let round = 0; round < 4; round += 1) {
      const latest = state.mounts.at(-1)
      if (!latest || latest.disposed) break
      lose(latest)
      await new Promise((resolve) => setTimeout(resolve, 400))
    }

    // 初次挂载加两次重建，之后停在 CSS 近似上
    expect(state.mounts).toHaveLength(3)
    expect(container.style.background).toContain('radial-gradient(')
    mount.dispose()
  })

  it('换质感时自己丢的上下文不算被判掉', async () => {
    const container = document.createElement('div')
    const onFallback = vi.fn()
    const mount = createGradientMount(container, DEFAULT_CONFIG, { onFallback })
    await vi.waitFor(() => expect(state.mounts).toHaveLength(1))

    mount.update({ ...DEFAULT_CONFIG, style: 'flow' })
    await vi.waitFor(() => expect(state.mounts).toHaveLength(2))
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(onFallback).not.toHaveBeenCalled()
    // 只有换质感那一次重建，没有被“上下文丢失”多带出一次
    expect(state.mounts).toHaveLength(2)
    expect(container.style.background).toBe('')
    mount.dispose()
  })

  it('dispose 时丢上下文，不会反过来触发重建', async () => {
    const container = document.createElement('div')
    const onFallback = vi.fn()
    const mount = createGradientMount(container, DEFAULT_CONFIG, { onFallback })
    await vi.waitFor(() => expect(state.mounts).toHaveLength(1))

    mount.dispose()
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(onFallback).not.toHaveBeenCalled()
    expect(state.mounts).toHaveLength(1)
    expect(state.mounts[0]?.disposed).toBe(true)
  })
})

describe('预览挂载建不出来时', () => {
  it('报 mount-failed、复核能力，并清掉构造函数留下的空画布', async () => {
    state.constructThrows = true
    const container = document.createElement('div')
    const onFallback = vi.fn()
    const mount = createGradientMount(container, DEFAULT_CONFIG, { onFallback })

    await vi.waitFor(() => expect(onFallback).toHaveBeenCalledWith('mount-failed'))
    expect(state.revalidated).toBe(1)
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(container.style.background).toContain('radial-gradient(')
    mount.dispose()
  })

  it('复核确认没有 WebGL2 之后不再反复重试', async () => {
    state.constructThrows = true
    const container = document.createElement('div')
    const onFallback = vi.fn()
    const mount = createGradientMount(container, DEFAULT_CONFIG, { onFallback })
    await vi.waitFor(() => expect(state.revalidated).toBe(1))

    mount.update({ ...DEFAULT_CONFIG, seed: 'next' })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(state.revalidated).toBe(1)
    expect(onFallback).toHaveBeenCalledExactlyOnceWith('mount-failed')
    expect(container.style.background).toContain('radial-gradient(')
    mount.dispose()
  })
})
