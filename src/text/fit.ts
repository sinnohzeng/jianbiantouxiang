import type { AvatarConfig } from '@/state/config'
import { fontString, letterSpacingPxOf, toGraphemes, type MeasureFn } from './measure'
import { splitParagraphs, toAtoms, wrapLine } from './wrap'

/** 自动填满的搜索区间，与 config 里 fontSize 的取值范围一致。 */
export const MIN_FONT_RATIO = 0.04
export const MAX_FONT_RATIO = 0.92
export const FIT_ITERATIONS = 12

/** 闭式解的探针字号，取 100 便于把测量结果直接当成每 100 px 的比例读。 */
const PROBE_SIZE = 100
const EPS = 1e-3

export interface GlyphMetric {
  char: string
  width: number
}

export interface LineMetric {
  text: string
  width: number
  ascent: number
  descent: number
  /** 竖排时该列逐字的宽度，横排为空数组。 */
  glyphs: GlyphMetric[]
}

export interface TextBlock {
  /** 横排为行，竖排为列。 */
  lines: LineMetric[]
  /** 每行基线相对块顶部的偏移；竖排为每列首字的基线偏移。 */
  baselines: number[]
  width: number
  height: number
  vertical: boolean
  /** 竖排的统一列宽，横排为 0。 */
  columnWidth: number
}

export interface FitResult {
  fontSizePx: number
  lineHeightPx: number
  letterSpacingPx: number
  font: string
  block: TextBlock
  /** 整块是否落在安全框内。 */
  fits: boolean
  safeWidth: number
  safeHeight: number
}

const EMPTY_BLOCK: TextBlock = {
  lines: [],
  baselines: [],
  width: 0,
  height: 0,
  vertical: false,
  columnWidth: 0,
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

function maxOf(values: number[]): number {
  let max = 0
  for (const value of values) if (value > max) max = value
  return max
}

/** 横排：换行后逐行度量，块高按各行墨迹的并集算，避免行高偏小时首尾被切。 */
function composeHorizontal(
  config: AvatarConfig,
  paragraphs: string[],
  fontSizePx: number,
  lineHeightPx: number,
  letterSpacingPx: number,
  font: string,
  safeWidth: number,
  measure: MeasureFn,
): TextBlock {
  const wrapped: string[] = []
  for (const paragraph of paragraphs) {
    if (config.typography.autoWrap) {
      wrapped.push(...wrapLine(paragraph, safeWidth, measure, font, letterSpacingPx))
    } else {
      wrapped.push(paragraph)
    }
  }

  const lines: LineMetric[] = wrapped.map((text) => {
    const metrics = measure(text, font, letterSpacingPx)
    return {
      text,
      width: metrics.width,
      ascent: metrics.ascent,
      descent: metrics.descent,
      glyphs: [],
    }
  })

  if (lines.length === 0) return { ...EMPTY_BLOCK }

  const firstAscent = lines[0]?.ascent ?? fontSizePx
  const raw = lines.map((_, index) => firstAscent + index * lineHeightPx)
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  lines.forEach((line, index) => {
    const baseline = raw[index] ?? 0
    top = Math.min(top, baseline - line.ascent)
    bottom = Math.max(bottom, baseline + line.descent)
  })

  return {
    lines,
    baselines: raw.map((baseline) => baseline - top),
    width: maxOf(lines.map((line) => line.width)),
    height: bottom - top,
    vertical: false,
    columnWidth: 0,
  }
}

/** 竖排：逐字纵向排列，列内字距沿用 letterSpacing，列间距用行高。 */
function composeVertical(
  config: AvatarConfig,
  paragraphs: string[],
  fontSizePx: number,
  lineHeightPx: number,
  letterSpacingPx: number,
  font: string,
  safeHeight: number,
  measure: MeasureFn,
): TextBlock {
  const advance = fontSizePx + letterSpacingPx
  let ascent = 0
  let descent = 0
  let columnWidth = 0

  const measured: GlyphMetric[][] = paragraphs.map((paragraph) =>
    toGraphemes(paragraph).map((char) => {
      const metrics = measure(char, font, 0)
      ascent = Math.max(ascent, metrics.ascent)
      descent = Math.max(descent, metrics.descent)
      columnWidth = Math.max(columnWidth, metrics.width)
      return { char, width: metrics.width }
    }),
  )

  // 一列能放几个字，由安全区高度扣掉首尾墨迹后按字距推算。
  const room = safeHeight - ascent - descent
  const perColumn =
    config.typography.autoWrap && Number.isFinite(safeHeight) && advance > 0
      ? Math.max(1, Math.floor(room / advance) + 1)
      : Number.POSITIVE_INFINITY

  const columns: GlyphMetric[][] = []
  for (const glyphs of measured) {
    if (glyphs.length === 0) {
      columns.push([])
      continue
    }
    const size = Number.isFinite(perColumn) ? perColumn : glyphs.length
    for (let start = 0; start < glyphs.length; start += size) {
      columns.push(glyphs.slice(start, start + size))
    }
  }

  if (columns.length === 0) return { ...EMPTY_BLOCK, vertical: true }

  const lines: LineMetric[] = columns.map((glyphs) => ({
    text: glyphs.map((glyph) => glyph.char).join(''),
    width: columnWidth,
    ascent,
    descent,
    glyphs,
  }))

  const height = maxOf(
    lines.map((line) => ascent + Math.max(0, line.glyphs.length - 1) * advance + descent),
  )

  return {
    lines,
    baselines: lines.map(() => ascent),
    width: Math.max(0, (lines.length - 1) * lineHeightPx) + columnWidth,
    height,
    vertical: true,
    columnWidth,
  }
}

function composeBlock(
  config: AvatarConfig,
  paragraphs: string[],
  fontSizePx: number,
  safeWidth: number,
  safeHeight: number,
  measure: MeasureFn,
): { block: TextBlock; font: string; lineHeightPx: number; letterSpacingPx: number } {
  const font = fontString(config, fontSizePx)
  const lineHeightPx = config.typography.lineHeight * fontSizePx
  const letterSpacingPx = letterSpacingPxOf(config, fontSizePx)
  const block = config.typography.vertical
    ? composeVertical(
        config,
        paragraphs,
        fontSizePx,
        lineHeightPx,
        letterSpacingPx,
        font,
        safeHeight,
        measure,
      )
    : composeHorizontal(
        config,
        paragraphs,
        fontSizePx,
        lineHeightPx,
        letterSpacingPx,
        font,
        safeWidth,
        measure,
      )
  return { block, font, lineHeightPx, letterSpacingPx }
}

/**
 * 排版求解：manual 直接用给定字号，auto 在 [0.04, 0.92] × 短边内二分 12 轮找最大可行字号。
 * 单段文字先用闭式解一步到位，校验通过就不再二分。
 */
export function fitText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
): FitResult {
  const typography = config.typography
  const shortSide = Math.max(1, Math.min(width, height))
  const safeWidth = Math.max(0, width * (1 - 2 * typography.padding))
  const safeHeight = Math.max(0, height * (1 - 2 * typography.padding))
  const paragraphs = splitParagraphs(config.text)

  const build = (ratio: number): FitResult => {
    const fontSizePx = clamp(ratio, MIN_FONT_RATIO, MAX_FONT_RATIO) * shortSide
    const composed = composeBlock(config, paragraphs, fontSizePx, safeWidth, safeHeight, measure)
    return {
      fontSizePx,
      lineHeightPx: composed.lineHeightPx,
      letterSpacingPx: composed.letterSpacingPx,
      font: composed.font,
      block: composed.block,
      fits: composed.block.width <= safeWidth + EPS && composed.block.height <= safeHeight + EPS,
      safeWidth,
      safeHeight,
    }
  }

  if (paragraphs.length === 0 || typography.sizeMode === 'manual') {
    return build(typography.fontSize)
  }

  let high = MAX_FONT_RATIO

  // 还能继续换行时不能走闭式解：拆成多行往往能换来更大的字号，一步到位反而把结果卡死在单行。
  const only = paragraphs[0] ?? ''
  const wrappable =
    typography.autoWrap &&
    (typography.vertical ? toGraphemes(only).length > 1 : toAtoms(only).length > 1)

  if (paragraphs.length === 1 && !wrappable) {
    // 单段且不再换行时，块尺寸随字号线性变化，按探针尺寸算出比例再验证一次。
    const probe = composeBlock(
      config,
      paragraphs,
      PROBE_SIZE,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      measure,
    ).block
    const byWidth = probe.width > 0 ? safeWidth / probe.width : Number.POSITIVE_INFINITY
    const byHeight = probe.height > 0 ? safeHeight / probe.height : Number.POSITIVE_INFINITY
    const scale = Math.min(byWidth, byHeight)
    if (Number.isFinite(scale) && scale > 0) {
      const candidate = clamp((scale * PROBE_SIZE) / shortSide, MIN_FONT_RATIO, MAX_FONT_RATIO)
      const closed = build(candidate)
      if (closed.fits) return closed
      high = candidate
    }
  }

  let low = MIN_FONT_RATIO
  let best = build(MIN_FONT_RATIO)
  for (let i = 0; i < FIT_ITERATIONS; i += 1) {
    const mid = (low + high) / 2
    const candidate = build(mid)
    if (candidate.fits) {
      best = candidate
      low = mid
    } else {
      high = mid
    }
  }
  return best
}
