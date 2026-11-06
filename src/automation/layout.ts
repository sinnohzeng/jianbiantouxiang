import { brandGap, titleGap } from '@/text/spacing'
import { AUTO_LOGO_LINE2_SCALE } from '@/state/config'
import { insideCircle } from '@/text/circle'
import type { Rect, TextLayout, LayoutLine } from '@/text/layout'

export interface InkMetrics {
  left: number
  right: number
  ascent: number
  descent: number
}
export type InkMeasure = (text: string, size: number) => InkMetrics

/** Single physical line per field, predictable caps, centered visible ink (not advance width). */
export function badgeLayout(
  size: number,
  padding: number,
  logoScale: number,
  texts: [string, string],
  graphic: { width: number; height: number } | null,
  measure: InkMeasure,
  safeShape: 'circle' | 'square' = 'circle',
  family = 'Noto Sans SC',
  weight = 700,
): TextLayout {
  const inset = size * padding
  const safeBox = { x: inset, y: inset, width: size - 2 * inset, height: size - 2 * inset }
  const logoGap = graphic ? brandGap(size, graphic.width / graphic.height) : 0
  const textGap = () =>
    graphic ? titleGap(size, Math.max(...lines.map((l) => l.fontSizePx), 0)) : size * 0.035
  const gapsHeight = () =>
    (graphicRect && lines.length ? logoGap : 0) + Math.max(0, lines.length - 1) * textGap()
  const inkWidth = safeBox.width - size * 0.02
  const lines: LayoutLine[] = []
  let graphicRect: Rect | undefined
  if (graphic) {
    const maxHeight = texts.some(Boolean) ? safeBox.height * logoScale : safeBox.height * 0.94
    const scale = Math.min(maxHeight / graphic.height, (safeBox.width * 0.96) / graphic.width)
    graphicRect = {
      x: (size - graphic.width * scale) / 2,
      y: 0,
      width: graphic.width * scale,
      height: graphic.height * scale,
    }
  }
  texts.forEach((text, index) => {
    if (!text) return
    let fontSize = size * (index === 0 || !texts[0] || !graphic ? 0.6 : 0.6 * AUTO_LOGO_LINE2_SCALE)
    let metrics = measure(text, fontSize)
    if (metrics.left + metrics.right > inkWidth) {
      let lo = 0,
        hi = fontSize
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2,
          m = measure(text, mid)
        if (m.left + m.right <= inkWidth) lo = mid
        else hi = mid
      }
      fontSize = lo
      metrics = measure(text, fontSize)
    }
    lines.push({
      text,
      x: (size + metrics.left - metrics.right) / 2,
      y: 0,
      width: metrics.left + metrics.right,
      ascent: metrics.ascent,
      descent: metrics.descent,
      font: `${weight} ${fontSize}px "${family}"`,
      fontSizePx: fontSize,
      letterSpacingPx: 0,
    })
  })
  const first = lines[0],
    second = lines[1]
  if (first && second) {
    const sharedSize = Math.min(first.fontSizePx, second.fontSizePx)
    for (const line of graphic ? [second] : [first, second]) {
      const fontSize = graphic
        ? Math.min(second.fontSizePx, first.fontSizePx * AUTO_LOGO_LINE2_SCALE)
        : sharedSize
      const m = measure(line.text, fontSize)
      Object.assign(line, {
        fontSizePx: fontSize,
        font: `${weight} ${fontSize}px "${family}"`,
        x: (size + m.left - m.right) / 2,
        width: m.left + m.right,
        ascent: m.ascent,
        descent: m.descent,
      })
    }
  }
  const stackHeight = () =>
    (graphicRect?.height ?? 0) + lines.reduce((n, l) => n + l.ascent + l.descent, 0) + gapsHeight()
  for (let i = 0; i < 4 && stackHeight() > safeBox.height - size * 0.02; i++) {
    const fixed = (graphicRect?.height ?? 0) + gapsHeight()
    const factor = ((safeBox.height - size * 0.02 - fixed) / (stackHeight() - fixed)) * 0.98
    for (const line of lines) {
      line.fontSizePx *= factor
      const m = measure(line.text, line.fontSizePx)
      Object.assign(line, {
        font: `${weight} ${line.fontSizePx}px "${family}"`,
        x: (size + m.left - m.right) / 2,
        width: m.left + m.right,
        ascent: m.ascent,
        descent: m.descent,
      })
    }
  }
  // Keep the whole foreground stack centered. Uniformly fit its actual rectangles
  // to the circular crop, retaining title/subtitle hierarchy and logo proportions.
  const settle = () => {
    let y = (size - stackHeight()) / 2
    if (graphicRect) {
      graphicRect.y = y
      y += graphicRect.height + logoGap
    }
    for (const l of lines) {
      l.y = y + l.ascent
      y += l.ascent + l.descent + textGap()
    }
  }
  const cropFits = () => {
    const rects = lines.map((l) => {
      const m = measure(l.text, l.fontSizePx)
      return { x: l.x - m.left, y: l.y - l.ascent, width: l.width, height: l.ascent + l.descent }
    })
    if (graphicRect) rects.push(graphicRect)
    return rects.every(
      (r) =>
        contains(safeBox, r) &&
        (safeShape === 'square' || insideCircle(r, size / 2, size / 2, size * (0.5 - padding))),
    )
  }
  settle()
  if (!cropFits()) {
    const originals = lines.map((line) => ({ line, fontSize: line.fontSizePx }))
    const baseGraphic = graphicRect ? { ...graphicRect } : null
    const scaleTo = (factor: number) => {
      if (graphicRect && baseGraphic) {
        graphicRect.width = baseGraphic.width * factor
        graphicRect.height = baseGraphic.height * factor
        graphicRect.x = (size - graphicRect.width) / 2
      }
      for (const { line: l, fontSize } of originals) {
        l.fontSizePx = fontSize * factor
        const m = measure(l.text, l.fontSizePx)
        Object.assign(l, {
          x: (size + m.left - m.right) / 2,
          width: m.left + m.right,
          ascent: m.ascent,
          descent: m.descent,
          font: `${weight} ${l.fontSizePx}px "${family}"`,
        })
      }
      settle()
    }
    let low = 0,
      high = 1
    for (let i = 0; i < 16; i++) {
      const mid = (low + high) / 2
      scaleTo(mid)
      if (cropFits()) low = mid
      else high = mid
    }
    scaleTo(low)
  }
  const boxes = lines.map((l) => {
    const m = measure(l.text, l.fontSizePx)
    return { x: l.x - m.left, y: l.y - l.ascent, width: l.width, height: l.ascent + l.descent }
  })
  const box = boxes.length ? union(boxes) : { x: size / 2, y: size / 2, width: 0, height: 0 }
  return {
    lines,
    box,
    safeBox,
    graphic: graphicRect,
    fontSizePx: lines[0]?.fontSizePx ?? 0,
    fontRatio: (lines[0]?.fontSizePx ?? 0) / size,
    lineHeightPx: 0,
    letterSpacingPx: 0,
    font: lines[0]?.font ?? '',
    pill: { ...box, radiusPx: 0 },
    overflow: !cropFits(),
  }
}

export function contains(outer: Rect, inner: Rect): boolean {
  const eps = 0.01
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.y + inner.height <= outer.y + outer.height + eps
  )
}

function union(boxes: Rect[]): Rect {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  }
}
