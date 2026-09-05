/**
 * 手机预览高度：默认值、夹取、落盘与订阅。
 * 与预览参考层同构，模块级状态在 import 时读一次存储，每个用例都要重新加载模块。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'gradient-avatar:preview-height'

async function load() {
  vi.resetModules()
  return import('@/app/preview-height')
}

describe('预览高度', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('默认 28 svh，区间是 20 到 60', async () => {
    const mod = await load()
    expect(mod.getPreviewHeight()).toBe(28)
    expect(mod.DEFAULT_PREVIEW_HEIGHT).toBe(28)
    expect(mod.MIN_PREVIEW_HEIGHT).toBe(20)
    expect(mod.MAX_PREVIEW_HEIGHT).toBe(60)
  })

  it('超出区间的写入被夹住', async () => {
    const mod = await load()
    mod.setPreviewHeight(999)
    expect(mod.getPreviewHeight()).toBe(60)
    mod.setPreviewHeight(-5)
    expect(mod.getPreviewHeight()).toBe(20)
    mod.setPreviewHeight(Number.NaN)
    expect(mod.getPreviewHeight()).toBe(28)
  })

  it('改过之后落盘，重新加载还在', async () => {
    const mod = await load()
    mod.setPreviewHeight(41)
    expect(localStorage.getItem(KEY)).toBe('41')

    const again = await load()
    expect(again.getPreviewHeight()).toBe(41)
  })

  it('坏数据回落默认', async () => {
    localStorage.setItem(KEY, 'tall')
    expect((await load()).getPreviewHeight()).toBe(28)

    localStorage.setItem(KEY, '')
    expect((await load()).getPreviewHeight()).toBe(28)

    // 存过界的旧值也要夹回来，不能让预览占满整屏
    localStorage.setItem(KEY, '900')
    expect((await load()).getPreviewHeight()).toBe(60)
  })

  it('无变化不通知订阅者，真变化通知一次', async () => {
    const mod = await load()
    const spy = vi.fn()
    const unsubscribe = mod.subscribePreviewHeight(spy)
    mod.setPreviewHeight(28)
    expect(spy).not.toHaveBeenCalled()
    mod.setPreviewHeight(36)
    expect(spy).toHaveBeenCalledTimes(1)
    unsubscribe()
    mod.setPreviewHeight(44)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
