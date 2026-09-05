/**
 * 长按直存那张图的排程：去抖合并、旧任务作废、页面在后台不排。
 *
 * 合成本身要 canvas，jsdom 里跑不了，所以这里只测排程，render 用桩。
 */

import { describe, expect, it, vi } from 'vitest'
import { createSaveImageScheduler } from '@/app/preview-save-image'
import { DEFAULT_CONFIG } from '@/state/config'

/** 手动推进的假时钟：只有调用 tick 才让待办跑起来。 */
function fakeTimer() {
  const pending = new Map<number, () => void>()
  let id = 0
  return {
    setTimer: (fn: () => void) => {
      id += 1
      pending.set(id, fn)
      return id
    },
    clearTimer: (handle: unknown) => {
      pending.delete(handle as number)
    },
    tick: () => {
      const jobs = [...pending.values()]
      pending.clear()
      for (const job of jobs) job()
    },
    get size() {
      return pending.size
    },
  }
}

describe('createSaveImageScheduler', () => {
  it('连着请求只出一张图，取最后一次的配置', async () => {
    const timer = fakeTimer()
    const render = vi.fn(
      async (config: typeof DEFAULT_CONFIG) => `data:image/jpeg;base64,${config.text}`,
    )
    const onImage = vi.fn()
    const scheduler = createSaveImageScheduler({
      render,
      onImage,
      isHidden: () => false,
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    })

    scheduler.request({ ...DEFAULT_CONFIG, text: 'A' })
    scheduler.request({ ...DEFAULT_CONFIG, text: 'B' })
    scheduler.request({ ...DEFAULT_CONFIG, text: 'C' })
    timer.tick()
    await vi.waitFor(() => expect(onImage).toHaveBeenCalledTimes(1))

    expect(render).toHaveBeenCalledTimes(1)
    expect(onImage).toHaveBeenCalledWith('data:image/jpeg;base64,C')
  })

  it('在途结果被新请求顶掉后不再回调', async () => {
    const timer = fakeTimer()
    let release: (value: string) => void = () => {}
    const first = new Promise<string>((resolve) => {
      release = resolve
    })
    const render = vi
      .fn<(config: typeof DEFAULT_CONFIG) => Promise<string>>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce('data:image/jpeg;base64,new')
    const onImage = vi.fn()
    const scheduler = createSaveImageScheduler({
      render,
      onImage,
      isHidden: () => false,
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    })

    scheduler.request(DEFAULT_CONFIG)
    timer.tick()
    // 第一张还在编码，配置又变了
    scheduler.request({ ...DEFAULT_CONFIG, text: '新的' })
    timer.tick()
    release('data:image/jpeg;base64,old')
    await vi.waitFor(() => expect(onImage).toHaveBeenCalledTimes(1))

    expect(onImage).toHaveBeenCalledWith('data:image/jpeg;base64,new')
  })

  it('页面在后台时到点也不合成', () => {
    const timer = fakeTimer()
    const render = vi.fn(async () => 'data:image/jpeg;base64,x')
    const scheduler = createSaveImageScheduler({
      render,
      onImage: vi.fn(),
      isHidden: () => true,
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    })

    scheduler.request(DEFAULT_CONFIG)
    timer.tick()

    expect(render).not.toHaveBeenCalled()
  })

  it('dispose 之后待办作废，也不再接受新请求', async () => {
    const timer = fakeTimer()
    const render = vi.fn(async () => 'data:image/jpeg;base64,x')
    const scheduler = createSaveImageScheduler({
      render,
      onImage: vi.fn(),
      isHidden: () => false,
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    })

    scheduler.request(DEFAULT_CONFIG)
    scheduler.dispose()
    timer.tick()
    scheduler.request(DEFAULT_CONFIG)
    timer.tick()
    await Promise.resolve()

    expect(render).not.toHaveBeenCalled()
    expect(timer.size).toBe(0)
  })
})
