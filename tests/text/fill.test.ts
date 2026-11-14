import { afterEach, describe, expect, it, vi } from 'vitest'
import { automaticGroup, compositionConfig, fillCircleLayout } from '@/text/fill'
import { normalizeConfig } from '@/state/config'
import type { TextLayout } from '@/text/layout'

afterEach(() => vi.restoreAllMocks())
describe('保持已认可比例的整体放大', () => {
  it('只在自动字号且无手动位移时接管，旧安全边距保留', () => {
    expect(automaticGroup(normalizeConfig({}))).toBe(true)
    expect(automaticGroup(normalizeConfig({ typography: { line1: { size: 0.2 } } }))).toBe(false)
    expect(automaticGroup(normalizeConfig({ layout: { graphicOffsetY: 0.1 } }))).toBe(false)
    expect(compositionConfig(normalizeConfig({})).typography.padding).toBe(0.06)
    expect(
      compositionConfig(normalizeConfig({ typography: { effect: 'outline' } })).typography.padding,
    ).toBe(0.03)
    expect(
      compositionConfig(normalizeConfig({ typography: { padding: 0.14 } })).typography.padding,
    ).toBe(0.14)
  })
  it('同一倍率作用于字号、Logo 和相对位置，手动字号保持原样', () => {
    const ctx = {
      font: '',
      textAlign: '',
      textBaseline: '',
      letterSpacing: '',
      measureText() {
        const size = Number(this.font.match(/[\d.]+(?=px)/)?.[0])
        return {
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: size * 2,
          actualBoundingBoxAscent: size * 0.8,
          actualBoundingBoxDescent: size * 0.2,
        }
      },
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    const line = (size: number, y: number) => ({
      text: 'AB',
      x: 256 - size,
      y,
      width: size * 2,
      ascent: size * 0.8,
      descent: size * 0.2,
      font: `700 ${size}px serif`,
      fontSizePx: size,
      letterSpacingPx: 0,
    })
    const layout: TextLayout = {
      lines: [line(60, 270), line(37.2, 330)],
      font: '700 60px serif',
      fontSizePx: 60,
      fontRatio: 60 / 512,
      lineHeightPx: 60,
      letterSpacingPx: 0,
      box: { x: 196, y: 222, width: 120, height: 116 },
      pill: { x: 196, y: 222, width: 120, height: 116, radiusPx: 0 },
      safeBox: { x: 30, y: 30, width: 452, height: 452 },
      graphic: { x: 206, y: 150, width: 100, height: 40 },
      overflow: false,
    }
    const out = fillCircleLayout(layout, normalizeConfig({}), 512, 512)
    expect(
      fillCircleLayout(layout, normalizeConfig({ typography: { effect: 'plain' } }), 512, 512),
    ).toEqual(out)
    const ratio = out.fillScale ?? 1
    expect(ratio).toBeCloseTo(1.16, 4)
    expect(out.lines[1]!.fontSizePx / out.lines[0]!.fontSizePx).toBeCloseTo(0.62)
    expect(out.graphic!.width / layout.graphic!.width).toBeCloseTo(ratio)
    expect(
      (out.lines[1]!.y - out.lines[0]!.y) / (layout.lines[1]!.y - layout.lines[0]!.y),
    ).toBeCloseTo(ratio)
    expect(
      fillCircleLayout(layout, normalizeConfig({ typography: { line1: { size: 0.2 } } }), 512, 512),
    ).toBe(layout)
  })
})
