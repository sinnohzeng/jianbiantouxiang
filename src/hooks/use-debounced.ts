/** 防抖：拖滑杆时预览不必每次变更都重渲一遍。 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** 值稳定 delay 毫秒后才向下游暴露。 */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    // 一律走定时器：delay 为 0 时也让状态更新落到下一个任务，
    // 避免在 effect 体里同步 setState 引发级联渲染
    const timer = setTimeout(() => setSettled(value), Math.max(0, delay))
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}

/**
 * 防抖回调。返回的函数引用稳定，可以直接进依赖数组；
 * 组件卸载时挂起的那次调用会被丢掉，不会往已卸载的组件里写状态。
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const latest = useRef(callback)
  const wait = useRef(delay)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    latest.current = callback
    wait.current = delay
  }, [callback, delay])

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  return useCallback((...args: A) => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      latest.current(...args)
    }, wait.current)
  }, [])
}
