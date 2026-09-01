/**
 * 环境光强度：页面底色的光晕露出多少。
 *
 * 状态放模块级加 localStorage，与 theme.ts 同款写法。它是页面外观，
 * 不属于 AvatarConfig，所以不进分享链接与存档。
 * 默认档停在“压过”的位置：大面积低饱和，浅色配色当背景不晃眼。
 */

import { useCallback, useSyncExternalStore } from 'react'
import type { ResolvedTheme } from '@/app/theme'
import { formatHex, oklch } from '@/palettes/culori'

export const AMBIENT_STORAGE_KEY = 'gradient-avatar:ambient'

/** 滑杆中位即默认档，AmbientBackground 以它为基准换算各主题的不透明度。 */
export const AMBIENT_DEFAULT = 0.5

function isLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function readStored(): number {
  try {
    const raw = globalThis.localStorage?.getItem(AMBIENT_STORAGE_KEY)
    const parsed = raw === null || raw === undefined ? Number.NaN : Number(raw)
    return isLevel(parsed) ? parsed : AMBIENT_DEFAULT
  } catch {
    return AMBIENT_DEFAULT
  }
}

let level: number = readStored()
const listeners = new Set<() => void>()

export function setAmbientLevel(next: number): void {
  const clamped = Math.min(1, Math.max(0, next))
  if (clamped === level) return
  level = clamped
  try {
    globalThis.localStorage?.setItem(AMBIENT_STORAGE_KEY, String(clamped))
  } catch {
    // 存不下就只在本次会话生效
  }
  for (const listener of listeners) listener()
}

export function getAmbientLevel(): number {
  return level
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface AmbientState {
  level: number
  setLevel: (next: number) => void
}

export function useAmbientLevel(): AmbientState {
  const current = useSyncExternalStore(subscribe, getAmbientLevel, () => AMBIENT_DEFAULT)
  const setLevel = useCallback((next: number) => setAmbientLevel(next), [])
  return { level: current, setLevel }
}

/**
 * 浅色主题把光晕颜色压一档：饱和乘 0.55、明度往下压一点，pastel 当背景才不晃眼。
 * 深色主题原色返回：不透明度本来就低，再压会发灰。
 */
export function suppressBlobColor(color: string, resolved: ResolvedTheme): string {
  if (resolved !== 'light') return color
  const parsed = oklch(color)
  if (!parsed) return color
  return (
    formatHex({
      mode: 'oklch',
      l: Math.max(0.5, Math.min(0.88, parsed.l - 0.06)),
      c: parsed.c * 0.55,
      h: parsed.h ?? 0,
    }) ?? color
  )
}
