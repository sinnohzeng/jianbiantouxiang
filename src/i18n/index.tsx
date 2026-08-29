/**
 * 界面多语言。字典是扁平的点分 key，zh-CN 为源语言，
 * 其余四份用 `typeof zhCN` 约束，少一个 key 就在 typecheck 报错。
 *
 * 只有 zh-CN 与 en 静态打进首屏：前者是默认语言，后者是所有字典的兜底。
 * zh-HK、ja、ko 各自一份 chunk，切过去时先用手上这份渲染一帧，字典到了再重绘。
 */

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import en from './en.json'
import zhCN from './zh-CN.json'

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

/** 已在手上的字典。异步那三份加载完就补进来，模块级缓存，切回去不再拉一次。 */
const DICTS: Partial<Record<Locale, Dict>> = { 'zh-CN': zhCN, en }

const LAZY_DICTS: Partial<Record<Locale, () => Promise<{ default: Dict }>>> = {
  'zh-HK': () => import('./zh-HK.json'),
  ja: () => import('./ja.json'),
  ko: () => import('./ko.json'),
}

/** 取已在手上的字典，没有就给 null，调用方落到英文。 */
export function dictOf(locale: Locale): Dict | null {
  return DICTS[locale] ?? null
}

const inflight = new Map<Locale, Promise<void>>()

/** 取某种语言的字典。已在手上或没有对应 chunk 时立刻 resolve。 */
export function loadDict(locale: Locale): Promise<void> {
  if (DICTS[locale]) return Promise.resolve()
  const existing = inflight.get(locale)
  if (existing) return existing
  const loader = LAZY_DICTS[locale]
  if (!loader) return Promise.resolve()

  const task = loader()
    .then((module) => {
      DICTS[locale] = module.default
    })
    .catch(() => {
      // 拉不到就一直用兜底语言，界面不至于白屏
    })
    .finally(() => {
      inflight.delete(locale)
    })
  inflight.set(locale, task)
  return task
}

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

/** 按字典查一条文案。字典还在路上（null）时落到英文，不抛错也不显示裸 key。 */
function translateWith(dict: Dict | null, key: LooseKey, params?: TParams): string {
  const primary: Record<string, string | undefined> = dict ?? {}
  const fallback: Record<string, string | undefined> = DICTS[FALLBACK_LOCALE] ?? {}
  return format(primary[key] ?? fallback[key] ?? key, params)
}

/** 不带 Provider 的查询入口，供测试与非组件代码用。异步字典未加载时同样落到英文。 */
export function translate(locale: Locale, key: LooseKey, params?: TParams): string {
  return translateWith(dictOf(locale), key, params)
}

interface I18nValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: TFunction
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)
  // 当前语言的字典。异步那三份到货前是 null，界面落到英文
  const [dict, setDict] = useState<Dict | null>(() => dictOf(locale))

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  // 已在手上时 loadDict 立刻 resolve，setDict 拿到同一个引用，React 自己会短路掉这次渲染
  useEffect(() => {
    let cancelled = false
    void loadDict(locale).then(() => {
      if (!cancelled) setDict(dictOf(locale))
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    // 新字典还没到就先留着手上这份，界面短暂停在旧语言，而不是闪一下英文
    setDict((current) => dictOf(next) ?? current)
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
      t: (key, params) => translateWith(dict, key, params),
    }),
    [locale, setLocale, dict],
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
