import { describe, expect, it } from 'vitest'
import { clampChroma, displayable, formatHex, oklch } from '@/palettes/culori'
import { harmonize } from '@/palettes/harmony'
import { contrastRatio } from '@/palettes/color'

const HEX = /^#[0-9a-f]{6}$/

/** 停靠点已经落在色域边界之内时，再夹一次色度不会改变它。 */
function insideGamut(hex: string): boolean {
  return displayable(hex) && formatHex(clampChroma(oklch(hex)!, 'oklch')) === hex
}

describe('harmonize 与附录 B 的实测样例一致', () => {
  it('#D97757 浅色', () => {
    const result = harmonize('#D97757')
    expect(result.colors).toEqual([
      '#d87397',
      '#f39194',
      '#ffb298',
      '#ffd0ad',
      '#fce8ca',
      '#fff4f1',
    ])
    expect(result.bg).toBe('#ffebe5')
    expect(result.text).toBe('#141413')
  })

  it('#4D6BFE 深色', () => {
    const result = harmonize('#4D6BFE', { tone: 'dark' })
    expect(result.colors).toEqual([
      '#003e54',
      '#004f8a',
      '#3d55c8',
      '#7b61dc',
      '#b072dc',
      '#8aa1e9',
    ])
    expect(result.bg).toBe('#060c29')
    expect(result.text).toBe('#FFFFFF')
  })

  it('#4796E3 加 #CA6673 双种子浅色', () => {
    const result = harmonize('#4796E3', { seed2: '#CA6673' })
    expect(result.colors.slice(0, 5)).toEqual([
      '#4e9dea',
      '#a3a7ff',
      '#deb4f9',
      '#ffc8e8',
      '#ffe3e5',
    ])
  })
})

describe('harmonize 输出约束', () => {
  it('固定返回 6 色，全部是合法 hex 且在 sRGB 内', () => {
    const result = harmonize('#D97757')
    expect(result.colors).toHaveLength(6)
    for (const color of result.colors) {
      expect(color).toMatch(HEX)
      expect(insideGamut(color), color).toBe(true)
    }
    expect(result.bg).toMatch(HEX)
    expect(insideGamut(result.bg)).toBe(true)
  })

  it('深色模式文字为白、浅色模式文字为暖近黑', () => {
    for (const seed of ['#D97757', '#4D6BFE', '#10A37F', '#808080', '#A82BB2']) {
      expect(harmonize(seed, { tone: 'dark' }).text, seed).toBe('#FFFFFF')
      expect(harmonize(seed, { tone: 'light' }).text, seed).toBe('#141413')
    }
  })

  it('未指定 tone 时按浅色处理', () => {
    expect(harmonize('#10A37F')).toEqual(harmonize('#10A37F', { tone: 'light' }))
  })

  it('同一输入始终得到同一套', () => {
    expect(harmonize('#5FB4F5', { scheme: 'split' })).toEqual(
      harmonize('#5FB4F5', { scheme: 'split' }),
    )
  })

  it('文字色对每个停靠点与背景的对比度都不低于 2.5', () => {
    for (const seed of ['#D97757', '#4D6BFE', '#F26A2E', '#C8B6FF']) {
      for (const tone of ['light', 'dark'] as const) {
        const result = harmonize(seed, { tone })
        for (const surface of [...result.colors, result.bg]) {
          expect(contrastRatio(result.text, surface), `${seed} ${tone} ${surface}`).toBeGreaterThan(
            2.5,
          )
        }
      }
    }
  })

  it('plate 是布尔值，均值对比度不足时才为 true', () => {
    const result = harmonize('#D97757')
    expect(typeof result.plate).toBe('boolean')
    expect(result.plate).toBe(false)
  })
})

describe('harmonize 的色相方案', () => {
  it('类比与分裂互补给出不同的色相分布', () => {
    const analogous = harmonize('#4D6BFE', { scheme: 'analogous' })
    const split = harmonize('#4D6BFE', { scheme: 'split' })
    expect(analogous.colors).not.toEqual(split.colors)
  })

  it('duo 方案只在同一色相上拉明度阶梯', () => {
    // 8 位色量化会让低 chroma 停靠点的色相漂几度，类比方案跨 80 度，这个容差分得开。
    const seedHue = oklch('#4D6BFE')!.h ?? 0
    for (const color of harmonize('#4D6BFE', { scheme: 'duo' }).colors) {
      const h = oklch(color)!.h ?? seedHue
      expect(Math.abs(h - seedHue), color).toBeLessThan(6)
    }
  })

  it('近中性的种子色按同色相处理，不硬拗出彩虹', () => {
    const result = harmonize('#8E8E8E', { scheme: 'analogous' })
    for (const color of result.colors) {
      expect(oklch(color)!.c, color).toBeLessThan(0.06)
    }
  })

  it('第二个种子色会改变结果', () => {
    expect(harmonize('#4796E3', { seed2: '#CA6673' }).colors).not.toEqual(
      harmonize('#4796E3').colors,
    )
  })

  it('无法解析的种子色不抛错，仍返回完整结果', () => {
    const result = harmonize('这不是颜色')
    expect(result.colors).toHaveLength(6)
    expect(result.colors.every((c) => HEX.test(c))).toBe(true)
    expect(result.bg).toMatch(HEX)
  })

  it('无法解析的第二种子色被忽略', () => {
    expect(harmonize('#4796E3', { seed2: '也不是颜色' })).toEqual(harmonize('#4796E3'))
  })
})
