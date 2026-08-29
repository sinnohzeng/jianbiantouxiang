/**
 * 界面多语言。字典是扁平的点分 key，zh-CN 为源语言，
 * 其余四份用 `typeof zhCN` 约束，少一个 key 就在 typecheck 报错。
 */

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import en from './en.json'
import ja from './ja.json'
import ko from './ko.json'
import zhCN from './zh-CN.json'
import zhHK from './zh-HK.json'

/** 与 `@/palettes` 的 PaletteLocale 同一套取值，配色名可以直接按它取。 */
export type Locale = 'zh-CN' | 'zh-HK' | 'en' | 'ja' | 'ko'

export type Dict = typeof zhCN
export type I18nKey = keyof Dict
export type TParams = Record<string, string | number>

/**
 * 允许传任意字符串：引擎给的 `labelKey` 这类 key 在类型上就是 string，
 * 卡死成联合类型会逼调用方到处断言。已知 key 仍有补全，未知 key 运行时回落到 en 再回落到 key 本身。
 */
export type LooseKey = I18nKey | (string & {})
export type TFunction = (key: LooseKey, params?: TParams) => string

export const LOCALES: readonly Locale[] = ['zh-CN', 'zh-HK', 'en', 'ja', 'ko']

export const DEFAULT_LOCALE: Locale = 'zh-CN'

/** 英文兜底：源语言以外的字典万一漏了 key，先落到 en 再落到 key 本身。 */
const FALLBACK_LOCALE: Locale = 'en'

const DICTS: Record<Locale, Dict> = { 'zh-CN': zhCN, 'zh-HK': zhHK, en, ja, ko }

export const LOCALE_STORAGE_KEY = 'gradient-avatar:locale'

/** URL 上的语言参数，方便把某一语言的链接直接发出去。 */
export const LOCALE_QUERY_KEY = 'lang'

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** 浏览器语言标签到界面语言的映射：繁体一律归 zh-HK，其余中文归 zh-CN。 */
export function matchLocale(tag: string): Locale | null {
  const raw = tag.trim().toLowerCase()
  if (!raw) return null
  if (raw.startsWith('zh')) {
    if (raw.includes('hant') || raw.includes('tw') || raw.includes('hk') || raw.includes('mo')) {
      return 'zh-HK'
    }
    return 'zh-CN'
  }
  if (raw.startsWith('ja')) return 'ja'
  if (raw.startsWith('ko')) return 'ko'
  if (raw.startsWith('en')) return 'en'
  return null
}

function readQueryLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    const value = new URLSearchParams(window.location.search).get(LOCALE_QUERY_KEY)
    if (!value) return null
    return isLocale(value) ? value : matchLocale(value)
  } catch {
    return null
  }
}

function readStoredLocale(): Locale | null {
  try {
    const value = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    // 无痕模式下读 localStorage 也会抛
    return null
  }
}

function readNavigatorLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const matched = matchLocale(tag ?? '')
    if (matched) return matched
  }
  return null
}

/** 初始语言优先级：URL ?lang= > localStorage > 浏览器语言 > 简体中文。 */
export function detectLocale(): Locale {
  return readQueryLocale() ?? readStoredLocale() ?? readNavigatorLocale() ?? DEFAULT_LOCALE
}

function format(template: string, params?: TParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function translate(locale: Locale, key: LooseKey, params?: TParams): string {
  const primary: Record<string, string | undefined> = DICTS[locale]
  const fallback: Record<string, string | undefined> = DICTS[FALLBACK_LOCALE]
  return format(primary[key] ?? fallback[key] ?? key, params)
}

interface I18nValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: TFunction
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // 存不下就只在本次会话生效
    }
    if (typeof document !== 'undefined') document.documentElement.lang = next
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

function useI18n(): I18nValue {
  const value = use(I18nContext)
  if (!value) throw new Error('useT / useLocale 必须放在 I18nProvider 里')
  return value
}

/** 取翻译函数：`t('panel.text.title')`，带参数写 `t('export.done', { name })`。 */
export function useT(): TFunction {
  return useI18n().t
}

/** 取当前语言与切换函数。配色名这类已带五语的数据直接用 locale 取。 */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const { locale, setLocale } = useI18n()
  return { locale, setLocale }
}
