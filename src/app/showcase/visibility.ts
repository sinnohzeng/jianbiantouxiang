/** 标签页可见性订阅。背景着色器靠它在切走时停帧，回来再续上。 */

import { useCallback, useSyncExternalStore } from 'react'

function subscribe(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

export function usePageVisible(): boolean {
  const getSnapshot = useCallback(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState !== 'hidden'
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
