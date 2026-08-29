import { beforeEach, describe, expect, it } from 'vitest'
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
