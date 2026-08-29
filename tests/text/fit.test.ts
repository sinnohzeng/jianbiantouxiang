import { describe, expect, it } from 'vitest'
import { FIT_ITERATIONS, MAX_FONT_RATIO, MIN_FONT_RATIO, fitText, safeArea } from '@/text/fit'
import type { PartialConfig } from '@/state/config'
import { createStubMeasure, makeConfig } from './helpers'

const measure = createStubMeasure()

function fit(overrides: PartialConfig, width = 1000, height = 1000) {
  return fitText(makeConfig(overrides), width, height, measure)
}

describe('manual 模式', () => {
  it('直接用给定的短边比例，不做搜索', () => {
    const result = fit({
      text: '猪',
      typography: { sizeMode: 'manual', fontSize: 0.5, padding: 0.1 },
    })
    expect(result.fontSizePx).toBeCloseTo(500)
  })

  it('短边决定字号', () => {
    const result = fit(
      { text: '猪', typography: { sizeMode: 'manual', fontSize: 0.5, padding: 0.1 } },
      1000,
      400,
    )
    expect(result.fontSizePx).toBeCloseTo(200)
  })

  it('超框时如实标记，不偷偷缩字号', () => {
    const result = fit({
      text: '猪猪家族',
      typography: { sizeMode: 'manual', fontSize: 0.9, padding: 0.1, autoWrap: false },
    })
    expect(result.fontSizePx).toBeCloseTo(900)
    expect(result.fits).toBe(false)
  })
})

describe('auto 模式闭式解', () => {
  it('单字撑满安全框', () => {
    const result = fit({ text: '中', typography: { padding: 0.1 } })
    expect(result.fontSizePx).toBeCloseTo(800, 3)
    expect(result.fits).toBe(true)
  })

  it('单行受宽度约束时一步到位', () => {
    const result = fit({ text: '中文', typography: { padding: 0.1, autoWrap: false } })
    expect(result.fontSizePx).toBeCloseTo(400, 3)
    expect(result.block.width).toBeCloseTo(800)
  })
})

describe('auto 模式二分', () => {
  it('两行文字收敛到理论最优附近且不超框', () => {
    const result = fit({ text: '中文\n换行', typography: { padding: 0.1, lineHeight: 1.15 } })
    // 理论最优：2.15 × S = 800，S ≈ 372.09
    expect(result.fontSizePx).toBeGreaterThan(371.5)
    expect(result.fontSizePx).toBeLessThanOrEqual(372.1)
    expect(result.fits).toBe(true)
    expect(result.block.height).toBeLessThanOrEqual(result.safeHeight + 1e-3)
    expect(result.block.width).toBeLessThanOrEqual(result.safeWidth + 1e-3)
  })

  it('自动换行下的结果同样落在安全框内', () => {
    const result = fit({ text: '渐变头像生成器', typography: { padding: 0.1, autoWrap: true } })
    expect(result.fits).toBe(true)
    expect(result.block.width).toBeLessThanOrEqual(result.safeWidth + 1e-3)
    expect(result.block.height).toBeLessThanOrEqual(result.safeHeight + 1e-3)
    expect(result.block.lines.length).toBeGreaterThan(1)
    // 换行换来的字号必须明显大于硬塞成单行的 800 / 7
    expect(result.fontSizePx).toBeGreaterThan(200)
  })

  it('二分区间与轮数按契约固定', () => {
    expect(MIN_FONT_RATIO).toBe(0.04)
    expect(MAX_FONT_RATIO).toBe(0.92)
    expect(FIT_ITERATIONS).toBe(12)
  })

  it('怎么缩都放不下时停在下界并标记超框', () => {
    const result = fit({
      text: '一'.repeat(60),
      typography: { padding: 0.1, autoWrap: false },
    })
    expect(result.fontSizePx).toBeCloseTo(MIN_FONT_RATIO * 1000)
    expect(result.fits).toBe(false)
  })

  it('空文本不抛错', () => {
    const result = fit({ text: '   ' })
    expect(result.block.lines).toEqual([])
    expect(result.block.width).toBe(0)
  })
})

describe('竖排', () => {
  it('按安全区高度分列，列数向上取整', () => {
    const result = fit({
      text: '一二三四五六',
      typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, vertical: true },
    })
    // 字号 200，字距 0：一列最多 (800 - 160 - 40) / 200 + 1 = 4 个字
    expect(result.block.vertical).toBe(true)
    expect(result.block.lines).toHaveLength(2)
    expect(result.block.lines[0]?.glyphs).toHaveLength(4)
    expect(result.block.lines[1]?.glyphs).toHaveLength(2)
    expect(result.block.columnWidth).toBeCloseTo(200)
    expect(result.block.width).toBeCloseTo(230 + 200)
    expect(result.block.height).toBeCloseTo(800)
  })

  it('关掉自动换行时一段就是一列', () => {
    const result = fit({
      text: '一二三四五六',
      typography: {
        sizeMode: 'manual',
        fontSize: 0.2,
        padding: 0.1,
        vertical: true,
        autoWrap: false,
      },
    })
    expect(result.block.lines).toHaveLength(1)
    expect(result.fits).toBe(false)
  })
})

describe('安全框跟着画布形状收', () => {
  const padded: PartialConfig = { typography: { padding: 0.1 } }

  it('方角只按边距内缩', () => {
    const area = safeArea(makeConfig({ ...padded, canvas: { shape: 'square' } }), 1000, 1000)
    expect(area).toEqual({ x: 100, y: 100, width: 800, height: 800 })
  })

  it('圆形收到内接正方形，四角不再越出圆弧', () => {
    const area = safeArea(makeConfig({ ...padded, canvas: { shape: 'circle' } }), 1000, 1000)
    const side = 1000 / Math.SQRT2
    expect(area.width).toBeCloseTo(side)
    expect(area.height).toBeCloseTo(side)
    expect(area.x).toBeCloseTo((1000 - side) / 2)
    // 角点到圆心的距离不超过半径，允许一点浮点误差
    const dx = area.width / 2
    const dy = area.height / 2
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(500 + 1e-6)
  })

  it('非正方形画布上圆形按内接圆收，保持原方框比例', () => {
    const area = safeArea(makeConfig({ ...padded, canvas: { shape: 'circle' } }), 1200, 800)
    expect(Math.hypot(area.width / 2, area.height / 2)).toBeCloseTo(400)
    expect(area.width / area.height).toBeCloseTo(1200 / 800)
    expect(area.x + area.width / 2).toBeCloseTo(600)
    expect(area.y + area.height / 2).toBeCloseTo(400)
  })

  it('常规圆角够不着方框四角，几何原样不动', () => {
    const area = safeArea(
      makeConfig({ ...padded, canvas: { shape: 'rounded', radius: 0.2 } }),
      1000,
      1000,
    )
    expect(area).toEqual({ x: 100, y: 100, width: 800, height: 800 })
  })

  it('圆角拉满等价于圆形', () => {
    const round = safeArea(
      makeConfig({ ...padded, canvas: { shape: 'rounded', radius: 0.5 } }),
      1000,
      1000,
    )
    const circle = safeArea(makeConfig({ ...padded, canvas: { shape: 'circle' } }), 1000, 1000)
    expect(round.width).toBeCloseTo(circle.width)
    expect(round.height).toBeCloseTo(circle.height)
  })

  it('边距拉到上限 0.3 时圆形仍够宽，不做多余收缩', () => {
    const area = safeArea(
      makeConfig({ typography: { padding: 0.3 }, canvas: { shape: 'circle' } }),
      1000,
      1000,
    )
    expect(area).toEqual({ x: 300, y: 300, width: 400, height: 400 })
  })

  it('画布尺寸为零时不出负数', () => {
    const area = safeArea(makeConfig({ ...padded, canvas: { shape: 'circle' } }), 0, 0)
    expect(area).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('自动填满不把词拆开', () => {
  it('宁可退一档字号，也不把拉丁词从中间断开', () => {
    const result = fit({
      text: '猪猪家族\n钱猪宝\nGRADIENT',
      typography: { sizeMode: 'auto', padding: 0.1, autoWrap: true },
    })
    const texts = result.block.lines.map((line) => line.text)
    expect(texts).toContain('GRADIENT')
    expect(result.block.broke).toBe(false)
    expect(result.fits).toBe(true)
  })

  it('词本身就放不下时照旧拆，不为它把字号压到下限', () => {
    const result = fit({
      text: 'SUPERCALIFRAGILISTIC',
      typography: { sizeMode: 'auto', padding: 0.3, autoWrap: true },
    })
    expect(result.block.broke).toBe(true)
    expect(result.block.lines.length).toBeGreaterThan(1)
    // 退化到下限就说明兜底没生效
    expect(result.fontSizePx).toBeGreaterThan(MIN_FONT_RATIO * 1000 + 1)
  })

  it('中文逐字换行不算拆词', () => {
    const result = fit({
      text: '渐变头像生成器渐变头像生成器',
      typography: { sizeMode: 'auto', padding: 0.1, autoWrap: true },
    })
    expect(result.block.broke).toBe(false)
    expect(result.block.lines.length).toBeGreaterThan(1)
  })

  it('关掉自动换行时不涉及拆词', () => {
    const result = fit({
      text: 'GRADIENT',
      typography: { sizeMode: 'auto', padding: 0.1, autoWrap: false },
    })
    expect(result.block.broke).toBe(false)
  })
})
