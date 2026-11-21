import { automaticGroup } from './fill'
import { graphicInkFraction } from './optical'
import { brandGap, stackGap } from './spacing'
import { LINE_SIZE_MAX, twoLinesOf, type AvatarConfig } from '@/state/config'
import type { Graphic } from '@/graphics/types'
import type { Rect, TextLayout } from './layout'

/** Maximise automatic text against final ink constraints, keeping the chosen logo size.
 * Intrinsic brand clearspace already separates logo ink from text; do not add it twice.
 * Manual sizes/nudges and effects with extra painted bounds keep their existing contract.
 */
export function optimizeAutomaticText(
  layout: TextLayout,
  config: AvatarConfig,
  width: number,
  height: number,
  graphic: Graphic | null,
): TextLayout {
  if (
    !automaticGroup(config) ||
    !['plain', 'shadow'].includes(config.typography.effect) ||
    layout.overflow ||
    layout.lines.length === 0 ||
    layout.lines.length > 2 ||
    layout.lines.length !== twoLinesOf(config.text).filter(Boolean).length ||
    typeof document === 'undefined'
  )
    return layout
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return layout
  const short = Math.min(width, height)
  // Half a source pixel protects raster rounding at the analytical circle boundary.
  const radius = short * (0.5 - config.typography.padding) - 0.5
  const frame = layout.graphic
  const ink =
    frame && graphic
      ? graphicInkFraction(graphic, {
          ...config,
          typography: { ...config.typography, effect: 'plain' },
        })
      : null
  const bottomInset = frame && ink ? frame.height * (1 - ink.y - ink.height) : 0
  const gap = frame ? Math.max(0, brandGap(short, frame.width / frame.height) - bottomInset) : 0
  const base = layout.lines[0]!.fontSizePx
  const candidate = (size: number) => {
    let y = frame ? frame.height + gap : 0
    const boxes: Rect[] = frame
      ? [{ x: (width - frame.width) / 2, y: 0, width: frame.width, height: frame.height }]
      : []
    const lines = layout.lines.map((line, index) => {
      const fontSizePx = (size * line.fontSizePx) / base
      const font = line.font.replace(/[-\d.]+px/, `${fontSizePx}px`)
      const letterSpacingPx = config.typography.letterSpacing * fontSizePx
      ctx.font = font
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.letterSpacing = `${letterSpacingPx}px`
      const m = ctx.measureText(line.text)
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      const x = (width - w) / 2
      boxes.push({ x, y, width: w, height: h })
      const result = {
        ...line,
        font,
        fontSizePx,
        letterSpacingPx,
        width: w,
        ascent: m.actualBoundingBoxAscent,
        descent: m.actualBoundingBoxDescent,
        x: x + m.actualBoundingBoxLeft,
        y: y + m.actualBoundingBoxAscent,
      }
      y += h
      if (index < layout.lines.length - 1)
        y += stackGap(
          short,
          Math.max(...layout.lines.map((l) => (size * l.fontSizePx) / base)),
          !!frame,
          config.typography.lineHeight,
        )
      return result
    })
    // Intersect the feasible vertical translations for every actual text box and logo frame.
    const visibleTop = frame && ink ? ink.y * frame.height : 0
    const centered = height / 2 - (visibleTop + y) / 2
    const drift = frame ? short * 0.035 : 0
    let low = centered - drift,
      high = centered + drift
    for (const box of boxes) {
      const dx = Math.max(Math.abs(box.x - width / 2), Math.abs(box.x + box.width - width / 2))
      if (dx > radius) return null
      const half = Math.sqrt(radius * radius - dx * dx)
      low = Math.max(low, height / 2 - half - box.y)
      high = Math.min(high, height / 2 + half - box.y - box.height)
    }
    if (low > high) return null
    const shift = Math.max(low, Math.min(high, centered))
    for (const line of lines) line.y += shift
    return {
      lines,
      optimization: { fontGain: size / base, centerShiftY: shift - centered, logoGap: gap },
      graphic: frame ? { ...frame, x: (width - frame.width) / 2, y: shift } : undefined,
    }
  }
  let best = candidate(base)
  if (!best) return layout
  let low = base,
    high = LINE_SIZE_MAX * short
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2
    const next = candidate(mid)
    if (next) {
      best = next
      low = mid
    } else high = mid
  }
  if (low < base + 0.01) return layout
  const rects = best.lines.map((l) => ({
    x: (width - l.width) / 2,
    y: l.y - l.ascent,
    width: l.width,
    height: l.ascent + l.descent,
  }))
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y))
  const box = {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  }
  return {
    ...layout,
    ...best,
    box,
    fontSizePx: low,
    fontRatio: low / short,
    font: best.lines[0]!.font,
    lineHeightPx: low * config.typography.lineHeight,
    letterSpacingPx: best.lines[0]!.letterSpacingPx,
  }
}
