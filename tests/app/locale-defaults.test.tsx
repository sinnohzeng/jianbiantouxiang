/** 界面语言只改变编辑器文案，画布默认内容与用户存档保持一致。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { LOCALES, LOCALE_STORAGE_KEY, useLocale, type Locale } from '@/i18n'
import { DEFAULT_CONFIG, normalizeConfig } from '@/state/config'
import { savePersisted } from '@/state/persist'
import { readInitialConfig, stopConfigSync, useAvatarStore } from '@/state/store'
import App from '@/App'

let switchLocale: ((next: Locale) => void) | undefined
let activeLocale: Locale | undefined
vi.mock('@/app/AppShell', () => ({
  AppShell: () => {
    const { locale, setLocale } = useLocale()
    useEffect(() => {
      switchLocale = setLocale
      activeLocale = locale
    }, [locale, setLocale])
    return null
  },
}))
vi.mock('@/app/showcase/motion', () => ({
  ShowcaseMotionProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/app/showcase/Preloader', () => ({ ShowcasePreloader: () => null }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/app/theme', () => ({ useTheme: () => ({ resolved: 'light' }) }))

const config = () => useAvatarStore.getState().config
beforeEach(() => {
  stopConfigSync()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  switchLocale = undefined
  activeLocale = undefined
  useAvatarStore.setState({ config: DEFAULT_CONFIG, history: [], past: [], future: [] })
})
afterEach(cleanup)

describe('统一默认内容与语言边界', () => {
  it.each(LOCALES)('%s 首次进入使用相同中文内容、字体和原色豆包工作图标', async (locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    render(<App />)
    await waitFor(() => expect(activeLocale).toBe(locale))
    expect(config().text).toBe('工作新习惯\n你说豆包干')
    expect(config().layout.icon).toEqual({ source: 'brand', id: 'doubao-work', mono: false })
    expect(config().typography.line1.font.family).toBe('Noto Serif SC')
    expect(config().typography.line2.font?.family).toBe('Noto Sans SC')
  })

  it('切换界面语言不改写用户文字、字体或图标', async () => {
    const custom = normalizeConfig({
      text: 'Hello\nTeam',
      layout: { icon: { source: 'none', id: '', mono: false } },
      typography: {
        line1: { font: { family: 'Inter', source: 'google', weight: 400 } },
        line2: { font: null },
      },
    })
    useAvatarStore.setState({ config: custom })
    render(<App />)
    act(() => switchLocale?.('ko'))
    await waitFor(() => expect(activeLocale).toBe('ko'))
    expect(config()).toEqual(custom)
  })

  it('显式旧默认存档恢复后保持原内容，重置才改为当前默认', async () => {
    const old = normalizeConfig({
      text: '飞书\n效率先锋',
      layout: { icon: { source: 'none', id: '', mono: false } },
      typography: {
        line1: { font: { family: 'Inter', source: 'google', weight: 400 } },
        line2: { font: null },
      },
    })
    savePersisted(old)
    useAvatarStore.setState({ config: readInitialConfig() })
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    render(<App />)
    await waitFor(() => expect(activeLocale).toBe('en'))
    expect(config()).toEqual(old)
    act(() => useAvatarStore.getState().reset())
    expect(config()).toEqual(DEFAULT_CONFIG)
    expect(config().text).toBe('工作新习惯\n你说豆包干')
    expect(config().layout.icon.id).toBe('doubao-work')
    act(() => useAvatarStore.getState().undo())
    expect(config()).toEqual(old)
  })
})
