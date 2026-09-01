import { describe, expect, it } from 'vitest'
import { fitStack, safeArea } from '@/text/fit'
import { twoLinesOf } from '@/text/wrap'
import type { PartialConfig } from '@/state/config'
import { createStubMeasure, makeConfig } from './helpers'

const measure = createStubMeasure()

function fit(overrides: PartialConfig, width = 1000, height = 1000) {
  return fitStack(makeConfig(overrides), width, height, measure)
}

describe('两行切段', () => {
  it('最多两行，第三行起并入第二行', () => {
    expect(twoLinesOf('甲\n乙\n丙\n丁')).toEqual(['甲', '乙丙丁'])
  })

  it('前导空行保留槽位，行级参数才跟得上内容', () => {
    expect(twoLinesOf('\n说明')).toEqual(['', '说明'])
  })

  it('尾随空行与空白行不留尾巴', () => {
    expect(twoLinesOf('甲\n')).toEqual(['甲', ''])
    expect(twoLinesOf('')).toEqual(['', ''])
  })
})

describe('manual 模式', () => {
  it('直接用给定的短边比例，不做搜索', () => {
    const result = fit({
      text: '猪',
      typography: { sizeMode: 'manual', fontSize: 0.5, padding: 0.1 },
    })
    expect(result.primary?.fontSizePx).toBeCloseTo(500)
  })

  it('短边决定字号', () => {
    const result = fit(
      { text: '猪', typography: { sizeMode: 'manual', fontSize: 0.5, padding: 0.1 } },
      1000,
      400,
    )
    expect(result.primary?.fontSizePx).toBeCloseTo(200)
  })

  it('超框时如实标记，不偷偷缩字号', () => {
    const result = fit({
      text: '猪猪家族',
      typography: { sizeMode: 'manual', fontSize: 0.9, padding: 0.1 },
    })
    expect(result.primary?.fontSizePx).toBeCloseTo(900)
    expect(result.fits).toBe(false)
  })
})

describe('auto 模式', () => {
  it('单字撑满安全框', () => {
    const result = fit({ text: '中', typography: { padding: 0.1 } })
    expect(result.primary?.fontSizePx).toBeCloseTo(800, 0)
    expect(result.fits).toBe(true)
    expect(result.secondary).toBeNull()
  })

  it('单行受宽度约束', () => {
    const result = fit({ text: '中文', typography: { padding: 0.1 } })
    expect(result.primary?.fontSizePx).toBeCloseTo(400, 0)
  })

  it('两行同解：次行恒等于基准乘行级比例', () => {
    const result = fit({ text: '飞书\n先锋', typography: { padding: 0.1 } })
    // 宽约束：主行两个 CJK 占 2S ≤ 800
    const base = result.primary?.fontSizePx ?? 0
    expect(base).toBeCloseTo(400, 0)
    expect(result.secondary?.fontSizePx).toBeCloseTo(base * 0.62, 0)
    expect(result.secondary?.block.lines).toHaveLength(1)
    expect(result.fits).toBe(true)
  })

  it('次行放不下时允许折行，主行仍保持单行', () => {
    const result = fit({ text: '飞书\n效率先锋', typography: { padding: 0.1 } })
    expect(result.primary?.block.lines).toHaveLength(1)
    expect(result.secondary?.block.lines).toHaveLength(2)
    expect(result.fits).toBe(true)
  })

  it('两块之间的留白按首行字号的 0.18 算', () => {
    const result = fit({ text: '飞书\n效率先锋', typography: { padding: 0.1 } })
    expect(result.gapPx).toBeCloseTo((result.primary?.fontSizePx ?? 0) * 0.18, 5)
  })

  it('第二行为空时画面退化成单行', () => {
    const result = fit({ text: '暴富', typography: { padding: 0.1 } })
    expect(result.secondary).toBeNull()
    expect(result.gapPx).toBe(0)
  })

  it('第一行空、第二行有内容：晋升主行，补偿参数跟着内容走', () => {
    const result = fit({
      text: '\n说明',
      typography: { padding: 0.1, lineOffsetsX: [0.1, 0.2] },
    })
    expect(result.primary?.block.lines[0]?.text).toBe('说明')
    expect(result.primary?.offset).toBeCloseTo(0.2)
    expect(result.secondary).toBeNull()
  })

  it('水平补偿在求解阶段预留宽度余量', () => {
    // 偏移 0.1 × 画布宽 1000 → 两侧各让 100，可用宽从 800 降到 600
    const result = fit({
      text: '中',
      typography: { padding: 0.1, lineOffsetsX: [0.1, 0] },
    })
    expect(result.primary?.fontSizePx).toBeCloseTo(600, 0)
    expect(result.fits).toBe(true)
  })

  it('严格档宁可不折主行：长主行留在单行小字号', () => {
    // 六个 CJK：不折行 6S ≤ 800 → S≈133；折两行能放到约 266，严格档取前者
    const result = fit({ text: '猪猪猪猪猪猪', typography: { padding: 0.1 } })
    expect(result.primary?.block.lines).toHaveLength(1)
    expect(result.primary?.fontSizePx).toBeCloseTo(800 / 6, 0)
  })

  it('空文本返回空栈且算放得下', () => {
    const result = fit({ text: '   ' })
    expect(result.primary).toBeNull()
    expect(result.secondary).toBeNull()
    expect(result.fits).toBe(true)
  })
})

describe('safeArea', () => {
  it('按边距内缩', () => {
    const area = safeArea(makeConfig({ typography: { padding: 0.1 } }), 1000, 1000)
    expect(area).toEqual({ x: 100, y: 100, width: 800, height: 800 })
  })

  it('圆形遮罩把安全框收进圆弧', () => {
    const area = safeArea(
      makeConfig({ canvas: { shape: 'circle' }, typography: { padding: 0 } }),
      1000,
      1000,
    )
    // 正方形内接圆：内接正方形边长 = 直径 × √2/2
    expect(area.width).toBeCloseTo(1000 * Math.SQRT1_2, 0)
    expect(area.height).toBeCloseTo(1000 * Math.SQRT1_2, 0)
  })

  it('方角不受遮罩影响', () => {
    const area = safeArea(
      makeConfig({ canvas: { shape: 'square' }, typography: { padding: 0 } }),
      1000,
      1000,
    )
    expect(area).toEqual({ x: 0, y: 0, width: 1000, height: 1000 })
  })
})
