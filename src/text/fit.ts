import { STATUS_GAP_RATIO, STATUS_SECOND_LINE_SCALE, type AvatarConfig } from '@/state/config'
import { fontString, letterSpacingPxOf, toGraphemes, type MeasureFn } from './measure'
import { splitParagraphs, wrapLineParts } from './wrap'

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
  /** 行级字号启用时的字体简写；竖排与统一字号时缺省。 */
  font?: string
  fontSizePx?: number
  letterSpacingPx?: number
  /** 相对块左边缘的水平补偿，已归一到最小补偿为 0。 */
  offsetX?: number
  /** 竖排时该列逐字的宽度，横排为空数组。 */
  glyphs: GlyphMetric[]
}

/** 只关心尺寸的方框。Rect 定义在 layout.ts，那边反过来引本文件，这里不绕这个圈。 */
export interface Box {
  width: number
  height: number
}

export interface TextBlock {
  /** 换行时把某个拉丁词硬拆开了。自动填满据此回避这一档字号。 */
  broke: boolean
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
  broke: false,
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

function lineScaleOf(config: AvatarConfig, index: number): number {
  return config.typography.lineSizeScales[index] ?? 1
}

function lineOffsetOf(config: AvatarConfig, index: number): number {
  return config.typography.lineOffsetsX[index] ?? 0
}

/** 横排：换行后逐行度量，块高按各行墨迹的并集算，避免行高偏小时首尾被切。 */
function composeHorizontal(
  config: AvatarConfig,
  paragraphs: string[],
  fontSizePx: number,
  safeWidth: number,
  canvasWidth: number,
  measure: MeasureFn,
  sizeScales: readonly number[],
  offsetsX: readonly number[],
): TextBlock {
  const offsets = paragraphs.map((_, index) => (offsetsX[index] ?? 0) * canvasWidth)
  const minOffset = offsets.length > 0 ? Math.min(...offsets) : 0
  const maxOffset = offsets.length > 0 ? Math.max(...offsets) : 0
  const offsetRoom = maxOffset - minOffset
  const maxWidth = Math.max(1, safeWidth - offsetRoom)
  const wrapped: Array<{ text: string; paragraph: number }> = []
  let broke = false
  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (config.typography.autoWrap) {
      const lineFontSizePx = fontSizePx * (sizeScales[paragraphIndex] ?? 1)
      const lineFont = fontString(config, lineFontSizePx)
      const lineLetterSpacingPx = letterSpacingPxOf(config, lineFontSizePx)
      const parts = wrapLineParts(paragraph, maxWidth, measure, lineFont, lineLetterSpacingPx)
      wrapped.push(...parts.lines.map((text) => ({ text, paragraph: paragraphIndex })))
      broke ||= parts.broke
    } else {
      wrapped.push({ text: paragraph, paragraph: paragraphIndex })
    }
  })

  const lines: LineMetric[] = wrapped.map(({ text, paragraph }) => {
    const lineFontSizePx = fontSizePx * (sizeScales[paragraph] ?? 1)
    const lineFont = fontString(config, lineFontSizePx)
    const lineLetterSpacingPx = letterSpacingPxOf(config, lineFontSizePx)
    const metrics = measure(text, lineFont, lineLetterSpacingPx)
    return {
      text,
      width: metrics.width,
      ascent: metrics.ascent,
      descent: metrics.descent,
      font: lineFont,
      fontSizePx: lineFontSizePx,
      letterSpacingPx: lineLetterSpacingPx,
      offsetX: (offsets[paragraph] ?? 0) - minOffset,
      glyphs: [],
    }
  })

  if (lines.length === 0) return { ...EMPTY_BLOCK }

  const raw: number[] = []
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  lines.forEach((line, index) => {
    const previous = lines[index - 1]
    const advance =
      index === 0
        ? 0
        : Math.max(previous?.fontSizePx ?? fontSizePx, line.fontSizePx ?? fontSizePx) *
          config.typography.lineHeight
    const baseline = (raw[index - 1] ?? 0) + advance + (index === 0 ? line.ascent : 0)
    raw.push(baseline)
    top = Math.min(top, baseline - line.ascent)
    bottom = Math.max(bottom, baseline + line.descent)
  })

  return {
    lines,
    baselines: raw.map((baseline) => baseline - top),
    width: maxOf(lines.map((line) => (line.offsetX ?? 0) + line.width)),
    height: bottom - top,
    vertical: false,
    columnWidth: 0,
    broke,
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
    // 竖排逐字排列，没有「词」可拆
    broke: false,
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
  canvasWidth: number,
  sizeScales?: readonly number[],
  offsetsX?: readonly number[],
): { block: TextBlock; font: string; lineHeightPx: number; letterSpacingPx: number } {
  const font = fontString(config, fontSizePx)
  const lineHeightPx = config.typography.lineHeight * fontSizePx
  const letterSpacingPx = letterSpacingPxOf(config, fontSizePx)
  const scales = sizeScales ?? paragraphs.map((_, index) => lineScaleOf(config, index))
  const offsets = offsetsX ?? paragraphs.map((_, index) => lineOffsetOf(config, index))
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
        safeWidth,
        canvasWidth,
        measure,
        scales,
        offsets,
      )
  return { block, font, lineHeightPx, letterSpacingPx }
}

/**
 * 画布形状对文字安全框的收缩系数：把边距算出来的方框按原比例缩到四角正好压在遮罩边界上。
 *
 * 遮罩是圆角矩形（圆形即圆角拉满那一档），约束只在角上：
 * 角点越过圆心 (cx, cy) 所在的那一格之后，要满足到圆心的距离不超过圆角半径。
 * 方框本来就没碰到圆角就返回 1，方角与常规圆角走的都是这一支，几何原样不动。
 */
function shapeFitScale(
  config: AvatarConfig,
  width: number,
  height: number,
  halfW: number,
  halfH: number,
): number {
  const { shape, radius } = config.canvas
  const short = Math.min(width, height)
  let r: number
  let cx: number
  let cy: number
  if (shape === 'circle') {
    // 非正方形画布上遮罩是内接圆不是椭圆，见 compose-core 的 clipShape
    r = short / 2
    cx = 0
    cy = 0
  } else if (shape === 'rounded') {
    r = Math.min(radius * short, short / 2)
    if (r <= 0) return 1
    cx = width / 2 - r
    cy = height / 2 - r
  } else {
    return 1
  }

  const dx = halfW - cx
  const dy = halfH - cy
  if (dx <= 0 || dy <= 0) return 1
  if (dx * dx + dy * dy <= r * r) return 1

  // (t·halfW - cx)² + (t·halfH - cy)² = r²，取较大的根就是角点正好落在圆弧上的那一档
  const a = halfW * halfW + halfH * halfH
  if (a <= 0) return 1
  const b = -2 * (halfW * cx + halfH * cy)
  const c = cx * cx + cy * cy - r * r
  const disc = b * b - 4 * a * c
  if (disc < 0) return 1
  return clamp((-b + Math.sqrt(disc)) / (2 * a), 0, 1)
}

/**
 * 文字安全框：先按边距内缩，再收进遮罩里。
 *
 * 只按边距算的方框四角会落在圆形遮罩外面，圆形头像上多行文字的首尾字会被直接切掉。
 * 所以这一步按原比例把方框缩到四角贴着圆弧，圆角矩形同理，方角与小圆角不受影响。
 */
export function safeArea(
  config: AvatarConfig,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const { padding } = config.typography
  const halfW = Math.max(0, (width * (1 - 2 * padding)) / 2)
  const halfH = Math.max(0, (height * (1 - 2 * padding)) / 2)
  const scale = shapeFitScale(config, width, height, halfW, halfH)
  const w = halfW * 2 * scale
  const h = halfH * 2 * scale
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }
}

/**
 * 在给定矩形里求解文字。图标徽章要先把上部让给图形，再把剩余矩形交给这一层；
 * 纯文字与状态徽章仍先按边距与遮罩算安全框，再走同一个求解器。
 */
export function fitTextInArea(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
  area: Box,
): FitResult {
  const typography = config.typography
  const shortSide = Math.max(1, Math.min(width, height))
  const safeWidth = area.width
  const safeHeight = area.height
  const paragraphs = splitParagraphs(config.text)

  const build = (ratio: number): FitResult => {
    const fontSizePx = clamp(ratio, MIN_FONT_RATIO, MAX_FONT_RATIO) * shortSide
    const composed = composeBlock(
      config,
      paragraphs,
      fontSizePx,
      safeWidth,
      safeHeight,
      measure,
      width,
    )
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
  // 横排的判据不能只看有几个词：一个超长的拉丁词也能拆成字素换行，
  // 按「只有一个词就不可换行」算，它会被钉死在单行放得下的那个字号上，白白小一大截。
  const only = paragraphs[0] ?? ''
  const wrappable = typography.autoWrap && toGraphemes(only).length > 1

  if (paragraphs.length === 1 && !wrappable) {
    // 单段且不再换行时，块尺寸随字号线性变化，按探针尺寸算出比例再验证一次。
    const probe = composeBlock(
      config,
      paragraphs,
      PROBE_SIZE,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      measure,
      width,
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

  /**
   * 二分找最大可行字号。`strict` 那一轮把「拆过词」也算不可行：
   * 拉丁词从中间断开在头像上很扎眼，退一档字号换个完整的词更好看。
   */
  const search = (strict: boolean): FitResult => {
    let low = MIN_FONT_RATIO
    let bound = high
    let best = build(MIN_FONT_RATIO)
    for (let i = 0; i < FIT_ITERATIONS; i += 1) {
      const mid = (low + bound) / 2
      const candidate = build(mid)
      if (candidate.fits && !(strict && candidate.block.broke)) {
        best = candidate
        low = mid
      } else {
        bound = mid
      }
    }
    return best
  }

  const strict = search(true)
  // 最小字号都得拆词，说明这个词本来就放不下，那就别再为它压字号
  return strict.block.broke ? search(false) : strict
}

/**
 * 排版求解：manual 直接用给定字号，auto 在 [0.04, 0.92] × 短边内二分 12 轮找最大可行字号。
 */
export function fitText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
): FitResult {
  return fitTextInArea(config, width, height, measure, safeArea(config, width, height))
}

/** 状态徽章的求解结果：首行、次行、两者之间的留白，以及合起来的尺寸。 */
export interface StatusFit {
  primary: FitResult
  /** 次行为空时是 null，画面退化成单行。 */
  secondary: FitResult | null
  gapPx: number
  width: number
  height: number
  fits: boolean
  safeWidth: number
  safeHeight: number
}

/**
 * 状态徽章的排版求解。
 *
 * 首行字号与次行字号只有一个自由度：次行恒等于首行乘第二行的行级比例，
 * 二分只搜首行。两个都放开会有无穷多组解落在安全框里，出图就不稳定了。
 * 竖排在这个用途下没有意义，强制横排；锚点与偏移同理，版式写死在居中。
 */
export function fitStatus(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
  area?: Box,
): StatusFit {
  const shortSide = Math.max(1, Math.min(width, height))
  const box = area ?? safeArea(config, width, height)
  const flat: AvatarConfig = {
    ...config,
    typography: { ...config.typography, vertical: false },
  }
  const paragraphs = splitParagraphs(config.text)
  const head = paragraphs.slice(0, 1)
  const rest = paragraphs.slice(1)
  const primaryScale = config.typography.lineSizeScales[0] ?? 1
  const secondaryScale =
    config.typography.lineSizeScales[1] ?? STATUS_SECOND_LINE_SCALE
  const primaryOffset = config.typography.lineOffsetsX[0] ?? 0
  const secondaryOffset = config.typography.lineOffsetsX[1] ?? 0

  const part = (paras: string[], fontSizePx: number, scale: number, offset: number): FitResult => {
    const composed = composeBlock(
      flat,
      paras,
      fontSizePx,
      box.width,
      box.height,
      measure,
      width,
      paras.map(() => scale),
      paras.map(() => offset),
    )
    const firstLine = composed.block.lines[0]
    return {
      fontSizePx: fontSizePx * scale,
      lineHeightPx: composed.lineHeightPx,
      letterSpacingPx: firstLine?.letterSpacingPx ?? composed.letterSpacingPx,
      font: firstLine?.font ?? composed.font,
      block: composed.block,
      fits: composed.block.width <= box.width + EPS,
      safeWidth: box.width,
      safeHeight: box.height,
    }
  }

  const build = (ratio: number): StatusFit => {
    const primarySize = clamp(ratio, MIN_FONT_RATIO, MAX_FONT_RATIO) * shortSide
    const primary = part(head, primarySize, primaryScale, primaryOffset)
    const secondary =
      rest.length > 0 ? part(rest, primarySize, secondaryScale, secondaryOffset) : null
    const gapPx = secondary ? primarySize * primaryScale * STATUS_GAP_RATIO : 0
    const blockWidth = Math.max(primary.block.width, secondary?.block.width ?? 0)
    const blockHeight = primary.block.height + gapPx + (secondary?.block.height ?? 0)
    return {
      primary,
      secondary,
      gapPx,
      width: blockWidth,
      height: blockHeight,
      fits: blockWidth <= box.width + EPS && blockHeight <= box.height + EPS,
      safeWidth: box.width,
      safeHeight: box.height,
    }
  }

  if (paragraphs.length === 0 || config.typography.sizeMode === 'manual') {
    return build(config.typography.fontSize)
  }

  /**
   * 严格档要求两件事：没把哪个拉丁词从中间劈开，且首行没换行。
   *
   * 首行是状态词，「请假中」被折成「请假」加「中」比小一号难看得多，
   * 而二分只认「更大」，不加这一条它会一路放大到刚好折行的那个尺寸。
   * 放不下的长首行没有满足这一条的解，自动落到宽松档，与拆词那条同一个兜底。
   */
  const tidy = (fit: StatusFit): boolean =>
    !fit.primary.block.broke &&
    !(fit.secondary?.block.broke ?? false) &&
    fit.primary.block.lines.length <= 1

  const search = (strict: boolean): StatusFit => {
    let low = MIN_FONT_RATIO
    let high = MAX_FONT_RATIO
    let best = build(MIN_FONT_RATIO)
    for (let i = 0; i < FIT_ITERATIONS; i += 1) {
      const mid = (low + high) / 2
      const candidate = build(mid)
      if (candidate.fits && !(strict && !tidy(candidate))) {
        best = candidate
        low = mid
      } else {
        high = mid
      }
    }
    return best
  }

  const strict = search(true)
  return tidy(strict) ? strict : search(false)
}
