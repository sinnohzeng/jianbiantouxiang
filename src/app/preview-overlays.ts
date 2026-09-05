/**
 * 预览参考层的开关：安全区参考线与网格。
 *
 * 与 ambient.ts 同款：模块级状态加 localStorage。它们是「怎么看预览」而不是「出什么图」，
 * 不属于 AvatarConfig，不进存档与历史；导出永远不画它们。
 * 专业工具的做法是记住上次的视图选项（Photoshop 的显示网格就是），这里照做。
 */

import { useCallback, useSyncExternalStore } from 'react'

export const OVERLAYS_STORAGE_KEY = 'gradient-avatar:overlays'

export interface PreviewOverlays {
  /** 圆形裁切范围加安全框。 */
  guide: boolean
  /** 正方形网格加中心十字。 */
  grid: boolean
}

export const DEFAULT_OVERLAYS: PreviewOverlays = { guide: false, grid: false }

/** 网格每格边长 = 画布短边 / 这个数。12 同时能被 2、3、4 整除，三分与四分线都落在格线上。 */
export const GRID_DIVISIONS = 12

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStored(): PreviewOverlays {
  try {
    const raw = globalThis.localStorage?.getItem(OVERLAYS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_OVERLAYS }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...DEFAULT_OVERLAYS }
    return {
      guide: typeof parsed.guide === 'boolean' ? parsed.guide : DEFAULT_OVERLAYS.guide,
      grid: typeof parsed.grid === 'boolean' ? parsed.grid : DEFAULT_OVERLAYS.grid,
    }
  } catch {
    return { ...DEFAULT_OVERLAYS }
  }
}

let overlays: PreviewOverlays = readStored()
const listeners = new Set<() => void>()

export function getPreviewOverlays(): PreviewOverlays {
  return overlays
}

export function setPreviewOverlays(patch: Partial<PreviewOverlays>): void {
  const next = { ...overlays, ...patch }
  if (next.guide === overlays.guide && next.grid === overlays.grid) return
  overlays = next
  try {
    globalThis.localStorage?.setItem(OVERLAYS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 存不下就只在本次会话生效
  }
  for (const listener of listeners) listener()
}

/** 订阅开关变化；没有实际变化时不通知。 */
export function subscribePreviewOverlays(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface PreviewOverlaysState extends PreviewOverlays {
  setGuide: (on: boolean) => void
  setGrid: (on: boolean) => void
}

export function usePreviewOverlays(): PreviewOverlaysState {
  const current = useSyncExternalStore(
    subscribePreviewOverlays,
    getPreviewOverlays,
    () => DEFAULT_OVERLAYS,
  )
  const setGuide = useCallback((on: boolean) => setPreviewOverlays({ guide: on }), [])
  const setGrid = useCallback((on: boolean) => setPreviewOverlays({ grid: on }), [])
  return { ...current, setGuide, setGrid }
}
