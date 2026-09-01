/**
 * 字体加载：css2 主链路，超时后依次降级到两个 jsDelivr 镜像，全失败回系统字体。
 * 文字绘制必须等 document.fonts.load 就绪，否则 canvas 会用回退字形出图。
 */

import type { AvatarConfig } from '@/state/config'
import type { FontEntry } from './catalog'
import { getCuratedByFamily } from './curated'
import {
  MIRROR_HOSTS,
  buildCss2Url,
  buildMirrorCssUrlsForHost,
  familyToFontsourceId,
} from './google'
import { getUploadedFont } from './upload'

export type FontLoadSource = 'google' | 'mirror' | 'system' | 'upload'

export interface FontLoadResult {
  family: string
  source: FontLoadSource
  ok: boolean
}

/** 每一档（css2、镜像 1、镜像 2）各自的等待上限。 */
export const DEFAULT_FONT_TIMEOUT_MS = 4000

/** document.fonts.load 的探测样本上限，取配置文字去重后的前若干字。 */
const SAMPLE_LIMIT = 64

const SYSTEM_STACK = [
  'system-ui',
  '-apple-system',
  '"Segoe UI"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  'sans-serif',
].join(', ')

const GENERIC_BY_CATEGORY: Record<FontEntry['category'], string> = {
  'sans-serif': 'sans-serif',
  serif: 'serif',
  display: 'sans-serif',
  handwriting: 'cursive',
  monospace: 'monospace',
  other: 'sans-serif',
}

/** href 到样式表就绪状态的映射，保证同一个 URL 只注入一次。 */
const sheets = new Map<string, Promise<boolean>>()
/** 加载中的请求，key 为 family|weight，让并发调用共享同一个 Promise。 */
const inflight = new Map<string, Promise<FontLoadResult>>()
/** 已就绪的结果，命中后不再走网络。 */
const settled = new Map<string, FontLoadResult>()
const readyFamilies = new Set<string>()
/** 每个 family|weight 已经 document.fonts.load 过的字符，用来判断样本里有没有新字。 */
const loadedChars = new Map<string, Set<string>>()

export function isFontReady(family: string): boolean {
  return readyFamilies.has(family)
}

/** 丢弃内存里的加载状态，注入过的 <link> 不动。测试与切换环境时用。 */
export function resetFontLoaderState(): void {
  sheets.clear()
  inflight.clear()
  settled.clear()
  readyFamilies.clear()
  loadedChars.clear()
}

/** family 含空格或非标识符字符时必须加引号，否则 CSS 解析会截断。 */
export function quoteFamily(family: string): string {
  const name = family.trim()
  if (!name) return ''
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? name : `"${name.replace(/"/g, '')}"`
}

/** 预览与导出共用的 font-family 值：目标字体在前，系统栈兜底。 */
export function fontFamilyCss(config: AvatarConfig): string {
  const quoted = quoteFamily(config.typography.fontFamily)
  if (!quoted) return SYSTEM_STACK
  const entry = getCuratedByFamily(config.typography.fontFamily)
  const generic = entry ? GENERIC_BY_CATEGORY[entry.category] : null
  return generic && generic !== 'sans-serif'
    ? `${quoted}, ${SYSTEM_STACK}, ${generic}`
    : `${quoted}, ${SYSTEM_STACK}`
}

/** 取字体真实提供的字重里离目标最近的一个，偏大优先。 */
export function nearestWeight(available: readonly number[], want: number): number {
  if (available.length === 0) return want
  let best = available[0]!
  for (const w of available) {
    const d = Math.abs(w - want)
    const bd = Math.abs(best - want)
    if (d < bd || (d === bd && w > best)) best = w
  }
  return best
}

/** 配置文字去掉空白并去重后的字符表，顺序即首次出现的顺序。 */
function uniqueChars(text: string): string[] {
  return [...new Set([...text].filter((c) => c.trim().length > 0))]
}

function sampleText(text: string): string {
  const unique = uniqueChars(text).slice(0, SAMPLE_LIMIT).join('')
  // 空文字时也要触发一次加载，用拉丁与 CJK 各一个字符探测
  return unique || 'Aa中'
}

function markLoaded(key: string, chars: Iterable<string>): void {
  let set = loadedChars.get(key)
  if (!set) {
    set = new Set<string>()
    loadedChars.set(key, set)
  }
  for (const c of chars) set.add(c)
}

function withTimeout<T>(task: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false
    const finish = (value: T) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(fallback), ms)
    task.then(finish, () => finish(fallback))
  })
}

/** 注入样式表并等待 load 事件；同一 href 复用既有的等待。 */
function loadStylesheet(href: string): Promise<boolean> {
  const cached = sheets.get(href)
  if (cached) return cached
  const doc = globalThis.document
  if (!doc) {
    const missing = Promise.resolve(false)
    sheets.set(href, missing)
    return missing
  }
  const pending = new Promise<boolean>((resolve) => {
    const link = doc.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.addEventListener('load', () => resolve(true), { once: true })
    link.addEventListener(
      'error',
      () => {
        // 失败的样式表不留缓存，换网络后重试才有机会重新注入
        link.remove()
        sheets.delete(href)
        resolve(false)
      },
      { once: true },
    )
    doc.head.appendChild(link)
  })
  sheets.set(href, pending)
  return pending
}

/**
 * 等一组样式表就绪后确认字形可用。
 * 样式表没进 DOM 前 document.fonts 里没有对应 FontFace，先等 link 再探测。
 */
async function activate(
  hrefs: readonly string[],
  family: string,
  weight: number,
  sample: string,
  timeoutMs: number,
): Promise<boolean> {
  const started = Date.now()
  const sheetResults = await withTimeout(
    Promise.all(hrefs.map((href) => loadStylesheet(href))),
    timeoutMs,
    [],
  )
  if (sheetResults.length === 0 || sheetResults.some((ok) => !ok)) return false

  const set = globalThis.document?.fonts
  // 无 FontFaceSet 的环境（部分 WebView）只能认样式表加载成功
  if (!set) return true

  const remaining = Math.max(200, timeoutMs - (Date.now() - started))
  const faces = await withTimeout<FontFace[] | null>(
    set.load(`${weight} 32px ${quoteFamily(family)}`, sample),
    remaining,
    null,
  )
  if (faces === null) return false
  return faces.length > 0
}

/**
 * 补齐样本里还没加载过的字形。
 * css2 对 CJK 按 unicode-range 切片下发，新字所在的分片必须再 load 一次才会去拉；
 * 首次探测又只取了前 SAMPLE_LIMIT 个字，超出的同样没拉过。
 * 超时或失败不记账，下一次调用还会重试。
 */
async function ensureGlyphs(
  key: string,
  family: string,
  weight: number,
  chars: readonly string[],
  timeoutMs: number,
): Promise<void> {
  const set = globalThis.document?.fonts
  if (!set) return
  const loaded = loadedChars.get(key)
  const missing = loaded ? chars.filter((c) => !loaded.has(c)) : [...chars]
  if (missing.length === 0) return

  const font = `${weight} 32px ${quoteFamily(family)}`
  for (let i = 0; i < missing.length; i += SAMPLE_LIMIT) {
    const chunk = missing.slice(i, i + SAMPLE_LIMIT)
    // 包一层 async，把部分环境里 load 的同步抛错也收进 withTimeout 的回退
    const probe = (async () => {
      await set.load(font, chunk.join(''))
      return true
    })()
    const ok = await withTimeout(probe, timeoutMs, false)
    if (!ok) return
    markLoaded(key, chunk)
  }
}

/** 目录条目优先用调用方给的（来自 fetchCatalog），退到精选清单，再退到按 family 猜 id。 */
function resolveEntry(
  family: string,
  weight: number,
  hint?: FontEntry,
): { id: string; weight: number; version?: string } {
  const entry = hint ?? getCuratedByFamily(family)
  return {
    id: entry ? entry.id : familyToFontsourceId(family),
    weight: entry ? nearestWeight(entry.weights, weight) : weight,
    version: entry?.version,
  }
}

async function loadGoogleFont(
  family: string,
  weight: number,
  sample: string,
  timeoutMs: number,
  hint?: FontEntry,
): Promise<FontLoadResult> {
  const { id, weight: resolved, version } = resolveEntry(family, weight, hint)

  if (await activate([buildCss2Url(family, [resolved])], family, resolved, sample, timeoutMs)) {
    return { family, source: 'google', ok: true }
  }
  for (const host of MIRROR_HOSTS) {
    const urls = buildMirrorCssUrlsForHost(host, id, [resolved], version)
    if (await activate(urls, family, resolved, sample, timeoutMs)) {
      return { family, source: 'mirror', ok: true }
    }
  }
  return { family, source: 'system', ok: false }
}

/**
 * 按配置加载字体。system 不需要网络；upload 查本地注册表；
 * google 走 css2 → cdn.jsdelivr.net → gcore.jsdelivr.net，每档超时 timeoutMs。
 * 缓存只按 family|weight 命中，本次文字里的新字仍要补一次 document.fonts.load，
 * 否则改完文字立刻导出会拿到回退字形。
 */
export function loadFontForConfig(
  config: AvatarConfig,
  opts?: { timeoutMs?: number; entry?: FontEntry },
): Promise<FontLoadResult> {
  const { fontFamily, fontSource, fontWeight } = config.typography

  if (fontSource === 'system') {
    return Promise.resolve({ family: fontFamily, source: 'system', ok: true })
  }
  if (fontSource === 'upload') {
    // 上传字体是整份文件注册进 document.fonts，没有分片，不需要按文字补拉
    const found = getUploadedFont(fontFamily)
    return Promise.resolve(
      found
        ? { family: fontFamily, source: 'upload', ok: true }
        : { family: fontFamily, source: 'system', ok: false },
    )
  }

  const key = `${fontFamily}|${fontWeight}`
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_FONT_TIMEOUT_MS
  const chars = uniqueChars(config.text)

  const done = settled.get(key)
  if (done) {
    return ensureGlyphs(key, fontFamily, fontWeight, chars, timeoutMs).then(() => done)
  }

  let task = inflight.get(key)
  if (!task) {
    const sample = sampleText(config.text)
    task = loadGoogleFont(fontFamily, fontWeight, sample, timeoutMs, opts?.entry)
      .then((result) => {
        // 失败不写 settled，换网络环境后可以重试
        if (result.ok) {
          settled.set(key, result)
          readyFamilies.add(result.family)
          markLoaded(key, sample)
        }
        return result
      })
      .finally(() => {
        inflight.delete(key)
      })
    inflight.set(key, task)
  }

  // 共享 inflight 的调用文字可能不同，各自再补齐自己样本里的字
  return task.then(async (result) => {
    if (result.ok) await ensureGlyphs(key, fontFamily, fontWeight, chars, timeoutMs)
    return result
  })
}
