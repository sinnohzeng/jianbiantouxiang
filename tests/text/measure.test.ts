import { describe, expect, it } from 'vitest'
import {
  createApproxMeasure,
  createCanvasMeasure,
  isCjk,
  letterSpacingPxOf,
  toGraphemes,
} from '@/text/measure'
import { makeConfig } from './helpers'

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
