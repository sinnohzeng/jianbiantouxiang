import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { optimizeAutomaticText } from '@/text/optimize'
import { normalizeConfig } from '@/state/config'
import { insideCircle } from '@/text/circle'
import type { TextLayout } from '@/text/layout'
import type { Graphic } from '@/graphics/types'

vi.mock('@/text/optical', () => ({
  graphicInkFraction: () => ({ x: 0.1, y: 0.15, width: 0.8, height: 0.7 }),
}))
const ctx = {
  font: '',
  textAlign: '',
  textBaseline: '',
  letterSpacing: '',
  measureText(text: string) {
    const size = Number(this.font.match(/[\d.]+(?=px)/)?.[0])
    // Deliberately asymmetric side bearings: advance width is not the painted box.
    return {
      width: text.length * size,
      actualBoundingBoxLeft: size * 0.1,
      actualBoundingBoxRight: (text.length - 0.2) * size,
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2,
    }
  },
}
beforeEach(() =>
  vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D),
)
afterEach(() => vi.restoreAllMocks())
function base(logo = true): TextLayout {
  const line = (size: number, y: number) => ({
    text: 'ABCD',
    x: 256 - size * 2,
    y,
    width: size * 4,
    ascent: size * 0.8,
    descent: size * 0.2,
    font: `700 ${size}px serif`,
    fontSizePx: size,
    letterSpacingPx: 0,
  })
  return {
    lines: [line(60, 280), line(37.2, 340)],
    font: '700 60px serif',
    fontSizePx: 60,
    fontRatio: 60 / 512,
    lineHeightPx: 61.8,
    letterSpacingPx: 0,
    box: { x: 136, y: 232, width: 240, height: 116 },
    pill: { x: 136, y: 232, width: 240, height: 116, radiusPx: 0 },
    safeBox: { x: 15.36, y: 15.36, width: 481.28, height: 481.28 },
    overflow: false,
    graphic: logo ? { x: 156, y: 110, width: 200, height: 100 } : undefined,
  }
}
const graphic = {
  kind: 'image',
  image: {} as CanvasImageSource,
  width: 200,
  height: 100,
} as Graphic
const cfg = () => normalizeConfig({ text: 'ABCD\nABCD' })
describe('自动文字的最终安全区优化', () => {
  it('按真实墨迹求最大字号，保留 Logo 尺寸、主副比例和原输入', () => {
    const source = base(),
      saved = structuredClone(source)
    const out = optimizeAutomaticText(source, cfg(), 512, 512, graphic)
    expect(out.fontSizePx).toBeGreaterThan(60 * 1.16)
    expect(out.lines[1]!.fontSizePx / out.lines[0]!.fontSizePx).toBeCloseTo(0.62)
    expect(out.graphic!.width).toBe(source.graphic!.width)
    expect(out.graphic!.height).toBe(source.graphic!.height)
    expect(source).toEqual(saved)
    const rects = [
      out.graphic!,
      ...out.lines.map((l) => ({
        x: l.x - l.fontSizePx * 0.1,
        y: l.y - l.ascent,
        width: l.width,
        height: l.ascent + l.descent,
      })),
    ]
    expect(rects.every((r) => insideCircle(r, 256, 256, 512 * 0.47))).toBe(true)
    expect(Math.abs(out.optimization!.centerShiftY)).toBeLessThanOrEqual(512 * 0.035)
    // Intrinsic bottom clearance 15px already contributes to the 23.04px target.
    expect(out.optimization!.logoGap).toBeCloseTo(512 * 0.045 - 15)
  })
  it.each([
    { typography: { line1: { size: 0.2 } } },
    { typography: { line2: { size: 0.12 } } },
    { typography: { line1: { offsetX: 0.1 } } },
    { typography: { line2: { offsetY: -0.1 } } },
    { layout: { graphicOffsetX: 0.1 } },
    { typography: { effect: 'outline' as const } },
  ])('显式大小、位移与特殊效果不接管 %j', (partial) => {
    const source = base()
    expect(optimizeAutomaticText(source, normalizeConfig(partial), 512, 512, graphic)).toBe(source)
  })
  it('纯字严格居中；较大的自定义边距仍限制字号', () => {
    const config = normalizeConfig({ text: 'ABCD\nABCD', layout: { icon: { source: 'none' } } })
    const small = optimizeAutomaticText(base(false), config, 512, 512, null)
    const padded = optimizeAutomaticText(
      base(false),
      normalizeConfig({ ...config, typography: { ...config.typography, padding: 0.2 } }),
      512,
      512,
      null,
    )
    expect(small.box.y + small.box.height / 2).toBeCloseTo(256)
    expect(padded.fontSizePx).toBeLessThan(small.fontSizePx)
  })
  it('保留长段落额外换行的语义', () => {
    const source = base(false)
    expect(
      optimizeAutomaticText(
        source,
        normalizeConfig({ text: 'one long paragraph' }),
        512,
        512,
        null,
      ),
    ).toBe(source)
  })
})
