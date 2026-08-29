import type { Anchor, AvatarConfig } from '@/state/config'
import { fitText, safeArea } from './fit'
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
}

export interface PillRect extends Rect {
  radiusPx: number
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
 * 排版求解 + 落位。基线用度量得到的 ascent / descent 定，所以是墨迹意义上的居中，
 * 不是 em 框意义上的居中。
 */
export function layoutText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure?: MeasureFn,
): TextLayout {
  const typography = config.typography
  const fit = fitText(config, width, height, measure ?? getSharedMeasure())
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
        x: originX + (block.width - line.width) * factor,
        y: originY + (block.baselines[index] ?? 0),
        width: line.width,
        ascent: line.ascent,
        descent: line.descent,
        glyphs: [],
      }))

  const box: Rect = { x: originX, y: originY, width: block.width, height: block.height }
  const pad = typography.pill.padding * fit.fontSizePx
  const pillRect: PillRect = {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
    radiusPx: 0,
  }
  pillRect.radiusPx = typography.pill.radius * Math.min(pillRect.width, pillRect.height)

  return {
    lines,
    fontSizePx: fit.fontSizePx,
    lineHeightPx: fit.lineHeightPx,
    letterSpacingPx: fit.letterSpacingPx,
    font: fit.font,
    box,
    safeBox,
    pill: pillRect,
    vertical: block.vertical,
    align: typography.align,
    overflow: !fit.fits,
  }
}
