/**
 * 节流：值持续变化时也保证每 interval 毫秒至少放行一次，停手后再补最后一次。
 *
 * 预览不能用纯尾沿防抖。滑杆走的是 onValueChange，拖动时每个 pointermove 都会写一次 store，
 * 间隔远小于 80 ms，尾沿防抖于是整个拖动过程一次都不放行，画面要等松手才跳到终值。
 * 取色探针那条仍然该用防抖，它本来就该等用户停手，见 hooks/use-debounced。
 */

import { useEffect, useRef, useState } from 'react'

export function useThrottled<T>(value: T, interval: number): T {
  const [settled, setSettled] = useState(value)
  // 初值 0 而不是 Date.now()：render 期间不调不纯函数。首帧的 elapsed 因此极大，走立刻放行那一支。
  const lastAt = useRef(0)

  useEffect(() => {
    const wait = Math.max(0, interval)
    const elapsed = Date.now() - lastAt.current
    // 距上次放行不足一档就等够剩下的，够了就下一个任务立刻放行。
    // 一律走定时器：同步 setState 会在 effect 体里引发级联渲染
    const timer = setTimeout(
      () => {
        lastAt.current = Date.now()
        setSettled(value)
      },
      elapsed >= wait ? 0 : wait - elapsed,
    )
    return () => clearTimeout(timer)
  }, [value, interval])

  return settled
}
