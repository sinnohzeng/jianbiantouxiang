/**
 * 预览参考层的开关：安全区参考线与网格。
 *
 * 落盘读写收在 persisted-atom。它们是「怎么看预览」而不是「出什么图」，
 * 不属于 AvatarConfig，不进存档与历史；导出永远不画它们。
 * 专业工具的做法是记住上次的视图选项（Photoshop 的显示网格就是），这里照做。
 */

import { useCallback } from 'react'
import { createPersistedAtom } from '@/app/persisted-atom'

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

const atom = createPersistedAtom<PreviewOverlays>({
  key: OVERLAYS_STORAGE_KEY,
  fallback: DEFAULT_OVERLAYS,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    return {
      guide: typeof record.guide === 'boolean' ? record.guide : DEFAULT_OVERLAYS.guide,
      grid: typeof record.grid === 'boolean' ? record.grid : DEFAULT_OVERLAYS.grid,
    }
  },
  serialize: (overlays) => JSON.stringify(overlays),
  equals: (a, b) => a.guide === b.guide && a.grid === b.grid,
})

export function getPreviewOverlays(): PreviewOverlays {
  return atom.get()
}

export function setPreviewOverlays(patch: Partial<PreviewOverlays>): void {
  atom.set({ ...getPreviewOverlays(), ...patch })
}

/** 订阅开关变化；没有实际变化时不通知。 */
export function subscribePreviewOverlays(listener: () => void): () => void {
  return atom.subscribe(listener)
}

export interface PreviewOverlaysState extends PreviewOverlays {
  setGuide: (on: boolean) => void
  setGrid: (on: boolean) => void
}

export function usePreviewOverlays(): PreviewOverlaysState {
  const current = atom.useValue()
  const setGuide = useCallback((on: boolean) => setPreviewOverlays({ guide: on }), [])
  const setGrid = useCallback((on: boolean) => setPreviewOverlays({ grid: on }), [])
  return { ...current, setGuide, setGrid }
}
