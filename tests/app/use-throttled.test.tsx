/**
 * 预览节流：拖滑杆时画面不能冻住。
 *
 * 纯尾沿防抖在连续变化下一次都不放行，松手才跳到终值，实测拖 2 秒预览就停 2 秒。
 * 这里用同一串输入对照两个 hook，锁住这个差别。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useThrottled } from '@/app/use-throttled'
import { useDebounced } from '@/hooks/use-debounced'

const INTERVAL = 80

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

/** 模拟拖滑杆：每 20 ms 来一个新值。 */
function drag(rerender: (props: { v: number }) => void, from: number, to: number): void {
  for (let v = from; v <= to; v += 1) {
    rerender({ v })
    act(() => {
      vi.advanceTimersByTime(20)
    })
  }
}

describe('useThrottled', () => {
  it('值持续变化时也照常放行，不必等停手', () => {
    const { result, rerender } = renderHook(({ v }) => useThrottled(v, INTERVAL), {
      initialProps: { v: 0 },
    })
    expect(result.current).toBe(0)

    drag(rerender, 1, 4)
    expect(result.current).toBe(4)

    drag(rerender, 5, 8)
    expect(result.current).toBe(8)
  })

  it('同一串输入下，纯防抖整段都不放行', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, INTERVAL), {
      initialProps: { v: 0 },
    })
    drag(rerender, 1, 8)
    expect(result.current).toBe(0)
  })

  it('停手后补最后一次', () => {
    const { result, rerender } = renderHook(({ v }) => useThrottled(v, INTERVAL), {
      initialProps: { v: 0 },
    })
    drag(rerender, 1, 4)
    rerender({ v: 99 })
    act(() => {
      vi.advanceTimersByTime(INTERVAL)
    })
    expect(result.current).toBe(99)
  })

  it('卸载后挂起的那次不再写状态', () => {
    const { unmount, rerender } = renderHook(({ v }) => useThrottled(v, INTERVAL), {
      initialProps: { v: 0 },
    })
    rerender({ v: 1 })
    unmount()
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(INTERVAL * 4)
      })
    }).not.toThrow()
  })
})
