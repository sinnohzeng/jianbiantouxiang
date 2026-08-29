import type { AvatarConfig } from '@/state/config'

/** 一次测量的结果，ascent 与 descent 取墨迹包围盒，供真实垂直居中使用。 */
export interface TextMetricsLite {
  width: number
  ascent: number
  descent: number
}

/**
 * 排版层唯一的度量入口。做成可注入的函数，是为了让 wrap / fit / layout 全是纯函数，
 * 单测不必依赖浏览器 canvas。
 */
export type MeasureFn = (text: string, font: string, letterSpacingPx: number) => TextMetricsLite

/** 没有真实字体度量时的兜底比例，取 CJK 字面在 em 框里的常见占比。 */
const ASCENT_RATIO = 0.88
const DESCENT_RATIO = 0.22

const CJK_RE =
  /[\u1100-\u11FF\u2E80-\u303F\u3040-\u30FF\u3130-\u318F\u31C0-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|[\u{20000}-\u{3FFFD}]/u

/** 判断是否为需要逐字换行的东亚字符（含全角标点与谚文）。 */
export function isCjk(text: string): boolean {
  return CJK_RE.test(text)
}

let graphemeSegmenter: Intl.Segmenter | null | undefined

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter === undefined) {
    graphemeSegmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null
  }
  return graphemeSegmenter
}

/** 按字素簇切分，emoji 与组合字不会被拆散。 */
export function toGraphemes(text: string): string[] {
  if (!text) return []
  const segmenter = getGraphemeSegmenter()
  if (!segmenter) return Array.from(text)
  const out: string[] = []
  for (const item of segmenter.segment(text)) out.push(item.segment)
  return out
}

/** 把像素值写成合法 CSS 长度，避免极小数被序列化成科学计数法。 */
export function cssPx(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${Math.round(safe * 1000) / 1000}px`
}

/** 家族名之后追加的系统字体链，覆盖三大平台的中日韩与拉丁默认字体。 */
export const SYSTEM_FALLBACK =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

/** 家族名一律加引号：用户可上传任意名字的字体，空格与中文名不加引号会被解析成多个家族。 */
export function quoteFamily(family: string): string {
  const name = family.trim().replace(/["\\]/g, '')
  return name ? `"${name}"` : ''
}

export function fontFamilyStack(family: string): string {
  const head = quoteFamily(family)
  return head ? `${head}, ${SYSTEM_FALLBACK}` : SYSTEM_FALLBACK
}

/** 组装 canvas font 简写：字重 + 字号 + 家族链。 */
export function fontString(config: AvatarConfig, fontSizePx: number): string {
  const weight = Math.round(config.typography.fontWeight)
  return `${weight} ${cssPx(fontSizePx)} ${fontFamilyStack(config.typography.fontFamily)}`
}

/** 字间距按 em 存储，落到像素要乘当前字号。 */
export function letterSpacingPxOf(config: AvatarConfig, fontSizePx: number): number {
  return config.typography.letterSpacing * fontSizePx
}

const FONT_SIZE_RE = /(-?\d*\.?\d+)px/

function fontSizeOf(font: string): number {
  const matched = FONT_SIZE_RE.exec(font)
  const size = matched ? Number(matched[1]) : Number.NaN
  return Number.isFinite(size) && size > 0 ? size : 16
}

function pickMetric(actual: number | undefined, fallbackBox: number | undefined, approx: number) {
  if (typeof actual === 'number' && Number.isFinite(actual) && actual > 0) return actual
  if (typeof fallbackBox === 'number' && Number.isFinite(fallbackBox) && fallbackBox > 0) {
    return fallbackBox
  }
  return approx
}

function fromTextMetrics(metrics: TextMetrics, fontSizePx: number, width: number) {
  return {
    width: Number.isFinite(width) ? width : 0,
    ascent: pickMetric(
      metrics.actualBoundingBoxAscent,
      metrics.fontBoundingBoxAscent,
      fontSizePx * ASCENT_RATIO,
    ),
    descent: pickMetric(
      metrics.actualBoundingBoxDescent,
      metrics.fontBoundingBoxDescent,
      fontSizePx * DESCENT_RATIO,
    ),
  }
}

const NARROW_CHARS = new Set(Array.from('ijltIfr.,;:!|\'"`()[]{}'))
const WIDE_CHARS = new Set(Array.from('MWmw@%'))

/**
 * 无 canvas 时的近似度量：按字符类别给出 em 占比。
 * 只保证排版流程不中断，导出前浏览器一定会走真实度量。
 */
export function createApproxMeasure(): MeasureFn {
  return (text, font, letterSpacingPx) => {
    const size = fontSizeOf(font)
    const graphemes = toGraphemes(text)
    let width = 0
    for (const grapheme of graphemes) {
      if (isCjk(grapheme)) width += size
      else if (grapheme === ' ') width += size * 0.28
      else if (NARROW_CHARS.has(grapheme)) width += size * 0.32
      else if (WIDE_CHARS.has(grapheme)) width += size * 0.86
      else width += size * 0.55
    }
    return {
      width: width + spacingBetween(letterSpacingPx, graphemes.length),
      ascent: size * ASCENT_RATIO,
      descent: size * DESCENT_RATIO,
    }
  }
}

/** 字距只落在字与字之间，末字之后不计，保证宽度等于墨迹跨度。 */
function spacingBetween(letterSpacingPx: number, count: number): number {
  const spacing = Number.isFinite(letterSpacingPx) ? letterSpacingPx : 0
  return spacing * Math.max(0, count - 1)
}

function createScratchContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  try {
    return document.createElement('canvas').getContext('2d')
  } catch {
    return null
  }
}

function supportsLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx
}

/**
 * 探测实现是否在末字之后也补一份字距。CSS letter-spacing 的定义是每字之后都加，
 * 各引擎在 canvas 上的取舍不一致，测一次再扣掉多出的那份，宽度才等于墨迹跨度。
 */
function probeTrailingSpacing(ctx: CanvasRenderingContext2D): number {
  const saved = ctx.letterSpacing
  try {
    ctx.letterSpacing = '0px'
    const base = ctx.measureText('M').width
    ctx.letterSpacing = '100px'
    const spaced = ctx.measureText('M').width
    return spaced - base > 50 ? 1 : 0
  } catch {
    return 0
  } finally {
    ctx.letterSpacing = saved
  }
}

/**
 * 浏览器度量。优先用原生 letterSpacing，缺失时逐字累加再补字距。
 * 不传 ctx 时自建一块离屏画布；连 2D 上下文都拿不到就退到近似度量。
 */
export function createCanvasMeasure(ctx?: CanvasRenderingContext2D | null): MeasureFn {
  const target = ctx ?? createScratchContext()
  if (!target) return createApproxMeasure()
  const native = supportsLetterSpacing(target)
  let trailing: number | null = null

  return (text, font, letterSpacingPx) => {
    const size = fontSizeOf(font)
    target.font = font
    const spacing = Number.isFinite(letterSpacingPx) ? letterSpacingPx : 0

    if (!text) {
      return { width: 0, ascent: size * ASCENT_RATIO, descent: size * DESCENT_RATIO }
    }

    if (spacing === 0) {
      const metrics = target.measureText(text)
      return fromTextMetrics(metrics, size, metrics.width)
    }

    if (native) {
      if (trailing === null) trailing = probeTrailingSpacing(target)
      target.letterSpacing = cssPx(spacing)
      const metrics = target.measureText(text)
      target.letterSpacing = '0px'
      return fromTextMetrics(metrics, size, metrics.width - spacing * trailing)
    }

    const graphemes = toGraphemes(text)
    let width = 0
    let ascent = 0
    let descent = 0
    for (const grapheme of graphemes) {
      const metrics = target.measureText(grapheme)
      const lite = fromTextMetrics(metrics, size, metrics.width)
      width += lite.width
      ascent = Math.max(ascent, lite.ascent)
      descent = Math.max(descent, lite.descent)
    }
    return { width: width + spacingBetween(spacing, graphemes.length), ascent, descent }
  }
}
