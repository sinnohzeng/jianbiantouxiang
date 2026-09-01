import { STATUS_GAP_RATIO, STATUS_SECOND_LINE_SCALE, type AvatarConfig } from '@/state/config'
import { fontString, letterSpacingPxOf, type MeasureFn } from './measure'
import { twoLinesOf, wrapLineParts } from './wrap'

/** 自动填满的搜索区间，与 config 里 fontSize 的取值范围一致。 */
export const MIN_FONT_RATIO = 0.04
export const MAX_FONT_RATIO = 0.92
export const FIT_ITERATIONS = 12

const EPS = 1e-3

export interface LineMetric {
  text: string
  width: number
  ascent: number
  descent: number
  /** 这一行自己的字号档：栈模型里每段字号不同，绘制时按行换字体简写。 */
  font: string
  fontSizePx: number
  letterSpacingPx: number
}

/** 只关心尺寸的方框。Rect 定义在 layout.ts，那边反过来引本文件，这里不绕这个圈。 */
export interface Box {
  width: number
  height: number
}

export interface TextBlock {
  /** 换行时把某个拉丁词硬拆开了。自动填满据此回避这一档字号。 */
  broke: boolean
  lines: LineMetric[]
  /** 每行基线相对块顶部的偏移。 */
  baselines: number[]
  width: number
  height: number
}

/** 单段（第一行或第二行）的排版结果。 */
export interface ParagraphFit {
  block: TextBlock
  /** 实际字号：基准字号 × 行级比例。 */
  fontSizePx: number
  lineHeightPx: number
  letterSpacingPx: number
  font: string
  /** 水平补偿，画布宽比例。落位时纯位移，只动自己这一段。 */
  offset: number
  /** 这一段在预留补偿余量后是否放得进安全区。 */
  fits: boolean
}

/** 栈求解结果：主行、次行、两者留白与合计尺寸。 */
export interface StackFit {
  primary: ParagraphFit | null
  /** 没有第二行时是 null，画面退化成单行。 */
  secondary: ParagraphFit | null
  gapPx: number
  width: number
  height: number
  fits: boolean
  safeWidth: number
  safeHeight: number
}

const EMPTY_BLOCK: TextBlock = { broke: false, lines: [], baselines: [], width: 0, height: 0 }

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

/**
 * 单段横排：在去掉补偿余量后的宽度里换行并度量。
 * 块高按各行墨迹的并集算，避免行高偏小时首尾被切。
 */
function composeParagraph(
  config: AvatarConfig,
  text: string,
  fontSizePx: number,
  maxWidth: number,
  measure: MeasureFn,
): TextBlock {
  if (text === '') return { ...EMPTY_BLOCK }
  const font = fontString(config, fontSizePx)
  const letterSpacingPx = letterSpacingPxOf(config, fontSizePx)
  const parts = wrapLineParts(text, maxWidth, measure, font, letterSpacingPx)

  const lines: LineMetric[] = parts.lines.map((line) => {
    const metrics = measure(line, font, letterSpacingPx)
    return {
      text: line,
      width: metrics.width,
      ascent: metrics.ascent,
      descent: metrics.descent,
      font,
      fontSizePx,
      letterSpacingPx,
    }
  })

  if (lines.length === 0) return { ...EMPTY_BLOCK }

  const raw: number[] = []
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  lines.forEach((line, index) => {
    const previous = lines[index - 1]
    const advance =
      index === 0 ? 0 : Math.max(previous?.fontSizePx ?? fontSizePx, line.fontSizePx) * config.typography.lineHeight
    const baseline = (raw[index - 1] ?? 0) + advance + (index === 0 ? line.ascent : 0)
    raw.push(baseline)
    top = Math.min(top, baseline - line.ascent)
    bottom = Math.max(bottom, baseline + line.descent)
  })

  return {
    broke: parts.broke,
    lines,
    baselines: raw.map((baseline) => baseline - top),
    width: Math.max(...lines.map((line) => line.width)),
    height: bottom - top,
  }
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

interface Slot {
  text: string
  scale: number
  offset: number
}

/**
 * 栈模型的排版求解。
 *
 * 第一行是基准字号，第二行恒等于基准乘第二行的行级比例，二分只搜基准。
 * 两个都放开会有无穷多组解落在安全框里，出图就不稳定了。
 * 第一行为空、第二行有内容时晋升主行按满比例渲染，参数不跟槽位走。
 *
 * 水平补偿在求解阶段只用来预留宽度余量：居中落位加偏移后要留在安全区内，
 * 等价于段宽不超过「安全区宽 − 2 × |补偿| × 画布宽」。落位时的位移见 layout 层。
 */
export function fitStack(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
  area?: Box,
): StackFit {
  const shortSide = Math.max(1, Math.min(width, height))
  const box = area ?? safeArea(config, width, height)
  const typography = config.typography
  const [line1, line2] = twoLinesOf(config.text)

  const slots: Slot[] = []
  if (line1 === '' && line2 !== '') {
    slots.push({ text: line2, scale: 1, offset: typography.lineOffsetsX[1] ?? 0 })
  } else if (line1 !== '') {
    slots.push({
      text: line1,
      scale: typography.lineSizeScales[0] ?? 1,
      offset: typography.lineOffsetsX[0] ?? 0,
    })
    if (line2 !== '') {
      slots.push({
        text: line2,
        scale: typography.lineSizeScales[1] ?? STATUS_SECOND_LINE_SCALE,
        offset: typography.lineOffsetsX[1] ?? 0,
      })
    }
  }

  const empty: StackFit = {
    primary: null,
    secondary: null,
    gapPx: 0,
    width: 0,
    height: 0,
    fits: true,
    safeWidth: box.width,
    safeHeight: box.height,
  }
  if (slots.length === 0) return empty

  const build = (ratio: number): StackFit => {
    const baseSize = clamp(ratio, MIN_FONT_RATIO, MAX_FONT_RATIO) * shortSide
    const parts = slots.map((slot): ParagraphFit => {
      const fontSizePx = baseSize * slot.scale
      const offsetRoom = 2 * Math.abs(slot.offset) * width
      const maxWidth = Math.max(1, box.width - offsetRoom)
      const block = composeParagraph(config, slot.text, fontSizePx, maxWidth, measure)
      return {
        block,
        fontSizePx,
        lineHeightPx: typography.lineHeight * fontSizePx,
        letterSpacingPx: letterSpacingPxOf(config, fontSizePx),
        font: fontString(config, fontSizePx),
        offset: slot.offset,
        fits: block.width <= maxWidth + EPS,
      }
    })
    const primary = parts[0] ?? null
    const secondary = parts[1] ?? null
    const gapPx = primary && secondary ? primary.fontSizePx * STATUS_GAP_RATIO : 0
    const blockWidth = Math.max(primary?.block.width ?? 0, secondary?.block.width ?? 0)
    const blockHeight =
      (primary?.block.height ?? 0) + gapPx + (secondary?.block.height ?? 0)
    return {
      primary,
      secondary,
      gapPx,
      width: blockWidth,
      height: blockHeight,
      fits:
        (primary?.fits ?? true) &&
        (secondary?.fits ?? true) &&
        blockWidth <= box.width + EPS &&
        blockHeight <= box.height + EPS,
      safeWidth: box.width,
      safeHeight: box.height,
    }
  }

  if (typography.sizeMode === 'manual') return build(typography.fontSize)

  /**
   * 严格档要求两件事：没把哪个拉丁词从中间劈开，且主行没换行。
   *
   * 主行是徽章的主体，「请假中」被折成「请假」加「中」比小一号难看得多，
   * 而二分只认「更大」，不加这一条它会一路放大到刚好折行的那个尺寸。
   * 放不下的长主行没有满足这一条的解，自动落到宽松档，与拆词那条同一个兜底。
   */
  const tidy = (fit: StackFit): boolean =>
    !(fit.primary?.block.broke ?? false) &&
    !(fit.secondary?.block.broke ?? false) &&
    (fit.primary?.block.lines.length ?? 0) <= 1

  const search = (strict: boolean): StackFit => {
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
