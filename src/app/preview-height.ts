/**
 * 手机上预览区占屏幕多高。
 *
 * 与 preview-overlays.ts 同构：模块级状态加 localStorage。它是“怎么看预览”而不是
 * “出什么图”，不属于 AvatarConfig，不进存档与历史。
 * 单位是 svh（小视口高度），拖分隔条时直接改这个数，画布边长跟着 CSS 变量走。
 */

import { useCallback, useSyncExternalStore } from 'react'

export const PREVIEW_HEIGHT_STORAGE_KEY = 'gradient-avatar:preview-height'

/** 默认让预览只占上方一小块，剩下的都是操作区。 */
export const DEFAULT_PREVIEW_HEIGHT = 28
export const MIN_PREVIEW_HEIGHT = 20
export const MAX_PREVIEW_HEIGHT = 60

/** 键盘上下键每次挪多少。 */
export const PREVIEW_HEIGHT_STEP = 4

export function clampPreviewHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREVIEW_HEIGHT
  if (value < MIN_PREVIEW_HEIGHT) return MIN_PREVIEW_HEIGHT
  if (value > MAX_PREVIEW_HEIGHT) return MAX_PREVIEW_HEIGHT
  return value
}

function readStored(): number {
  try {
    const raw = globalThis.localStorage?.getItem(PREVIEW_HEIGHT_STORAGE_KEY)
    if (!raw) return DEFAULT_PREVIEW_HEIGHT
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) return DEFAULT_PREVIEW_HEIGHT
    return clampPreviewHeight(parsed)
  } catch {
    return DEFAULT_PREVIEW_HEIGHT
  }
}

let height = readStored()
const listeners = new Set<() => void>()

export function getPreviewHeight(): number {
  return height
}

/** 写入新高度，自动夹到区间；无变化时不落盘也不通知。 */
export function setPreviewHeight(next: number): void {
  const value = clampPreviewHeight(next)
  if (value === height) return
  height = value
  try {
    globalThis.localStorage?.setItem(PREVIEW_HEIGHT_STORAGE_KEY, String(value))
  } catch {
    // 存不下就只在本次会话生效
  }
  for (const listener of listeners) listener()
}

export function subscribePreviewHeight(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface PreviewHeightState {
  /** 当前高度，单位 svh。 */
  height: number
  setHeight: (next: number) => void
  reset: () => void
}

export function usePreviewHeight(): PreviewHeightState {
  const current = useSyncExternalStore(
    subscribePreviewHeight,
    getPreviewHeight,
    () => DEFAULT_PREVIEW_HEIGHT,
  )
  const setHeight = useCallback((next: number) => setPreviewHeight(next), [])
  const reset = useCallback(() => setPreviewHeight(DEFAULT_PREVIEW_HEIGHT), [])
  return { height: current, setHeight, reset }
}
