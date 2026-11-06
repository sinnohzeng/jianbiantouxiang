import { describe, it, expect } from 'vitest'
import { badgeLayout, contains } from '@/automation/layout'
import { renderSchema } from '@/automation/schema'
import { STYLE_IDS } from '@/state/config'

const measure = (text: string, size: number) => ({
  left: size * 0.03,
  right: text.length * size * 0.7,
  ascent: size * 0.8,
  descent: size * 0.2,
})

describe('automation contract and layout', () => {
  it('rejects typo fields, URLs, control characters and excessive dimensions', () => {
    for (const input of [
      { siz: 1024 },
      { size: 8192 },
      { line1: 'a\nb' },
      { logo: { url: 'http://localhost' } },
      { logo: { mimeType: 'image/png', data: '../secret' } },
    ])
      expect(renderSchema.safeParse(input).success).toBe(false)
    expect(renderSchema.shape.style.unwrap().options).toEqual(STYLE_IDS)
  })
  it.each([
    [128, 0.25],
    [512, 0.14],
    [2048, 0.1],
  ])('keeps wide and tall logos and two lines in the safe box at %i', (size, padding) => {
    for (const graphic of [
      { width: 1000, height: 50 },
      { width: 50, height: 1000 },
      { width: 100, height: 100 },
      null,
    ]) {
      const layout = badgeLayout(
        size,
        padding,
        0.55,
        ['长标题这是中文', 'Product engineering'],
        graphic,
        measure,
      )
      expect(layout.lines).toHaveLength(2)
      expect(layout.overflow).toBe(false)
      expect(contains(layout.safeBox, layout.box)).toBe(true)
      if (layout.graphic) {
        expect(contains(layout.safeBox, layout.graphic)).toBe(true)
        expect(layout.graphic.y + layout.graphic.height).toBeLessThan(layout.box.y)
      }
    }
  })
  it('shrinks a long line without wrapping and preserves title/subtitle hierarchy', () => {
    const short = badgeLayout(1024, 0.14, 0.38, ['A', 'Second'], null, measure)
    const long = badgeLayout(1024, 0.14, 0.38, ['W'.repeat(80), 'Second'], null, measure)
    expect(long.lines).toHaveLength(2)
    expect(long.lines[0]?.fontSizePx).toBeLessThan(short.lines[0]?.fontSizePx ?? 0)
    expect(long.lines[1]?.fontSizePx).toBeLessThanOrEqual((long.lines[0]?.fontSizePx ?? 0) * 0.62)
    expect(long.overflow).toBe(false)
  })
  it('centers logo-only output and supports a second line alone', () => {
    const layout = badgeLayout(512, 0.14, 0.38, ['', ''], { width: 200, height: 100 }, measure)
    expect((layout.graphic?.y ?? 0) + (layout.graphic?.height ?? 0) / 2).toBe(256)
    expect(badgeLayout(512, 0.14, 0.38, ['', 'Secondary'], null, measure).lines).toHaveLength(1)
  })
})

describe('圆裁与小头像版式', () => {
  it.each([128, 512, 2048])(
    '两行墨迹并集在 %i 像素时整体居中，短标题不受旧字号上限限制',
    (size) => {
      const l = badgeLayout(size, 0.06, 0.38, ['研发', 'STUDIO'], null, measure)
      expect(l.box.y + l.box.height / 2).toBeCloseTo(size / 2)
      expect(l.lines[0]!.fontSizePx / size).toBeGreaterThan(0.2)
      expect(l.overflow).toBe(false)
    },
  )
  it('每个图文包围框留在圆内，含宽图、长文和极端边距', () => {
    for (const padding of [0.02, 0.06, 0.25])
      for (const texts of [
        ['研发', 'STUDIO'],
        ['W'.repeat(80), '产品'],
        ['', ''],
      ] as [string, string][]) {
        for (const graphic of [
          { width: 100, height: 100 },
          { width: 5000, height: 100 },
          { width: 100, height: 5000 },
        ]) {
          const l = badgeLayout(512, padding, 0.55, texts, graphic, measure)
          expect(l.overflow).toBe(false)
          const rects = [
            l.graphic!,
            ...l.lines.map((line) => ({
              x: line.x - measure(line.text, line.fontSizePx).left,
              y: line.y - line.ascent,
              width: line.width,
              height: line.ascent + line.descent,
            })),
          ]
          for (const r of rects)
            for (const x of [r.x, r.x + r.width])
              for (const y of [r.y, r.y + r.height])
                expect(Math.hypot(x - 256, y - 256)).toBeLessThanOrEqual(
                  512 * (0.5 - padding) + 0.01,
                )
        }
      }
  })
  it('方形安全区是显式选项；旧边距仍可指定', () => {
    expect(renderSchema.parse({}).padding).toBe(0.06)
    expect(renderSchema.parse({ padding: 0.14, safeShape: 'square' }).padding).toBe(0.14)
    const circle = badgeLayout(512, 0.06, 0.38, ['ABCD', ''], null, measure)
    const square = badgeLayout(512, 0.06, 0.38, ['ABCD', ''], null, measure, 'square')
    expect(square.lines[0]!.fontSizePx).toBeGreaterThan(circle.lines[0]!.fontSizePx)
  })
})

it('单字无 Logo 能放大而不是停在标题固定小字号', () => {
  const l = badgeLayout(512, 0.06, 0.38, ['研', ''], null, measure)
  expect(l.lines[0]!.fontSizePx / 512).toBeGreaterThan(0.5)
  expect(l.overflow).toBe(false)
})
