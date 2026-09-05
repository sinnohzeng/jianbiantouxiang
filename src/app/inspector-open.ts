/**
 * 微调面板开着还是收着。
 *
 * 与 preview-height.ts 同构：模块级状态加 localStorage。它是“怎么用界面”而不是
 * “出什么图”，不属于 AvatarConfig，不进存档与历史。
 *
 * 默认收起：常用的是改文字与换配色，两列挑选栏要把宽度让给它们，
 * 数值微调按需拉出来。手机与桌面共用这一个开关，断点来回穿越时状态不丢。
 */

import { useCallback, useSyncExternalStore } from 'react'

export const INSPECTOR_OPEN_STORAGE_KEY = 'gradient-avatar:inspector-open'

function readStored(): boolean {
  try {
    return globalThis.localStorage?.getItem(INSPECTOR_OPEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let open = readStored()
const listeners = new Set<() => void>()

export function getInspectorOpen(): boolean {
  return open
}

export function setInspectorOpen(next: boolean): void {
  if (next === open) return
  open = next
  try {
    globalThis.localStorage?.setItem(INSPECTOR_OPEN_STORAGE_KEY, next ? '1' : '0')
  } catch {
    // 存不下就只在本次会话生效
  }
  for (const listener of listeners) listener()
}

export function subscribeInspectorOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface InspectorOpenState {
  open: boolean
  setOpen: (next: boolean) => void
  toggle: () => void
}

export function useInspectorOpen(): InspectorOpenState {
  const current = useSyncExternalStore(subscribeInspectorOpen, getInspectorOpen, () => false)
  const setOpen = useCallback((next: boolean) => setInspectorOpen(next), [])
  const toggle = useCallback(() => setInspectorOpen(!getInspectorOpen()), [])
  return { open: current, setOpen, toggle }
}
