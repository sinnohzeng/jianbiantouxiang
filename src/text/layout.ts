import type { Anchor, AvatarConfig } from '@/state/config'
import { fitStatus, fitText, fitTextInArea, safeArea, type FitResult } from './fit'
import { createCanvasMeasure, type MeasureFn } from './measure'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutGlyph {
  char: string
  /** 绘制原点的左边缘。 */
  x: number
  /** 基线。 */
  y: number
  width: number
}

export interface LayoutLine {
  text: string
  /** 行左边缘，绘制时 textAlign 取 left。 */
  x: number
  /** 基线。 */
  y: number
  width: number
  ascent: number
  descent: number
  /** 竖排时逐字的位置，横排为空数组。 */
  glyphs: LayoutGlyph[]
  /**
   * 这一行自己的字号档。缺省时用 layout 那一层的值。状态徽章的次行比首行小，
   * 三个字段要一起给：字体简写决定字形，字号决定效果的尺度，字距决定逐字补偿的步长。
   */
  font?: string
  fontSizePx?: number
  letterSpacingPx?: number
}

export interface PillRect extends Rect {
  radiusPx: number
}

export interface GraphicSize {
  width: number
  height: number
}

export interface TextLayout {
  lines: LayoutLine[]
  fontSizePx: number
  lineHeightPx: number
  letterSpacingPx: number
  /** canvas font 简写，绘制时直接用，省一次拼装。 */
  font: string
  /** 文字整体包围盒。 */
  box: Rect
  /** 边距扣完后的安全框。 */
  safeBox: Rect
  /** 胶囊底板矩形。 */
  pill: PillRect
  vertical: boolean
  align: 'left' | 'center' | 'right'
  /** 文字超出安全框，界面据此提示。 */
  overflow: boolean
  /** 图标徽章里图形的落位；纯文字与状态徽章没有这块。 */
  graphic?: Rect
}

const ANCHOR_X: Record<Anchor, number> = {
  tl: 0,
  l: 0,
  bl: 0,
  t: 0.5,
  c: 0.5,
  b: 0.5,
  tr: 1,
  r: 1,
  br: 1,
}

const ANCHOR_Y: Record<Anchor, number> = {
  tl: 0,
  t: 0,
  tr: 0,
  l: 0.5,
  c: 0.5,
  r: 0.5,
  bl: 1,
  b: 1,
  br: 1,
}

let sharedMeasure: MeasureFn | null = null

function getSharedMeasure(): MeasureFn {
  if (!sharedMeasure) sharedMeasure = createCanvasMeasure()
  return sharedMeasure
}

function alignFactor(align: 'left' | 'center' | 'right'): number {
  return align === 'left' ? 0 : align === 'center' ? 0.5 : 1
}

/**
 * 把一个求解好的块落到 (originX, originY)，产出可直接绘制的行。
 * `sized` 给状态徽章的次行用：它与首行不同号，绘制时要按行换一套字号。
 */
function placeBlock(
  config: AvatarConfig,
  fit: FitResult,
  originX: number,
  originY: number,
  sized = false,
): LayoutLine[] {
  const typography = config.typography
  const block = fit.block
  const factor = alignFactor(typography.align)
  const advance = fit.fontSizePx + fit.letterSpacingPx

  const lines: LayoutLine[] = block.vertical
    ? block.lines.map((column, index) => {
        // 首列在最右，列序沿 -x 方向推进。
        const left = originX + block.width - block.columnWidth - index * fit.lineHeightPx
        const columnHeight =
          column.ascent + Math.max(0, column.glyphs.length - 1) * advance + column.descent
        const baseline = originY + (block.height - columnHeight) * factor + column.ascent
        return {
          text: column.text,
          x: left,
          y: baseline,
          width: block.columnWidth,
          ascent: column.ascent,
          descent: column.descent,
          glyphs: column.glyphs.map((glyph, order) => ({
            char: glyph.char,
            x: left + (block.columnWidth - glyph.width) / 2,
            y: baseline + order * advance,
            width: glyph.width,
          })),
        }
      })
    : block.lines.map((line, index) => ({
        text: line.text,
        x: originX + (block.width - line.width) * factor + (line.offsetX ?? 0),
        y: originY + (block.baselines[index] ?? 0),
        width: line.width,
        ascent: line.ascent,
        descent: line.descent,
        font: line.font,
        fontSizePx: line.fontSizePx,
        letterSpacingPx: line.letterSpacingPx,
        glyphs: [],
      }))

  if (!sized) return lines
  return lines.map((line) => ({
    ...line,
    font: fit.font,
    fontSizePx: fit.fontSizePx,
    letterSpacingPx: fit.letterSpacingPx,
  }))
}

/** 图标徽章里图形与文字之间的留白，按安全框高度算。 */
const LOGO_GAP_RATIO = 0.06

/** 胶囊底板：把整块文字按 pill.padding 外扩，圆角按短边算。 */
function pillOf(config: AvatarConfig, box: Rect, fontSizePx: number): PillRect {
  const pad = config.typography.pill.padding * fontSizePx
  const rect: PillRect = {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
    radiusPx: 0,
  }
  rect.radiusPx = config.typography.pill.radius * Math.min(rect.width, rect.height)
  return rect
}

/** 纯文字用途：锚点、偏移、对齐、竖排全都生效，这是 v3 的原有行为。 */
function layoutPlain(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
): TextLayout {
  const typography = config.typography
  const fit = fitText(config, width, height, measure)
  const block = fit.block
  const safeBox: Rect = safeArea(config, width, height)

  const originX =
    safeBox.x +
    (safeBox.width - block.width) * ANCHOR_X[typography.anchor] +
    typography.offsetX * width
  const originY =
    safeBox.y +
    (safeBox.height - block.height) * ANCHOR_Y[typography.anchor] +
    typography.offsetY * height

  const box: Rect = { x: originX, y: originY, width: block.width, height: block.height }
  return {
    lines: placeBlock(config, fit, originX, originY),
    fontSizePx: fit.fontSizePx,
    lineHeightPx: fit.lineHeightPx,
    letterSpacingPx: fit.letterSpacingPx,
    font: fit.font,
    box,
    safeBox,
    pill: pillOf(config, box, fit.fontSizePx),
    vertical: block.vertical,
    align: typography.align,
    overflow: !fit.fits,
  }
}

/**
 * 状态徽章：首行大字压次行小字，整体在安全框里居中。
 * 锚点与偏移在这个用途下不生效，版式写死才谈得上一批图观感统一。
 */
function layoutStatus(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
): TextLayout {
  const safeBox: Rect = safeArea(config, width, height)
  const fit = fitStatus(config, width, height, measure, safeBox)

  const originX = safeBox.x + (safeBox.width - fit.width) / 2
  const originY = safeBox.y + (safeBox.height - fit.height) / 2
  // 两块各自在整体宽度里居中，次行短的时候不会靠着左边
  const headX = originX + (fit.width - fit.primary.block.width) / 2
  const lines = placeBlock(config, fit.primary, headX, originY)

  if (fit.secondary) {
    const tailX = originX + (fit.width - fit.secondary.block.width) / 2
    const tailY = originY + fit.primary.block.height + fit.gapPx
    lines.push(...placeBlock(config, fit.secondary, tailX, tailY, true))
  }

  const box: Rect = { x: originX, y: originY, width: fit.width, height: fit.height }
  return {
    lines,
    fontSizePx: fit.primary.fontSizePx,
    lineHeightPx: fit.primary.lineHeightPx,
    letterSpacingPx: fit.primary.letterSpacingPx,
    font: fit.primary.font,
    box,
    safeBox,
    pill: pillOf(config, box, fit.primary.fontSizePx),
    vertical: false,
    align: config.typography.align,
    overflow: !fit.fits,
  }
}

/**
 * 图标徽章：图形在上，文字在下。图形尺寸由来源的真实宽高比决定，
 * 求解器只拿到一个 GraphicSize，不认识它是 Path2D 还是 Image。
 */
function layoutBadge(
  config: AvatarConfig,
  width: number,
  height: number,
  measure: MeasureFn,
  graphic?: GraphicSize | null,
): TextLayout {
  const safeBox: Rect = safeArea(config, width, height)
  const flat: AvatarConfig = {
    ...config,
    typography: {
      ...config.typography,
      align: 'center',
      anchor: 'c',
      offsetX: 0,
      offsetY: 0,
      vertical: false,
      autoWrap: true,
      lineSizeScales: [],
      lineOffsetsX: [],
    },
  }
  const hasText = config.text.trim() !== ''
  let graphicRect: Rect | undefined
  let textArea: Rect = safeBox
  let bottomAlign = false

  if (graphic) {
    const aspect = graphic.width / Math.max(1, graphic.height)
    if (hasText) {
      let gh = safeBox.height * config.layout.graphic
      let gw = gh * aspect
      if (gw > safeBox.width) {
        gw = safeBox.width
        gh = gw / aspect
      }
      graphicRect = {
        x: safeBox.x + (safeBox.width - gw) / 2,
        y: safeBox.y,
        width: gw,
        height: gh,
      }
      textArea = {
        x: safeBox.x,
        y: safeBox.y + gh + safeBox.height * LOGO_GAP_RATIO,
        width: safeBox.width,
        height: Math.max(0, safeBox.height - gh - safeBox.height * LOGO_GAP_RATIO),
      }
      bottomAlign = true
    } else {
      let side = Math.min(safeBox.width, safeBox.height) * config.layout.graphic
      let gw = side * aspect
      if (gw > safeBox.width) {
        gw = safeBox.width
        side = gw / aspect
      }
      if (side > safeBox.height) {
        side = safeBox.height
        gw = side * aspect
      }
      graphicRect = {
        x: safeBox.x + (safeBox.width - gw) / 2,
        y: safeBox.y + (safeBox.height - side) / 2,
        width: gw,
        height: side,
      }
      textArea = { x: safeBox.x, y: safeBox.y, width: safeBox.width, height: 0 }
    }
  }

  const fit = fitTextInArea(flat, width, height, measure, textArea)
  const block = fit.block
  const originX = textArea.x + (textArea.width - block.width) / 2
  const originY = bottomAlign
    ? textArea.y + textArea.height - block.height
    : textArea.y + (textArea.height - block.height) / 2
  const lines = block.lines.length > 0 ? placeBlock(flat, fit, originX, originY) : []
  const box: Rect =
    block.lines.length > 0
      ? { x: originX, y: originY, width: block.width, height: block.height }
      : (graphicRect ?? { x: safeBox.x, y: safeBox.y, width: 0, height: 0 })

  return {
    lines,
    fontSizePx: fit.fontSizePx,
    lineHeightPx: fit.lineHeightPx,
    letterSpacingPx: fit.letterSpacingPx,
    font: fit.font,
    box,
    safeBox,
    pill: pillOf(config, box, fit.fontSizePx),
    vertical: false,
    align: 'center',
    overflow:
      !fit.fits ||
      (graphicRect !== undefined &&
        (graphicRect.x < safeBox.x - 1e-6 ||
          graphicRect.y < safeBox.y - 1e-6 ||
          graphicRect.x + graphicRect.width > safeBox.x + safeBox.width + 1e-6 ||
          graphicRect.y + graphicRect.height > safeBox.y + safeBox.height + 1e-6)),
    graphic: graphicRect,
  }
}

/**
 * 排版求解加落位，按用途分派。基线用度量得到的 ascent / descent 定，
 * 所以是墨迹意义上的居中，不是 em 框意义上的居中。
 */
export function layoutText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure?: MeasureFn,
  graphic?: GraphicSize | null,
): TextLayout {
  const m = measure ?? getSharedMeasure()
  if (config.layout.kind === 'status') return layoutStatus(config, width, height, m)
  if (config.layout.kind === 'logo') return layoutBadge(config, width, height, m, graphic)
  return layoutPlain(config, width, height, m)
}
