import { insideCircle } from './circle'
import type { TextLayout, Rect } from './layout'
import type { AvatarConfig } from '@/state/config'

export function automaticGroup(config: AvatarConfig): boolean {
  const { line1, line2 } = config.typography
  return (
    line1.size === null &&
    line2.size === null &&
    ![
      line1.offsetX,
      line1.offsetY,
      line2.offsetX,
      line2.offsetY,
      config.layout.graphicOffsetX,
      config.layout.graphicOffsetY,
    ].some(Boolean)
  )
}

/**
 * Keep the approved internal composition; use extra circle space only in the final scale.
 * 纯 Logo 没有图文组可保持，尺寸直接按用户边距的圆形安全区算。
 */
export function compositionConfig(config: AvatarConfig): AvatarConfig {
  return automaticGroup(config) &&
    config.text.trim() !== '' &&
    ['plain', 'shadow'].includes(config.typography.effect) &&
    config.typography.padding < 0.06
    ? { ...config, typography: { ...config.typography, padding: 0.06 } }
    : config
}

/** Uniformly enlarge the finished group. Real font metrics guard every candidate. */
export function fillCircleLayout(
  layout: TextLayout,
  config: AvatarConfig,
  width: number,
  height: number,
): TextLayout {
  if (
    !automaticGroup(config) ||
    layout.lines.length === 0 ||
    layout.overflow ||
    typeof document === 'undefined' ||
    !['plain', 'shadow'].includes(config.typography.effect)
  )
    return layout
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return layout
  const cx = width / 2,
    cy = height / 2,
    short = Math.min(width, height)
  const radius = short * (0.5 - config.typography.padding)
  const transform = (r: Rect, s: number): Rect => ({
    x: cx + (r.x - cx) * s,
    y: cy + (r.y - cy) * s,
    width: r.width * s,
    height: r.height * s,
  })
  const candidate = (s: number) => {
    const lines = layout.lines.map((l) => {
      const next = {
        ...l,
        x: cx + (l.x - cx) * s,
        y: cy + (l.y - cy) * s,
        fontSizePx: l.fontSizePx * s,
        letterSpacingPx: l.letterSpacingPx * s,
        font: l.font.replace(/[-\d.]+px/, `${l.fontSizePx * s}px`),
      }
      ctx.font = next.font
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.letterSpacing = `${next.letterSpacingPx}px`
      const m = ctx.measureText(next.text)
      return {
        line: {
          ...next,
          width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent,
        },
        rect: {
          x: next.x - m.actualBoundingBoxLeft,
          y: next.y - m.actualBoundingBoxAscent,
          width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
        },
      }
    })
    const graphic = layout.graphic ? transform(layout.graphic, s) : undefined
    return { lines, graphic, boxes: [...lines.map((l) => l.rect), ...(graphic ? [graphic] : [])] }
  }
  const fits = (s: number) => candidate(s).boxes.every((r) => insideCircle(r, cx, cy, radius))
  if (!fits(1)) return layout
  let lo = 1,
    hi = 1.16
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  const c = candidate(lo),
    rects = c.lines.map((l) => l.rect)
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y))
  const box = rects.length
    ? {
        x,
        y,
        width: Math.max(...rects.map((r) => r.x + r.width)) - x,
        height: Math.max(...rects.map((r) => r.y + r.height)) - y,
      }
    : transform(layout.box, lo)
  const inset = short * config.typography.padding
  return {
    ...layout,
    fillScale: lo,
    lines: c.lines.map((l) => l.line),
    graphic: c.graphic,
    box,
    safeBox: { x: inset, y: inset, width: width - 2 * inset, height: height - 2 * inset },
    pill: { ...transform(layout.pill, lo), radiusPx: layout.pill.radiusPx * lo },
    fontSizePx: layout.fontSizePx * lo,
    fontRatio: layout.fontRatio * lo,
    lineHeightPx: layout.lineHeightPx * lo,
    letterSpacingPx: layout.letterSpacingPx * lo,
    font: c.lines[0]?.line.font ?? layout.font,
  }
}
