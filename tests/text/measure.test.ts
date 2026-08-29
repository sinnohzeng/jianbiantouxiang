import { describe, expect, it } from 'vitest'
import {
  createApproxMeasure,
  createCanvasMeasure,
  cssPx,
  fontFamilyStack,
  fontString,
  isCjk,
  letterSpacingPxOf,
  quoteFamily,
  toGraphemes,
} from '@/text/measure'
import { makeConfig } from './helpers'

describe('fontString', () => {
  it('带字重、字号与加引号的家族名', () => {
    const config = makeConfig({ typography: { fontFamily: 'Noto Sans SC', fontWeight: 700 } })
    const font = fontString(config, 42)
    expect(font.startsWith('700 42px "Noto Sans SC",')).toBe(true)
  })

  it('家族名一律加引号并附系统回退链', () => {
    expect(quoteFamily('ZCOOL KuaiLe')).toBe('"ZCOOL KuaiLe"')
    expect(fontFamilyStack('思源黑体')).toContain('"思源黑体", system-ui')
    expect(fontFamilyStack('思源黑体')).toContain('sans-serif')
  })

  it('空家族名只留系统回退链', () => {
    expect(fontFamilyStack('  ')).not.toContain('""')
    expect(fontFamilyStack('  ').startsWith('system-ui')).toBe(true)
  })

  it('极小字号不写成科学计数法', () => {
    expect(cssPx(0.0000001)).toBe('0px')
    expect(cssPx(Number.NaN)).toBe('0px')
    expect(cssPx(12.3456)).toBe('12.346px')
  })
})

describe('字符分类', () => {
  it('识别中日韩与全角标点', () => {
    expect(isCjk('猪')).toBe(true)
    expect(isCjk('。')).toBe(true)
    expect(isCjk('ア')).toBe(true)
    expect(isCjk('한')).toBe(true)
    expect(isCjk('A')).toBe(false)
  })

  it('按字素簇切分，不拆开组合 emoji', () => {
    expect(toGraphemes('猪猪家族')).toEqual(['猪', '猪', '家', '族'])
    expect(toGraphemes('👨‍👩‍👧')).toHaveLength(1)
  })
})

describe('近似度量', () => {
  const measure = createApproxMeasure()

  it('字距只加在字与字之间', () => {
    const font = '400 100px "X"'
    const plain = measure('猪猪猪', font, 0)
    const spaced = measure('猪猪猪', font, 10)
    expect(spaced.width - plain.width).toBeCloseTo(20)
  })

  it('单字不加字距', () => {
    expect(measure('猪', '400 100px "X"', 50).width).toBeCloseTo(100)
  })
})

describe('createCanvasMeasure', () => {
  it('拿不到 2D 上下文时退回近似度量而不是抛错', () => {
    const measure = createCanvasMeasure()
    const metrics = measure('猪猪家族', '700 100px "X"', 0)
    expect(Number.isFinite(metrics.width)).toBe(true)
    expect(metrics.width).toBeGreaterThan(0)
    expect(metrics.ascent).toBeGreaterThan(0)
  })

  it('传入的上下文优先使用', () => {
    const fake = {
      font: '',
      letterSpacing: '0px',
      measureText: (text: string) => ({ width: text.length * 7 }),
    } as unknown as CanvasRenderingContext2D
    const measure = createCanvasMeasure(fake)
    expect(measure('abcd', '400 100px "X"', 0).width).toBe(28)
  })
})

describe('letterSpacingPxOf', () => {
  it('em 折算成像素', () => {
    const config = makeConfig({ typography: { letterSpacing: 0.05 } })
    expect(letterSpacingPxOf(config, 200)).toBeCloseTo(10)
  })
})
