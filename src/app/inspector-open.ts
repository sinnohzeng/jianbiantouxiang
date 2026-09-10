/**
 * 微调面板开着还是收着。
 *
 * 与 preview-height、preview-overlays 同构，落盘读写收在 persisted-atom。
 * 它是“怎么用界面”而不是“出什么图”，不属于 AvatarConfig，不进存档与历史。
 *
 * 默认收起：常用的是改文字与换配色，两列挑选栏要把宽度让给它们，
 * 数值微调按需拉出来。手机与桌面共用这一个开关，断点来回穿越时状态不丢。
 */

import { useCallback } from 'react'
import { createPersistedAtom } from '@/app/persisted-atom'

export const INSPECTOR_OPEN_STORAGE_KEY = 'gradient-avatar:inspector-open'

const atom = createPersistedAtom<boolean>({
  key: INSPECTOR_OPEN_STORAGE_KEY,
  fallback: false,
  parse: (raw) => (raw === '1' ? true : raw === '0' ? false : null),
  serialize: (open) => (open ? '1' : '0'),
  equals: (a, b) => a === b,
})

export function getInspectorOpen(): boolean {
  return atom.get()
}

export function setInspectorOpen(next: boolean): void {
  atom.set(next)
}

export function subscribeInspectorOpen(listener: () => void): () => void {
  return atom.subscribe(listener)
}

export interface InspectorOpenState {
  open: boolean
  setOpen: (next: boolean) => void
  toggle: () => void
}

export function useInspectorOpen(): InspectorOpenState {
  const open = atom.useValue()
  const setOpen = useCallback((next: boolean) => setInspectorOpen(next), [])
  const toggle = useCallback(() => setInspectorOpen(!getInspectorOpen()), [])
  return { open, setOpen, toggle }
}
