/**
 * 炫技层的两道闸。
 *
 * 一、`prefers-reduced-motion: reduce` 是用户的声明，背景着色器不挂，退回 CSS 光晕。
 * 二、`VITE_SHOWCASE=0` 是排查用的一键关闭，同样退回光晕。
 * 两条都过才挂极光那份懒 chunk，这里用一个假组件替掉它，免得在 jsdom 里真去拉 three。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { setAmbientLevel } from '@/app/ambient'
import { showcaseEnabled } from '@/app/showcase/config'
import { ShowcaseBackground } from '@/app/showcase/ShowcaseBackground'

// 这台「设备」起得来 WebGL2，把回落条件收敛到只剩炫技层开关本身
vi.mock('@/engine/caps', () => ({
  getRenderCaps: () => ({ webgl2: true, maxSize: 4096 }),
}))

vi.mock('@/app/showcase/AuroraBackdrop', () => ({
  default: () => <div data-slot="showcase-background" />,
}))

function stubMatchMedia(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  })
}

beforeEach(() => {
  setAmbientLevel(0.5)
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('炫技层开关', () => {
  it('默认开着，VITE_SHOWCASE=0 才关', () => {
    expect(showcaseEnabled()).toBe(true)
    vi.stubEnv('VITE_SHOWCASE', '0')
    expect(showcaseEnabled()).toBe(false)
  })
})

describe('ShowcaseBackground', () => {
  it('两道闸都过时挂极光背景', async () => {
    const { container } = render(<ShowcaseBackground />)
    await waitFor(() => {
      expect(container.querySelector('[data-slot="showcase-background"]')).not.toBeNull()
    })
  })

  it('reduced-motion 下不挂背景着色器，退回 CSS 光晕', async () => {
    stubMatchMedia(true)
    const { container } = render(<ShowcaseBackground />)
    // 懒加载是异步的，给它一轮微任务的机会再断言「确实没挂」
    await Promise.resolve()
    expect(container.querySelector('[data-slot="showcase-background"]')).toBeNull()
    expect(container.querySelectorAll('.ambient-blob').length).toBeGreaterThan(0)
  })

  it('VITE_SHOWCASE=0 时不挂背景着色器，退回 CSS 光晕', async () => {
    vi.stubEnv('VITE_SHOWCASE', '0')
    const { container } = render(<ShowcaseBackground />)
    await Promise.resolve()
    expect(container.querySelector('[data-slot="showcase-background"]')).toBeNull()
    expect(container.querySelectorAll('.ambient-blob').length).toBeGreaterThan(0)
  })

  it('环境光拉到 0 时不挂背景着色器', async () => {
    setAmbientLevel(0)
    const { container } = render(<ShowcaseBackground />)
    await Promise.resolve()
    expect(container.querySelector('[data-slot="showcase-background"]')).toBeNull()
  })
})
