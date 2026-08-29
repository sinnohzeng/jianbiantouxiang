import { describe, expect, it } from 'vitest'
import type { Anchor, PartialConfig } from '@/state/config'
import { layoutText } from '@/text/layout'
import { createStubMeasure, makeConfig } from './helpers'

const measure = createStubMeasure()

function layout(overrides: PartialConfig, width = 1000, height = 1000) {
  return layoutText(makeConfig(overrides), width, height, measure)
}

/** 单字 200 px、边距 10 %，块尺寸恰好 200 × 200，锚点坐标可以手算。 */
const SINGLE: PartialConfig = {
  text: '中',
  typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1 },
}

function withAnchor(anchor: Anchor): PartialConfig {
  return { ...SINGLE, typography: { ...SINGLE.typography, anchor } }
}

describe('九宫格锚点', () => {
  it('左上角贴安全框左上', () => {
    const result = layout(withAnchor('tl'))
    expect(result.box.x).toBeCloseTo(100)
    expect(result.box.y).toBeCloseTo(100)
    expect(result.box.width).toBeCloseTo(200)
    expect(result.box.height).toBeCloseTo(200)
  })

  it('居中', () => {
    const result = layout(withAnchor('c'))
    expect(result.box.x).toBeCloseTo(400)
    expect(result.box.y).toBeCloseTo(400)
  })

  it('右下角贴安全框右下', () => {
    const result = layout(withAnchor('br'))
    expect(result.box.x + result.box.width).toBeCloseTo(900)
    expect(result.box.y + result.box.height).toBeCloseTo(900)
  })

  it('右上与左下', () => {
    expect(layout(withAnchor('tr')).box.x).toBeCloseTo(700)
    expect(layout(withAnchor('tr')).box.y).toBeCloseTo(100)
    expect(layout(withAnchor('bl')).box.x).toBeCloseTo(100)
    expect(layout(withAnchor('bl')).box.y).toBeCloseTo(700)
  })

  it('偏移按画布比例叠加在锚点之后', () => {
    const result = layout({
      ...SINGLE,
      typography: { ...SINGLE.typography, anchor: 'c', offsetX: 0.1, offsetY: -0.05 },
    })
    expect(result.box.x).toBeCloseTo(500)
    expect(result.box.y).toBeCloseTo(350)
  })

  it('安全框由边距决定', () => {
    const result = layout({ ...SINGLE, typography: { ...SINGLE.typography, padding: 0.15 } })
    expect(result.safeBox).toEqual({ x: 150, y: 150, width: 700, height: 700 })
  })
})

describe('基线与对齐', () => {
  const twoLines: PartialConfig = {
    text: '中\n中文',
    typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, anchor: 'c' },
  }

  it('首行基线按 ascent 落位，行距等于行高', () => {
    const result = layout(twoLines)
    const [first, second] = result.lines
    expect(first?.y).toBeCloseTo(result.box.y + 160)
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBeCloseTo(result.lineHeightPx)
  })

  it('左对齐时各行左边缘对齐', () => {
    const result = layout({
      ...twoLines,
      typography: { ...twoLines.typography, align: 'left' },
    })
    expect(result.lines[0]?.x).toBeCloseTo(result.box.x)
    expect(result.lines[1]?.x).toBeCloseTo(result.box.x)
  })

  it('居中对齐时短行左边缘内缩半个差值', () => {
    const result = layout({
      ...twoLines,
      typography: { ...twoLines.typography, align: 'center' },
    })
    expect(result.lines[0]?.x).toBeCloseTo(result.box.x + 100)
    expect(result.lines[1]?.x).toBeCloseTo(result.box.x)
  })

  it('右对齐时各行右边缘对齐', () => {
    const result = layout({
      ...twoLines,
      typography: { ...twoLines.typography, align: 'right' },
    })
    const right = result.box.x + result.box.width
    for (const line of result.lines) expect(line.x + line.width).toBeCloseTo(right)
  })

  it('单行时行高不影响块高', () => {
    const tight = layout({ ...SINGLE, typography: { ...SINGLE.typography, lineHeight: 2 } })
    expect(tight.box.height).toBeCloseTo(200)
  })
})

describe('竖排', () => {
  const vertical: PartialConfig = {
    text: '一二三四五六',
    typography: {
      sizeMode: 'manual',
      fontSize: 0.2,
      padding: 0.1,
      vertical: true,
      anchor: 'c',
      align: 'center',
    },
  }

  it('分成两列且首列在最右', () => {
    const result = layout(vertical)
    expect(result.vertical).toBe(true)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]?.glyphs).toHaveLength(4)
    expect(result.lines[1]?.glyphs).toHaveLength(2)
    expect(result.lines[0]?.x ?? 0).toBeGreaterThan(result.lines[1]?.x ?? 0)
    expect((result.lines[0]?.x ?? 0) - (result.lines[1]?.x ?? 0)).toBeCloseTo(result.lineHeightPx)
  })

  it('列内逐字向下推进一个字距', () => {
    const result = layout(vertical)
    const [first, second, , fourth] = result.lines[0]?.glyphs ?? []
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBeCloseTo(
      result.fontSizePx + result.letterSpacingPx,
    )
    expect(first?.char).toBe('一')
    expect(fourth?.char).toBe('四')
  })

  it('每个字都落在安全框内', () => {
    const result = layout(vertical)
    for (const line of result.lines) {
      for (const glyph of line.glyphs) {
        expect(glyph.x).toBeGreaterThanOrEqual(result.safeBox.x - 1e-6)
        expect(glyph.y - line.ascent).toBeGreaterThanOrEqual(result.safeBox.y - 1e-6)
        expect(glyph.y + line.descent).toBeLessThanOrEqual(
          result.safeBox.y + result.safeBox.height + 1e-6,
        )
      }
    }
  })
})

describe('胶囊底板', () => {
  it('矩形按内边距外扩并包住所有行', () => {
    const result = layout({
      text: '猪猪\n家族大合影',
      typography: {
        sizeMode: 'manual',
        fontSize: 0.12,
        padding: 0.1,
        anchor: 'c',
        align: 'center',
        effect: 'pill',
        pill: { radius: 0.5, padding: 0.3, opacity: 0.35 },
      },
    })
    const pad = result.fontSizePx * 0.3
    expect(result.pill.x).toBeCloseTo(result.box.x - pad)
    expect(result.pill.width).toBeCloseTo(result.box.width + pad * 2)
    expect(result.pill.radiusPx).toBeCloseTo(0.5 * Math.min(result.pill.width, result.pill.height))
    for (const line of result.lines) {
      expect(line.x).toBeGreaterThanOrEqual(result.pill.x)
      expect(line.x + line.width).toBeLessThanOrEqual(result.pill.x + result.pill.width)
      expect(line.y - line.ascent).toBeGreaterThanOrEqual(result.pill.y)
      expect(line.y + line.descent).toBeLessThanOrEqual(result.pill.y + result.pill.height)
    }
  })
})

describe('超框标记', () => {
  it('manual 放不下时 overflow 为真', () => {
    const result = layout({
      text: '猪猪家族',
      typography: { sizeMode: 'manual', fontSize: 0.9, padding: 0.1, autoWrap: false },
    })
    expect(result.overflow).toBe(true)
  })

  it('auto 求解成功时 overflow 为假', () => {
    expect(layout({ text: '猪猪家族' }).overflow).toBe(false)
  })
})
