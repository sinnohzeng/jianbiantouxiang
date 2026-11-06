import { drawText } from './draw'
import { insideCircle } from './circle'
import { drawGraphic } from '@/graphics/draw'
import type { Graphic } from '@/graphics/types'
import type { AvatarConfig } from '@/state/config'
import type { Rect, TextLayout } from './layout'

export interface MaskStats {
  mass: number
  x: number
  y: number
  bounds: Rect
}
export interface OpticalReport {
  mode: 'off' | 'manual' | 'bounded' | 'unavailable'
  lineShifts: number[]
  groupShiftY: number
  proposedGroupShiftY: number
  limited: boolean
  groupScale: number
}

/** Alpha mass is only a diagnostic proxy, never a perceptual ground truth. */
export function maskStats(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): MaskStats | null {
  let mass = 0,
    sx = 0,
    sy = 0,
    left = width,
    right = -1,
    top = height,
    bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = (data[(y * width + x) * 4 + 3] ?? 0) / 255
      if (!a) continue
      mass += a
      sx += (x + 0.5) * a
      sy += (y + 0.5) * a
      if (a >= 0.04) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  if (!mass || right < left) return null
  return {
    mass,
    x: sx / mass,
    y: sy / mass,
    bounds: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 },
  }
}

/** Small, damped correction; ignore subpixel noise and cap at 1.5% of the short side. */
export function opticalShift(delta: number, short: number): number {
  if (Math.abs(delta) < short * 0.004) return 0
  return Math.max(-short * 0.015, Math.min(short * 0.015, delta * 0.25))
}

/** Visible bounds are the baseline; ink mass supplies only a quarter-strength correction.
 * Reserved transparent brand space must not masquerade as visible content. */
export function brandGroupShift(
  boundsCenter: number,
  massCenter: number,
  center: number,
  short: number,
): number {
  const delta = center - (boundsCenter * 0.75 + massCenter * 0.25)
  return Math.abs(delta) < short * 0.004
    ? 0
    : Math.max(-short * 0.035, Math.min(short * 0.035, delta))
}

export function applyOpticalLayout(
  layout: TextLayout,
  config: AvatarConfig,
  width: number,
  height: number,
  graphic: Graphic | null,
  circle = true,
): TextLayout {
  const report: OpticalReport = {
    mode: 'off',
    lineShifts: layout.lines.map(() => 0),
    groupShiftY: 0,
    proposedGroupShiftY: 0,
    limited: false,
    groupScale: 1,
  }
  const result = {
    ...layout,
    lines: layout.lines.map((l) => ({ ...l })),
    graphic: layout.graphic ? { ...layout.graphic } : undefined,
    box: { ...layout.box },
    pill: { ...layout.pill },
    optical: report,
  }
  if (!config.typography.optical) return result
  const { line1, line2 } = config.typography
  if (
    [
      line1.offsetX,
      line1.offsetY,
      line2.offsetX,
      line2.offsetY,
      config.layout.graphicOffsetX,
      config.layout.graphicOffsetY,
    ].some(Boolean)
  ) {
    report.mode = 'manual'
    return result
  }
  if (layout.overflow || typeof document === 'undefined') {
    report.mode = 'unavailable'
    return result
  }
  const canvas = document.createElement('canvas')
  const scale = 256 / Math.max(width, height)
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    report.mode = 'unavailable'
    return result
  }
  const plain = { ...config, typography: { ...config.typography, effect: 'plain' as const } }
  const short = Math.min(width, height),
    safe = layout.safeBox
  const fits = (r: Rect) =>
    r.x >= safe.x - 0.01 &&
    r.y >= safe.y - 0.01 &&
    r.x + r.width <= safe.x + safe.width + 0.01 &&
    r.y + r.height <= safe.y + safe.height + 0.01 &&
    (!circle || insideCircle(r, width / 2, height / 2, short * (0.5 - config.typography.padding)))
  const sample = (single?: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    if (single === undefined && graphic && result.graphic)
      drawGraphic(ctx, graphic, result.graphic, plain, '#fff')
    drawText(
      ctx,
      {
        ...result,
        lines: single === undefined ? result.lines : result.lines.filter((_, i) => i === single),
      },
      plain,
      '#fff',
    )
    return maskStats(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    )
  }
  const toRect = (m: MaskStats): Rect => ({
    x: m.bounds.x / scale,
    y: m.bounds.y / scale,
    width: m.bounds.width / scale,
    height: m.bounds.height / scale,
  })
  const measuredRect = (line: TextLayout['lines'][number]): Rect => {
    ctx.font = line.font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${line.letterSpacingPx}px`
    const m = ctx.measureText(line.text)
    return {
      x: line.x - m.actualBoundingBoxLeft,
      y: line.y - m.actualBoundingBoxAscent,
      width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    }
  }
  const rows: Rect[] = []
  try {
    report.mode = 'bounded'
    result.lines.forEach((line, i) => {
      const m = sample(i)
      if (!m) return
      const rect = toRect(m)
      // Preserve the font's spacing and glyph outlines: translate the entire line only.
      const rawShift = opticalShift(width / 2 - m.x / scale, short)
      const proposed = Math.max(-line.fontSizePx * 0.02, Math.min(line.fontSizePx * 0.02, rawShift))
      const metric = measuredRect(line)
      const fitsShift = (dx: number) => [rect, metric].every((r) => fits({ ...r, x: r.x + dx }))
      let shift = proposed
      for (let n = 0; n < 12 && !fitsShift(shift); n++) shift *= 0.5
      if (!fitsShift(shift) || Math.abs(shift) < short * 0.0005) shift = 0
      report.limited ||= Math.abs(shift - proposed) > short * 0.0005
      report.lineShifts[i] = shift
      line.x += shift
      rect.x += shift
      rows.push(rect)
    })
    const group = sample()
    if (group) {
      const automaticBrand =
        !!result.graphic &&
        config.typography.line1.size === null &&
        config.typography.line2.size === null
      const proposed = automaticBrand
        ? brandGroupShift(
            (group.bounds.y + group.bounds.height / 2) / scale,
            group.y / scale,
            height / 2,
            short,
          )
        : opticalShift(height / 2 - group.y / scale, short)
      report.proposedGroupShiftY = proposed
      let shift = proposed
      // Tight circle fits previously vetoed useful translation. Reserve at most 6% size.
      const transformed = (r: Rect, factor: number, dy: number): Rect => ({
        x: width / 2 + (r.x - width / 2) * factor,
        y: height / 2 + (r.y + dy - height / 2) * factor,
        width: r.width * factor,
        height: r.height * factor,
      })
      // Font hinting/rounding is not linear in font size. Measure each candidate.
      const candidateBoxes = (factor: number, dy: number) => [
        ...rows.map((r) => transformed(r, factor, dy)),
        ...result.lines.map((l) =>
          measuredRect({
            ...l,
            x: width / 2 + (l.x - width / 2) * factor,
            y: height / 2 + (l.y + dy - height / 2) * factor,
            font: l.font.replace(/[-\d.]+px/, `${l.fontSizePx * factor}px`),
            letterSpacingPx: l.letterSpacingPx * factor,
          }),
        ),
        ...(result.graphic ? [transformed(result.graphic, factor, dy)] : []),
      ]
      if (automaticBrand && shift && !candidateBoxes(1, shift).every(fits)) {
        for (let n = 0; n < 12 && !candidateBoxes(0.94, shift).every(fits); n++) shift *= 0.5
        let lo = 0.94,
          hi = 1
        if (candidateBoxes(lo, shift).every(fits)) {
          for (let n = 0; n < 16; n++) {
            const mid = (lo + hi) / 2
            if (candidateBoxes(mid, shift).every(fits)) lo = mid
            else hi = mid
          }
          report.groupScale = lo
          for (const l of result.lines) {
            l.x = width / 2 + (l.x - width / 2) * lo
            l.y = height / 2 + (l.y - height / 2) * lo
            l.fontSizePx *= lo
            l.letterSpacingPx *= lo
            l.font = l.font.replace(/[-\d.]+px/, `${l.fontSizePx}px`)
            const rect = measuredRect(l)
            l.width = rect.width
            l.ascent = l.y - rect.y
            l.descent = rect.y + rect.height - l.y
          }
          for (const r of rows) Object.assign(r, transformed(r, lo, 0))
          if (result.graphic) Object.assign(result.graphic, transformed(result.graphic, lo, 0))
          shift *= lo
        }
      }
      const fittedBoxes = [
        ...rows,
        ...result.lines.map(measuredRect),
        ...(result.graphic ? [result.graphic] : []),
      ]
      for (let n = 0; n < 12 && !fittedBoxes.every((r) => fits({ ...r, y: r.y + shift })); n++)
        shift *= 0.5
      if (
        !fittedBoxes.every((r) => fits({ ...r, y: r.y + shift })) ||
        Math.abs(shift) < short * 0.0005
      )
        shift = 0
      report.limited ||= Math.abs(shift - proposed) > short * 0.0005
      report.groupShiftY = shift
      for (const l of result.lines) l.y += shift
      if (result.graphic) result.graphic.y += shift
      for (const r of rows) r.y += shift
    }
    if (report.groupScale !== 1) {
      result.fontSizePx *= report.groupScale
      result.fontRatio *= report.groupScale
      result.lineHeightPx *= report.groupScale
      result.letterSpacingPx *= report.groupScale
      result.font = result.lines[0]?.font ?? result.font
    }
    if (rows.length) {
      rows.splice(0, rows.length, ...result.lines.map(measuredRect))
      const x = Math.min(...rows.map((r) => r.x)),
        y = Math.min(...rows.map((r) => r.y))
      result.box = {
        x,
        y,
        width: Math.max(...rows.map((r) => r.x + r.width)) - x,
        height: Math.max(...rows.map((r) => r.y + r.height)) - y,
      }
      result.pill.x += result.box.x - layout.box.x
      result.pill.y += result.box.y - layout.box.y
      result.pill.width += result.box.width - layout.box.width
      result.pill.height += result.box.height - layout.box.height
    }
    return result
  } finally {
    canvas.width = canvas.height = 1
  }
}
