/**
 * 字体目录：从 fontsource API 拉全量列表，裁掉用不上的字段后按 7 天缓存到 localStorage。
 * 只保留 type 为 google 的条目，因为主加载链路走 Google Fonts css2，
 * fontsource 独有的字体在那条链路上取不到。
 *
 * 按 family 查条目只有 `findFontEntry` 一个入口：先查精选清单，再查内存里的目录。
 * 内存目录第一次被访问时从本地缓存解析一次，不看有效期，`fetchCatalog` 拉到新目录时替换；
 * 有效期只决定选择器打开时要不要刷新列表，过期条目的 id、字重与版本照样可用。
 */

import { FONT_WEIGHTS, type FontSource, type FontWeight } from '@/state/config'
import { CURATED_FONTS, NATIVE_NAMES, SYSTEM_FONT_SCRIPTS } from './curated'
import { UPLOAD_FAMILY_SUFFIX } from './upload'

export type CjkScript = 'sc' | 'tc' | 'hk' | 'jp' | 'kr'

export interface FontEntry {
  id: string
  /** fontsource npm 包版本；镜像 CSS 用它替代 @latest。 */
  version?: string
  family: string
  /** 字体真实提供的字重，升序，只含 FONT_WEIGHTS 九档。 */
  weights: FontWeight[]
  cjk?: CjkScript
}

export const CATALOG_URL = 'https://api.fontsource.org/v1/fonts'
export const CATALOG_CACHE_KEY = 'gradient-avatar:font-catalog:v1'
export const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const CATALOG_TIMEOUT_MS = 8000

/** 查不到条目时的字重兜底，覆盖绝大多数可变字体。 */
export const FALLBACK_WEIGHTS: readonly FontWeight[] = [300, 400, 500, 600, 700, 800, 900]

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
  version?: unknown
  family?: unknown
  category?: unknown
  subsets?: unknown
  weights?: unknown
  type?: unknown
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** 只留 FONT_WEIGHTS 九档里的值，天然升序去重；一档都没有时给 400。 */
function toWeights(value: unknown): FontWeight[] {
  if (!Array.isArray(value)) return [400]
  const listed = new Set(value.map((v) => Number(v)))
  const out = FONT_WEIGHTS.filter((w) => listed.has(w))
  return out.length > 0 ? out : [400]
}

function cjkOfSubsets(subsets: readonly string[]): CjkScript | undefined {
  for (const [subset, script] of CJK_SUBSETS) {
    if (subsets.includes(subset)) return script
  }
  return undefined
}

/** 把 API 原始条目压成 FontEntry；字段缺失、图标字体或非 google 来源的直接丢弃。 */
export function toFontEntry(raw: unknown): FontEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as RawFont
  if (typeof r.id !== 'string' || typeof r.family !== 'string') return null
  if (r.type !== 'google' || r.category === 'icons') return null
  const cjk = cjkOfSubsets(toStringArray(r.subsets))
  const entry: FontEntry = {
    id: r.id,
    family: r.family,
    weights: toWeights(r.weights),
    ...(typeof r.version === 'string' && /^\d+\.\d+\.\d+$/.test(r.version)
      ? { version: r.version }
      : {}),
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

/** family 的比较口径：去掉首尾空白后小写。 */
function familyKey(family: string): string {
  return family.trim().toLowerCase()
}

function indexByFamily(list: readonly FontEntry[]): Map<string, FontEntry> {
  return new Map(list.map((entry) => [familyKey(entry.family), entry]))
}

const CURATED_BY_FAMILY = indexByFamily(CURATED_FONTS)

/** 内存里的目录，null 表示还没从本地缓存解析过。 */
let memo: Map<string, FontEntry> | null = null

function catalogByFamily(): Map<string, FontEntry> {
  memo ??= indexByFamily(readCache()?.fonts ?? [])
  return memo
}

/** 清掉本地缓存，内存里那份目录一起作废，下次查找重新从缓存解析。 */
export function clearCatalogCache(): void {
  memo = null
  const store = storage()
  if (!store) return
  try {
    store.removeItem(CATALOG_CACHE_KEY)
  } catch {
    // 同上
  }
}

/** 按 family 查目录条目：先查精选清单，再查内存目录。同步返回，不发请求。 */
export function findFontEntry(family: string): FontEntry | undefined {
  const key = familyKey(family)
  return CURATED_BY_FAMILY.get(key) ?? catalogByFamily().get(key)
}

/** 这款字体可选的字重，查不到条目时给一份通用档位。 */
export function weightsOf(family: string): readonly FontWeight[] {
  const weights = findFontEntry(family)?.weights ?? []
  return weights.length > 0 ? weights : FALLBACK_WEIGHTS
}

/**
 * 界面上显示的字体名，选择器的行、卡片按钮、预览子集的 `text=` 与搜索都调它。
 * 上传字体去掉 family 的命名空间后缀；其余有原生名的显示原生名，没有的显示 family。
 */
export function displayName(family: string, source: FontSource): string {
  if (source === 'upload') {
    return family.endsWith(UPLOAD_FAMILY_SUFFIX)
      ? family.slice(0, -UPLOAD_FAMILY_SUFFIX.length)
      : family
  }
  return Object.hasOwn(NATIVE_NAMES, family) ? NATIVE_NAMES[family]! : family
}

const LANG_BY_SCRIPT: Readonly<Record<CjkScript, string>> = {
  sc: 'zh-Hans',
  tc: 'zh-Hant',
  hk: 'zh-HK',
  jp: 'ja',
  kr: 'ko',
}

/** 书写系统对应的 BCP 47 语言标签。 */
export function langOfScript(cjk: CjkScript): string {
  return LANG_BY_SCRIPT[cjk]
}

/**
 * 显示名那一格的 lang：原生名按字体的书写系统标，西文 family 标 en，上传字体的文件名语言未知，不标。
 * 读屏据此按正确的语言念，回退到界面字体时汉字也取对地区字形。
 */
export function nameLang(family: string, source: FontSource): string | undefined {
  if (source === 'upload') return undefined
  if (displayName(family, source) === family) return 'en'
  const cjk = source === 'system' ? SYSTEM_FONT_SCRIPTS[family] : findFontEntry(family)?.cjk
  return cjk ? langOfScript(cjk) : undefined
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
 * 取字体目录：缓存未过期直接用；过期或缺失时请求接口，成功后回写缓存并替换内存目录。
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
      memo = indexByFamily(fonts)
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
  /** 按书写系统过滤：给一个或一组脚本只留这些，'none' 只留非中日韩字体。 */
  cjk?: CjkScript | readonly CjkScript[] | 'any' | 'none'
  recent?: readonly string[]
  limit?: number
  /** 查询为空时保持列表原序，精选清单的手工顺序靠它留住；有查询时照常按命中强度排。 */
  keepOrder?: boolean
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 命中强度：0 不匹配，越大越靠前。family、id 与原生名同权，起始匹配优于中间匹配。 */
function score(entry: FontEntry, query: string): number {
  if (!query) return 1
  const family = normalize(entry.family)
  const names = [family, entry.id.toLowerCase(), normalize(displayName(entry.family, 'google'))]
  if (names.some((name) => name === query)) return 4
  if (names.some((name) => name.startsWith(query))) return 3
  if (names.some((name) => name.includes(query))) return 2
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
  const cjk = opts?.cjk ?? 'any'
  const scripts: readonly CjkScript[] | null =
    cjk === 'any' || cjk === 'none' ? null : typeof cjk === 'string' ? [cjk] : cjk
  const recent = (opts?.recent ?? []).map((f) => normalize(f))

  const scored: { entry: FontEntry; s: number; recentAt: number }[] = []
  for (const entry of list) {
    if (cjk === 'none' && entry.cjk) continue
    if (scripts && (!entry.cjk || !scripts.includes(entry.cjk))) continue
    const s = score(entry, q)
    if (s === 0) continue
    const recentAt = recent.indexOf(normalize(entry.family))
    scored.push({ entry, s, recentAt: recentAt < 0 ? Number.MAX_SAFE_INTEGER : recentAt })
  }

  if (!(opts?.keepOrder && q === '')) {
    scored.sort(
      (a, b) =>
        a.recentAt - b.recentAt || b.s - a.s || a.entry.family.localeCompare(b.entry.family, 'en'),
    )
  }

  const limit = opts?.limit
  const out = scored.map((x) => x.entry)
  return typeof limit === 'number' && limit >= 0 ? out.slice(0, limit) : out
}
