import { compositionConfig, fillCircleLayout } from './fill'
import { brandGap, stackGap } from './spacing'
import { applyOpticalLayout, type OpticalReport } from './optical'
import type { Graphic } from '@/graphics/types'
import { insideCircle } from './circle'
import { GRAPHIC_MAX, GRAPHIC_REFERENCE, type AvatarConfig } from '@/state/config'
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
  fillScale?: number
  optical?: OpticalReport
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

/**
 * Logo 落位。
 *
 * 带文字时 Logo 占栈顶：先等比放进参照框（安全框全宽 × 安全框高的 GRAPHIC_REFERENCE），
 * 再按 `graphic / GRAPHIC_REFERENCE` 缩放。自动排版的超宽交给整组圆裁缩放，Logo 越大文字越小；
 * 手动字号时整组不缩放，Logo 按安全框宽收边。
 *
 * 纯 Logo 时在安全框里居中，尺寸是圆形安全区内能放下的最大同比例矩形的 `graphic / GRAPHIC_MAX`。
 */
function placeGraphic(
  config: AvatarConfig,
  safeBox: Rect,
  graphic: GraphicSize,
  hasText: boolean,
  short: number,
  auto: boolean,
): { graphicRect: Rect; textArea: Rect } {
  const aspect = graphic.width / Math.max(1, graphic.height)
  // 两向补偿都按安全框算，与逐行文字补偿同一口径：水平看宽，垂直看高
  const shift = safeBox.width * config.layout.graphicOffsetX
  const shiftY = safeBox.height * config.layout.graphicOffsetY

  if (!hasText) {
    // 同比例矩形的半对角线等于半径时正好内接
    const diameter = 2 * short * (0.5 - config.typography.padding)
    const scale = config.layout.graphic / GRAPHIC_MAX / Math.hypot(aspect, 1)
    const gw = diameter * aspect * scale
    const gh = diameter * scale
    return {
      graphicRect: {
        x: safeBox.x + (safeBox.width - gw) / 2 + shift,
        y: safeBox.y + (safeBox.height - gh) / 2 + shiftY,
        width: gw,
        height: gh,
      },
      textArea: { x: safeBox.x, y: safeBox.y, width: safeBox.width, height: 0 },
    }
  }

  const reference = Math.min(safeBox.height * GRAPHIC_REFERENCE, safeBox.width / aspect)
  let gh = reference * (config.layout.graphic / GRAPHIC_REFERENCE)
  let gw = gh * aspect
  if (!auto && gw > safeBox.width) {
    gw = safeBox.width
    gh = gw / aspect
  }
  const gap = brandGap(short, aspect)
  return {
    graphicRect: {
      x: safeBox.x + (safeBox.width - gw) / 2 + shift,
      y: safeBox.y + shiftY,
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
 * 水平居中，整体在可用区域里垂直居中。图标在时文字用掉图标与留白剩下的高度，再紧凑居中整栈，
 * 求解器把两行一起缩到放得下为止，即「合理地缩小之后整体展示出来」。
 *
 * 行级补偿是纯位移：第 i 行只动第 i 行，其余行的像素位置不受影响，水平垂直两向都是这条。
 * 图形补偿同理，挪图形不挤压文字可用区，`textArea` 一律按无补偿算。
 */
function geometricLayoutText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure?: MeasureFn,
  graphic?: GraphicSize | null,
): TextLayout {
  const m = measure ?? getSharedMeasure()
  const safeBox = safeArea(config, width, height)
  const hasText = config.text.trim() !== ''
  const auto = config.typography.line1.size === null && config.typography.line2.size === null

  let graphicRect: Rect | undefined
  let textArea: Rect = safeBox
  if (graphic && config.layout.icon.source !== 'none') {
    const placed = placeGraphic(config, safeBox, graphic, hasText, Math.min(width, height), auto)
    graphicRect = placed.graphicRect
    textArea = placed.textArea
  }

  const fit = fitStack(config, width, height, m, textArea)
  const centerX = textArea.x + textArea.width / 2
  const slack = (textArea.height - fit.height) / 2
  // 图形和文字组成紧凑整体；不把未用完的文字区高度变成图文之间的大缝。
  if (graphicRect && hasText) graphicRect.y += Math.max(0, slack)
  const originY = textArea.y + slack

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
  const positioned: { line: LayoutLine; offset: { x: number; y: number } }[] = []
  for (const { paragraph, top } of paragraphs) {
    const offsetPx = paragraph.offset * width
    const offsetYPx = paragraph.offsetY * height
    paragraph.block.lines.forEach((line, index) => {
      const lineLayout: LayoutLine = {
        text: line.text,
        x: centerX - line.width / 2 + offsetPx,
        y: top + (paragraph.block.baselines[index] ?? 0) + offsetYPx,
        width: line.width,
        ascent: line.ascent,
        descent: line.descent,
        font: line.font,
        fontSizePx: line.fontSizePx,
        letterSpacingPx: line.letterSpacingPx,
      }
      lines.push(lineLayout)
      positioned.push({ line: lineLayout, offset: { x: offsetPx, y: offsetYPx } })
    })
  }

  // Automatic avatars are designed for a circular crop even when exported square.
  // Fit the complete logo/text stack, then reapply manual nudges unchanged.
  let contentScale = 1
  const radius = Math.min(width, height) * (0.5 - config.typography.padding)
  const gx = safeBox.width * config.layout.graphicOffsetX
  const gy = safeBox.height * config.layout.graphicOffsetY
  if (graphicRect && auto) {
    if (lines.length > 0 && lines.length <= 2) {
      const baseGraphic = { ...graphicRect }
      const originals = positioned.map(({ line, offset }) => ({ line, offset, base: { ...line } }))
      const scaleTo = (factor: number) => {
        if (!graphicRect) return
        const logoSpace = brandGap(Math.min(width, height), baseGraphic.width / baseGraphic.height)
        const textSpace =
          lines.length > 1
            ? stackGap(
                Math.min(width, height),
                Math.max(...originals.map(({ base }) => base.fontSizePx)) * factor,
                true,
                config.typography.lineHeight,
              )
            : 0
        const stackHeight =
          (baseGraphic.height +
            originals.reduce((sum, { base }) => sum + base.ascent + base.descent, 0)) *
            factor +
          logoSpace +
          textSpace
        let y = (height - stackHeight) / 2
        graphicRect.width = baseGraphic.width * factor
        graphicRect.height = baseGraphic.height * factor
        graphicRect.x = (width - graphicRect.width) / 2 + gx
        graphicRect.y = y + gy
        y += graphicRect.height + logoSpace
        for (const { line, offset, base } of originals) {
          line.width = base.width * factor
          line.ascent = base.ascent * factor
          line.descent = base.descent * factor
          line.fontSizePx = base.fontSizePx * factor
          line.font = base.font.replace(/[-\d.]+px/, `${line.fontSizePx}px`)
          line.letterSpacingPx = base.letterSpacingPx * factor
          line.x = (width - line.width) / 2 + offset.x
          line.y = y + line.ascent + offset.y
          y += line.ascent + line.descent + textSpace
        }
      }
      const fitsCircle = () => {
        if (!graphicRect) return false
        return [
          { ...graphicRect, x: graphicRect.x - gx, y: graphicRect.y - gy },
          ...positioned.map(({ line, offset }) => ({
            x: line.x - offset.x,
            y: line.y - line.ascent - offset.y,
            width: line.width,
            height: line.ascent + line.descent,
          })),
        ].every((rect) => insideCircle(rect, width / 2, height / 2, radius))
      }
      scaleTo(1)
      if (!fitsCircle()) {
        let lo = 0,
          hi = 1
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2
          scaleTo(mid)
          if (fitsCircle()) lo = mid
          else hi = mid
        }
        contentScale = lo
        scaleTo(lo)
      }
    } else {
      const rects = [
        { ...graphicRect, x: graphicRect.x - gx, y: graphicRect.y - gy },
        ...positioned.map(({ line: l, offset }) => ({
          x: l.x - offset.x,
          y: l.y - l.ascent - offset.y,
          width: l.width,
          height: l.ascent + l.descent,
        })),
      ]
      const extent = Math.max(
        ...rects.map((r) =>
          Math.hypot(
            Math.max(Math.abs(r.x - width / 2), Math.abs(r.x + r.width - width / 2)),
            Math.max(Math.abs(r.y - height / 2), Math.abs(r.y + r.height - height / 2)),
          ),
        ),
      )
      contentScale = Math.min(1, radius / Math.max(1, extent))
      graphicRect.x = width / 2 + (graphicRect.x - gx - width / 2) * contentScale + gx
      graphicRect.y = height / 2 + (graphicRect.y - gy - height / 2) * contentScale + gy
      graphicRect.width *= contentScale
      graphicRect.height *= contentScale
      for (const { line: l, offset } of positioned) {
        l.x = width / 2 + (l.x - offset.x - width / 2) * contentScale + offset.x
        l.y = height / 2 + (l.y - offset.y - height / 2) * contentScale + offset.y
        l.fontSizePx *= contentScale
        l.font = l.font.replace(/[-\d.]+px/, `${l.fontSizePx}px`)
        l.width *= contentScale
        l.ascent *= contentScale
        l.descent *= contentScale
        l.letterSpacingPx *= contentScale
      }
    }
  }
  const cropOverflow = finalOverflow(lines, graphicRect, config, width, height)

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
    fontSizePx: (fit.primary?.fontSizePx ?? 0) * contentScale,
    fontRatio: fit.ratio * contentScale,
    lineHeightPx: (fit.primary?.lineHeightPx ?? 0) * contentScale,
    letterSpacingPx: (fit.primary?.letterSpacingPx ?? 0) * contentScale,
    font: lines[0]?.font ?? '',
    box,
    safeBox,
    pill: pillOf(config, box, fit.primary?.fontSizePx ?? 0),
    // Solver reservations are not final bounds after stacking and manual nudges.
    overflow: cropOverflow,
    graphic: graphicRect,
  }
}

/** Match the displayed guide, including the user's padding after composition. */
function finalOverflow(
  lines: LayoutLine[],
  graphicRect: Rect | undefined,
  config: AvatarConfig,
  width: number,
  height: number,
  measureInk = false,
): boolean {
  const ctx =
    measureInk && typeof document !== 'undefined'
      ? document.createElement('canvas').getContext('2d')
      : null
  const safeBox = safeArea(config, width, height)
  const circleSafe = config.typography.line1.size === null || config.canvas.shape === 'circle'
  const radius = Math.min(width, height) * (0.5 - config.typography.padding)
  return [
    ...lines.map((l) => {
      if (ctx) {
        ctx.font = l.font
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.letterSpacing = `${l.letterSpacingPx}px`
        const m = ctx.measureText(l.text)
        return {
          x: l.x - m.actualBoundingBoxLeft,
          y: l.y - m.actualBoundingBoxAscent,
          width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
        }
      }
      return { x: l.x, y: l.y - l.ascent, width: l.width, height: l.ascent + l.descent }
    }),
    ...(graphicRect ? [graphicRect] : []),
  ].some((r) =>
    circleSafe
      ? !insideCircle(r, width / 2, height / 2, radius)
      : r.x < safeBox.x - 0.01 ||
        r.y < safeBox.y - 0.01 ||
        r.x + r.width > safeBox.x + safeBox.width + 0.01 ||
        r.y + r.height > safeBox.y + safeBox.height + 0.01,
  )
}

export function layoutText(
  config: AvatarConfig,
  width: number,
  height: number,
  measure?: MeasureFn,
  graphic?: GraphicSize | null,
): TextLayout {
  const base = compositionConfig(config)
  const layout = geometricLayoutText(base, width, height, measure, graphic)
  const result = measure
    ? layout
    : fillCircleLayout(
        applyOpticalLayout(
          layout,
          base,
          width,
          height,
          graphic && 'kind' in graphic ? (graphic as Graphic) : null,
          config.typography.line1.size === null || config.canvas.shape === 'circle',
        ),
        config,
        width,
        height,
      )
  return {
    ...result,
    overflow: finalOverflow(result.lines, result.graphic, config, width, height, !measure),
  }
}
