import type { AvatarConfig } from '@/state/config'
import { fitStack, safeArea, type ParagraphFit } from './fit'
import { createCanvasMeasure, type MeasureFn } from './measure'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutLine {
  text: string
  /** 绘制原点的左边缘。 */
  x: number
  /** 基线。 */
  y: number
  width: number
  ascent: number
  descent: number
  /** 这一行自己的字号档：栈模型里每段字号不同，绘制时按行换字体简写。 */
  font: string
  fontSizePx: number
  letterSpacingPx: number
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
  /** 基准字号按画布短边的比例，自动档求解出来的值；界面用它做「拖一下就切手动」的起点。 */
  fontRatio: number
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
  /** 文字超出安全框，界面据此提示。 */
  overflow: boolean
  /** 栈顶图形的落位；没有图标时缺省。 */
  graphic?: Rect
}

let sharedMeasure: MeasureFn | null = null

function getSharedMeasure(): MeasureFn {
  if (!sharedMeasure) sharedMeasure = createCanvasMeasure()
  return sharedMeasure
}

/** 图标与文字之间的留白，按安全框高度算。 */
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

/** 图标落位：有文字时占安全框顶部，纯图标时在安全框里居中。 */
function placeGraphic(
  config: AvatarConfig,
  safeBox: Rect,
  graphic: GraphicSize,
  hasText: boolean,
): { graphicRect: Rect; textArea: Rect } {
  const aspect = graphic.width / Math.max(1, graphic.height)
  // 水平补偿按安全框宽度算，与逐行文字补偿同一口径
  const shift = safeBox.width * config.layout.graphicOffsetX

  if (!hasText) {
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
    return {
      graphicRect: {
        x: safeBox.x + (safeBox.width - gw) / 2 + shift,
        y: safeBox.y + (safeBox.height - side) / 2,
        width: gw,
        height: side,
      },
      textArea: { x: safeBox.x, y: safeBox.y, width: safeBox.width, height: 0 },
    }
  }

  let gh = safeBox.height * config.layout.graphic
  let gw = gh * aspect
  if (gw > safeBox.width) {
    gw = safeBox.width
    gh = gw / aspect
  }
  const gap = safeBox.height * LOGO_GAP_RATIO
  return {
    graphicRect: {
      x: safeBox.x + (safeBox.width - gw) / 2 + shift,
      y: safeBox.y,
      width: gw,
      height: gh,
    },
    textArea: {
      x: safeBox.x,
      y: safeBox.y + gh + gap,
      width: safeBox.width,
      height: Math.max(0, safeBox.height - gh - gap),
    },
  }
}

/**
 * v4 唯一的版式：一个纵向栈，自顶向下「图标（可选）→ 第一行（可选）→ 第二行（可选）」，
 * 水平居中，整体在可用区域里垂直居中。图标在时文字用掉图标与留白剩下的高度，
 * 求解器把两行一起缩到放得下为止，即「合理地缩小之后整体展示出来」。
 *
 * 行级水平补偿是纯位移：第 i 行只动第 i 行，其余行的像素位置不受影响。
 */
export function layoutText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure?: MeasureFn,
  graphic?: GraphicSize | null,
): TextLayout {
  const m = measure ?? getSharedMeasure()
  const safeBox = safeArea(config, width, height)
  const hasText = config.text.trim() !== ''

  let graphicRect: Rect | undefined
  let textArea: Rect = safeBox
  if (graphic && config.layout.icon.source !== 'none') {
    const placed = placeGraphic(config, safeBox, graphic, hasText)
    graphicRect = placed.graphicRect
    textArea = placed.textArea
  }

  const fit = fitStack(config, width, height, m, textArea)
  const centerX = textArea.x + textArea.width / 2
  const originY = textArea.y + (textArea.height - fit.height) / 2

  const paragraphs: { paragraph: ParagraphFit; top: number }[] = []
  let cursor = originY
  if (fit.primary) {
    paragraphs.push({ paragraph: fit.primary, top: cursor })
    cursor += fit.primary.block.height + fit.gapPx
  }
  if (fit.secondary) {
    paragraphs.push({ paragraph: fit.secondary, top: cursor })
  }

  const lines: LayoutLine[] = []
  for (const { paragraph, top } of paragraphs) {
    const offsetPx = paragraph.offset * width
    paragraph.block.lines.forEach((line, index) => {
      lines.push({
        text: line.text,
        x: centerX - line.width / 2 + offsetPx,
        y: top + (paragraph.block.baselines[index] ?? 0),
        width: line.width,
        ascent: line.ascent,
        descent: line.descent,
        font: line.font,
        fontSizePx: line.fontSizePx,
        letterSpacingPx: line.letterSpacingPx,
      })
    })
  }

  let box: Rect
  if (lines.length > 0) {
    const left = Math.min(...lines.map((line) => line.x))
    const top = Math.min(...lines.map((line) => line.y - line.ascent))
    const right = Math.max(...lines.map((line) => line.x + line.width))
    const bottom = Math.max(...lines.map((line) => line.y + line.descent))
    box = { x: left, y: top, width: right - left, height: bottom - top }
  } else {
    box = graphicRect ?? { x: safeBox.x, y: safeBox.y, width: 0, height: 0 }
  }

  return {
    lines,
    fontSizePx: fit.primary?.fontSizePx ?? 0,
    fontRatio: fit.ratio,
    lineHeightPx: fit.primary?.lineHeightPx ?? 0,
    letterSpacingPx: fit.primary?.letterSpacingPx ?? 0,
    font: fit.primary?.font ?? '',
    box,
    safeBox,
    pill: pillOf(config, box, fit.primary?.fontSizePx ?? 0),
    overflow: !fit.fits,
    graphic: graphicRect,
  }
}
