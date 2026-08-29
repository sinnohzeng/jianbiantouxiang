/** 媒体查询订阅。只用 matchMedia，不监听 resize，切换断点时才重渲。 */

import { useCallback, useSyncExternalStore } from 'react'

/** 桌面双栏的起点，与 spec 3.7 的 1024 px 一致。 */
export const DESKTOP_BREAKPOINT = 1024

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', listener)
      return () => list.removeEventListener('change', listener)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return serverValue
    return window.matchMedia(query).matches
  }, [query, serverValue])

  const getServerSnapshot = useCallback(() => serverValue, [serverValue])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** 窄屏布局。断点用 0.02 px 的余量避开 1024 整数宽度上两条查询同时为真。 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${DESKTOP_BREAKPOINT - 0.02}px)`)
}

/** 用户要求减少动效时，装饰性动画一律不做。 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
