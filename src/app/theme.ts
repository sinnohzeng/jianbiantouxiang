/**
 * 深浅主题：class 策略（`html.dark`）加系统跟随。
 * 状态放模块级而不是 context，`index.html` 里的首帧脚本用同一个 key，
 * 两边读到的东西一致才不会闪一下白屏。
 */

import { useCallback, useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']
export const THEME_STORAGE_KEY = 'gradient-avatar:theme'

/** 与 src/index.css 里 --background 的实测取值对齐，用于 meta[name=theme-color]。 */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#fbf9f6',
  dark: '#1b1a17',
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStored(): ThemeMode {
  try {
    const raw = globalThis.localStorage?.getItem(THEME_STORAGE_KEY)
    return isMode(raw) ? raw : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DARK_QUERY).matches
}

let mode: ThemeMode = readStored()
const listeners = new Set<() => void>()

function resolve(next: ThemeMode): ResolvedTheme {
  if (next === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return next
}

function apply(): void {
  if (typeof document === 'undefined') return
  const resolved = resolve(mode)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved])
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function setThemeMode(next: ThemeMode): void {
  mode = next
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // 存不下就只在本次会话生效
  }
  apply()
  emit()
}

export function getThemeMode(): ThemeMode {
  return mode
}

export function getResolvedTheme(): ResolvedTheme {
  return resolve(mode)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  apply()
  if (typeof window.matchMedia === 'function') {
    // 跟随系统时，用户在系统设置里换主题也要立刻反映到界面
    window.matchMedia(DARK_QUERY).addEventListener('change', () => {
      if (mode !== 'system') return
      apply()
      emit()
    })
  }
}

export interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (next: ThemeMode) => void
}

export function useTheme(): ThemeState {
  const current = useSyncExternalStore(subscribe, getThemeMode, () => 'system' as ThemeMode)
  const resolved = useSyncExternalStore(subscribe, getResolvedTheme, () => 'light' as ResolvedTheme)
  const setMode = useCallback((next: ThemeMode) => {
    setThemeMode(next)
  }, [])

  return { mode: current, resolved, setMode }
}
