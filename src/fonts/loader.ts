/**
 * 字体加载：按行加载。`fontJobs` 给出“哪款字体要画哪些字”，两行同一款字体时合并成一条；
 * 每款字体走 css2 主链路，超时后依次降级到两个 jsDelivr 镜像，全失败回系统字体。
 * 文字绘制必须等 document.fonts.load 就绪，否则 canvas 会用回退字形出图。
 * 加载状态都以 `fontKey` 为键，来源、family、字重任一不同就是另一款字体。
 */

import {
  fontKey,
  lineFont,
  nearestWeight,
  twoLinesOf,
  type AvatarConfig,
  type FontChoice,
} from '@/state/config'
import { findFontEntry } from './catalog'
import { fontString } from './family'
import {
  MIRROR_HOSTS,
  buildCss2Url,
  buildMirrorCssUrlsForHost,
  familyToFontsourceId,
} from './google'
import { getUploadedFont } from './upload'

/** 实际走的通道：google 与 mirror 是网络加载成功，system 是系统字体或回落，upload 是本地注册表。 */
export type FontLoadVia = 'google' | 'mirror' | 'system' | 'upload'

export interface FontLoadResult {
  /** 输入的那款字体，界面据它的 source 选提示文案。 */
  font: FontChoice
  via: FontLoadVia
  ok: boolean
}

/** 一款字体与它要画的字。 */
export interface FontJob {
  font: FontChoice
  text: string
}

/** 每一档（css2、镜像 1、镜像 2）各自的等待上限。 */
export const DEFAULT_FONT_TIMEOUT_MS = 4000

/** document.fonts.load 的探测样本上限，取文字去重后的前若干字。 */
const SAMPLE_LIMIT = 64

/** document.fonts.load 用的字号，只影响匹配，不影响取到的字形。 */
const PROBE_PX = 32

/** href 到样式表就绪状态的映射，保证同一个 URL 只注入一次。 */
const sheets = new Map<string, Promise<boolean>>()
/** 加载中的请求，让并发调用共享同一个 Promise。 */
const inflight = new Map<string, Promise<FontLoadResult>>()
/** 已就绪的网络字体，命中后不再走网络。 */
const settled = new Map<string, FontLoadResult>()
/** 每款字体已经 document.fonts.load 过的字符，用来判断文字里有没有新字。 */
const loadedChars = new Map<string, Set<string>>()

/** 丢弃内存里的加载状态，注入过的 <link> 不动。测试与切换环境时用。 */
export function resetFontLoaderState(): void {
  sheets.clear()
  inflight.clear()
  settled.clear()
  loadedChars.clear()
}

/**
 * 哪款字体要画哪些字：有文字的行按生效字体归组，同一款字体的两行文字合并。
 * 第二行钉了别款字体但没有文字时不加载它。两行都空时给第一行字体，由探测样本触发加载。
 */
export function fontJobs(config: AvatarConfig): FontJob[] {
  const t = config.typography
  const jobs = new Map<string, FontJob>()
  twoLinesOf(config.text).forEach((text, index) => {
    if (text === '') return
    const font = lineFont(t, index === 0 ? 1 : 2)
    const key = fontKey(font)
    const job = jobs.get(key)
    if (job) job.text += text
    else jobs.set(key, { font, text })
  })
  return jobs.size > 0 ? [...jobs.values()] : [{ font: t.line1.font, text: '' }]
}

/** 文字去掉空白并去重后的字符表，顺序即首次出现的顺序。 */
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
  font: Pick<FontChoice, 'family' | 'weight'>,
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
    set.load(fontString(font, PROBE_PX), sample),
    remaining,
    null,
  )
  if (faces === null) return false
  return faces.length > 0
}

/**
 * 补齐文字里还没加载过的字形，确实加载了新字时返回 true。
 * css2 对 CJK 按 unicode-range 切片下发，新字所在的分片必须再 load 一次才会去拉；
 * 首次探测又只取了前 SAMPLE_LIMIT 个字，超出的同样没拉过。
 * 超时或失败不记账，下一次调用还会重试。
 */
async function ensureGlyphs(
  key: string,
  font: FontChoice,
  chars: readonly string[],
  timeoutMs: number,
): Promise<boolean> {
  const set = globalThis.document?.fonts
  if (!set) return false
  const loaded = loadedChars.get(key)
  const missing = loaded ? chars.filter((c) => !loaded.has(c)) : [...chars]
  if (missing.length === 0) return false

  const shorthand = fontString(font, PROBE_PX)
  let changed = false
  for (let i = 0; i < missing.length; i += SAMPLE_LIMIT) {
    const chunk = missing.slice(i, i + SAMPLE_LIMIT)
    // 包一层 async，把部分环境里 load 的同步抛错也收进 withTimeout 的回退
    const probe = (async () => {
      await set.load(shorthand, chunk.join(''))
      return true
    })()
    const ok = await withTimeout(probe, timeoutMs, false)
    if (!ok) return changed
    markLoaded(key, chunk)
    changed = true
  }
  return changed
}

/** 目录条目同步查，查不到时按 family 猜 fontsource id，字重原样请求。 */
function resolveEntry(font: FontChoice): {
  id: string
  weight: FontChoice['weight']
  version?: string
} {
  const entry = findFontEntry(font.family)
  if (!entry) return { id: familyToFontsourceId(font.family), weight: font.weight }
  return { id: entry.id, weight: nearestWeight(entry.weights, font.weight), version: entry.version }
}

async function loadGoogleFont(
  font: FontChoice,
  sample: string,
  timeoutMs: number,
): Promise<FontLoadResult> {
  const { id, weight, version } = resolveEntry(font)
  const face = { family: font.family, weight }

  if (await activate([buildCss2Url(font.family, [weight])], face, sample, timeoutMs)) {
    return { font, via: 'google', ok: true }
  }
  for (const host of MIRROR_HOSTS) {
    const urls = buildMirrorCssUrlsForHost(host, id, [weight], version)
    if (await activate(urls, face, sample, timeoutMs)) {
      return { font, via: 'mirror', ok: true }
    }
  }
  return { font, via: 'system', ok: false }
}

/**
 * 加载一款字体。system 不需要网络；upload 查本地注册表；
 * google 走 css2 → cdn.jsdelivr.net → fastly.jsdelivr.net，每档超时 timeoutMs。
 * 缓存按 fontKey 命中，本次文字里的新字仍要补一次 document.fonts.load，
 * 否则改完文字立刻导出会拿到回退字形。
 */
function loadFont(job: FontJob, timeoutMs: number): Promise<FontLoadResult> {
  const { font } = job

  if (font.source === 'system') {
    return Promise.resolve({ font, via: 'system', ok: true })
  }
  if (font.source === 'upload') {
    // 上传字体是整份文件注册进 document.fonts，没有分片，不需要按文字补拉
    const ok = getUploadedFont(font.family) !== undefined
    return Promise.resolve({ font, via: ok ? 'upload' : 'system', ok })
  }

  const key = fontKey(font)
  const chars = uniqueChars(job.text)

  const done = settled.get(key)
  if (done) {
    return ensureGlyphs(key, font, chars, timeoutMs).then(() => done)
  }

  let task = inflight.get(key)
  if (!task) {
    const sample = sampleText(job.text)
    task = loadGoogleFont(font, sample, timeoutMs)
      .then((result) => {
        // 失败不写 settled，换网络环境后可以重试
        if (result.ok) {
          settled.set(key, result)
          markLoaded(key, sample)
        }
        return result
      })
      .finally(() => {
        inflight.delete(key)
      })
    inflight.set(key, task)
  }

  // 共享 inflight 的调用文字可能不同，各自再补齐自己文字里的字
  return task.then(async (result) => {
    if (result.ok) await ensureGlyphs(key, font, chars, timeoutMs)
    return result
  })
}

/** 按配置并行加载每款要用的字体，每款返回一条结果，顺序同 `fontJobs`。 */
export function loadFontsForConfig(
  config: AvatarConfig,
  opts?: { timeoutMs?: number },
): Promise<FontLoadResult[]> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_FONT_TIMEOUT_MS
  return Promise.all(fontJobs(config).map((job) => loadFont(job, timeoutMs)))
}

/**
 * 给已就绪的网络字体补上文字里新出现的字，确实补到新字时返回 true，画布据此重绘一次。
 * 未就绪或加载失败的字体不发 load。
 */
export async function topUpGlyphs(config: AvatarConfig): Promise<boolean> {
  const changed = await Promise.all(
    fontJobs(config).map((job) => {
      const key = fontKey(job.font)
      if (!settled.has(key)) return false
      return ensureGlyphs(key, job.font, uniqueChars(job.text), DEFAULT_FONT_TIMEOUT_MS)
    }),
  )
  return changed.includes(true)
}
