/**
 * 字体目录：从 fontsource API 拉全量列表，裁掉用不上的字段后按 7 天缓存到 localStorage。
 * 只保留 type 为 google 的条目，因为主加载链路走 Google Fonts css2，
 * fontsource 独有的字体在那条链路上取不到。
 */

import { CURATED_FONTS } from './curated'

// 目录接口不可用时的兜底数据，从 catalog 这里也能取，省得调用方分辨两个模块
export { CURATED_FONTS } from './curated'

export type FontCategory =
  'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'other'

export type CjkScript = 'sc' | 'tc' | 'hk' | 'jp' | 'kr'

export interface FontEntry {
  id: string
  family: string
  category: FontCategory
  subsets: string[]
  weights: number[]
  cjk?: CjkScript
}

export const CATALOG_URL = 'https://api.fontsource.org/v1/fonts'
export const CATALOG_CACHE_KEY = 'ga3.fonts.catalog.v1'
export const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const CATALOG_TIMEOUT_MS = 8000

const CATEGORIES: readonly FontCategory[] = [
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
  'other',
]

/** subset 到脚本标记的映射，顺序即优先级：一份字体同时带简繁时按简体归类。 */
const CJK_SUBSETS: readonly [string, CjkScript][] = [
  ['chinese-simplified', 'sc'],
  ['chinese-traditional', 'tc'],
  ['chinese-hongkong', 'hk'],
  ['japanese', 'jp'],
  ['korean', 'kr'],
]

interface CachePayload {
  at: number
  fonts: FontEntry[]
}

interface RawFont {
  id?: unknown
  family?: unknown
  category?: unknown
  subsets?: unknown
  weights?: unknown
  type?: unknown
}

function toCategory(value: unknown): FontCategory {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
    ? (value as FontCategory)
    : 'other'
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function toWeights(value: unknown): number[] {
  if (!Array.isArray(value)) return [400]
  const out = value
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => Number.isFinite(v) && v >= 100 && v <= 1000)
    .map((v) => Math.round(v))
  return out.length > 0 ? [...new Set(out)].sort((a, b) => a - b) : [400]
}

export function cjkOfSubsets(subsets: readonly string[]): CjkScript | undefined {
  for (const [subset, script] of CJK_SUBSETS) {
    if (subsets.includes(subset)) return script
  }
  return undefined
}

/** 把 API 原始条目压成 FontEntry；字段缺失或非 google 来源的直接丢弃。 */
export function toFontEntry(raw: unknown): FontEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as RawFont
  if (typeof r.id !== 'string' || typeof r.family !== 'string') return null
  if (r.type !== 'google') return null
  const category = toCategory(r.category)
  if (category === 'other' && r.category === 'icons') return null
  const subsets = toStringArray(r.subsets)
  const cjk = cjkOfSubsets(subsets)
  const entry: FontEntry = {
    id: r.id,
    family: r.family,
    category,
    subsets,
    weights: toWeights(r.weights),
  }
  if (cjk) entry.cjk = cjk
  return entry
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readCache(): CachePayload | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(CATALOG_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { at, fonts } = parsed as { at?: unknown; fonts?: unknown }
    if (typeof at !== 'number' || !Number.isFinite(at) || !Array.isArray(fonts)) return null
    const list = fonts.filter(
      (f): f is FontEntry =>
        typeof f === 'object' && f !== null && typeof (f as FontEntry).family === 'string',
    )
    if (list.length === 0) return null
    return { at, fonts: list }
  } catch {
    return null
  }
}

function writeCache(fonts: FontEntry[]): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({ at: Date.now(), fonts } satisfies CachePayload),
    )
  } catch {
    // 配额满或隐私模式禁写，缓存只是提速手段，失败不影响本次返回
  }
}

export function clearCatalogCache(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(CATALOG_CACHE_KEY)
  } catch {
    // 同上
  }
}

let inflight: Promise<FontEntry[]> | null = null

async function requestCatalog(timeoutMs: number): Promise<FontEntry[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(CATALOG_URL, { signal: controller.signal })
    if (!res.ok) throw new Error(`catalog http ${res.status}`)
    const raw: unknown = await res.json()
    if (!Array.isArray(raw)) throw new Error('catalog payload is not an array')
    const fonts = raw.map(toFontEntry).filter((f): f is FontEntry => f !== null)
    if (fonts.length === 0) throw new Error('catalog payload is empty')
    return fonts
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 取字体目录：缓存未过期直接用；过期或缺失时请求接口，成功后回写缓存。
 * 请求失败先退到过期缓存，再退到精选清单，保证选择器任何时候都有内容。
 */
export async function fetchCatalog(opts?: {
  force?: boolean
  timeoutMs?: number
}): Promise<FontEntry[]> {
  const cached = readCache()
  if (!opts?.force && cached && Date.now() - cached.at < CATALOG_TTL_MS) {
    return cached.fonts
  }
  inflight ??= requestCatalog(opts?.timeoutMs ?? CATALOG_TIMEOUT_MS)
    .then((fonts) => {
      writeCache(fonts)
      return fonts
    })
    .finally(() => {
      inflight = null
    })
  try {
    return await inflight
  } catch {
    return cached ? cached.fonts : CURATED_FONTS
  }
}

export interface SearchOptions {
  category?: FontCategory | 'all'
  cjk?: CjkScript | 'any' | 'none'
  recent?: readonly string[]
  limit?: number
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 命中强度：0 不匹配，越大越靠前。id 与 family 同权，起始匹配优于中间匹配。 */
function score(entry: FontEntry, query: string): number {
  if (!query) return 1
  const family = normalize(entry.family)
  const id = entry.id.toLowerCase()
  if (family === query || id === query) return 4
  if (family.startsWith(query) || id.startsWith(query)) return 3
  if (family.includes(query) || id.includes(query)) return 2
  // 去掉空格后再比一次，让“notosans”能搜到 Noto Sans
  if (family.replace(/[\s-]/g, '').includes(query.replace(/[\s-]/g, ''))) return 1
  return 0
}

/** 过滤加排序，最近使用的 family 无条件置顶。 */
export function searchFonts(
  list: readonly FontEntry[],
  query: string,
  opts?: SearchOptions,
): FontEntry[] {
  const q = normalize(query)
  const category = opts?.category ?? 'all'
  const cjk = opts?.cjk ?? 'any'
  const recent = (opts?.recent ?? []).map((f) => normalize(f))

  const scored: { entry: FontEntry; s: number; recentAt: number }[] = []
  for (const entry of list) {
    if (category !== 'all' && entry.category !== category) continue
    if (cjk === 'none' && entry.cjk) continue
    if (cjk !== 'any' && cjk !== 'none' && entry.cjk !== cjk) continue
    const s = score(entry, q)
    if (s === 0) continue
    const recentAt = recent.indexOf(normalize(entry.family))
    scored.push({ entry, s, recentAt: recentAt < 0 ? Number.MAX_SAFE_INTEGER : recentAt })
  }

  scored.sort(
    (a, b) =>
      a.recentAt - b.recentAt || b.s - a.s || a.entry.family.localeCompare(b.entry.family, 'en'),
  )

  const limit = opts?.limit
  const out = scored.map((x) => x.entry)
  return typeof limit === 'number' && limit >= 0 ? out.slice(0, limit) : out
}
