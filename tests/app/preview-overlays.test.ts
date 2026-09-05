import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'gradient-avatar:overlays'

/** 模块级状态在 import 时读一次存储，每个用例都要重新加载模块。 */
async function load() {
  vi.resetModules()
  return import('@/app/preview-overlays')
}

describe('预览参考层开关', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('默认两层都关', async () => {
    const mod = await load()
    expect(mod.getPreviewOverlays()).toEqual({ guide: false, grid: false })
  })

  it('打开网格会落盘，重新加载后还在', async () => {
    const mod = await load()
    mod.setPreviewOverlays({ grid: true })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ guide: false, grid: true })

    const again = await load()
    expect(again.getPreviewOverlays()).toEqual({ guide: false, grid: true })
  })

  it('只改一层不动另一层', async () => {
    const mod = await load()
    mod.setPreviewOverlays({ guide: true })
    mod.setPreviewOverlays({ grid: true })
    mod.setPreviewOverlays({ guide: false })
    expect(mod.getPreviewOverlays()).toEqual({ guide: false, grid: true })
  })

  it('坏数据回落默认', async () => {
    localStorage.setItem(KEY, '{"grid":"yes"')
    const broken = await load()
    expect(broken.getPreviewOverlays()).toEqual({ guide: false, grid: false })

    localStorage.setItem(KEY, '[1,2]')
    const array = await load()
    expect(array.getPreviewOverlays()).toEqual({ guide: false, grid: false })

    localStorage.setItem(KEY, '{"grid":1,"guide":true}')
    const partial = await load()
    expect(partial.getPreviewOverlays()).toEqual({ guide: true, grid: false })
  })

  it('无变化不通知订阅者，真变化通知一次', async () => {
    const mod = await load()
    const spy = vi.fn()
    const unsubscribe = mod.subscribePreviewOverlays(spy)
    mod.setPreviewOverlays({ grid: false })
    expect(spy).not.toHaveBeenCalled()
    mod.setPreviewOverlays({ grid: true })
    expect(spy).toHaveBeenCalledTimes(1)
    unsubscribe()
    mod.setPreviewOverlays({ grid: false })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('网格格数能被二、三、四整除', async () => {
    const mod = await load()
    expect(mod.GRID_DIVISIONS % 2).toBe(0)
    expect(mod.GRID_DIVISIONS % 3).toBe(0)
    expect(mod.GRID_DIVISIONS % 4).toBe(0)
  })
})
