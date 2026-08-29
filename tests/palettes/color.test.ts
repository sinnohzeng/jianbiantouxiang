import { describe, expect, it } from 'vitest'
import { displayable, oklch } from 'culori'
import {
  TEXT_DARK,
  TEXT_LIGHT,
  averageLightness,
  contrastRatio,
  isLight,
  mixOklch,
  paletteThumbCss,
  relativeLuminance,
} from '@/palettes/color'

describe('relativeLuminance', () => {
  it('黑白两端为 0 与 1', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5)
  })

  it('解析不了的颜色按 0 处理，不抛错', () => {
    expect(relativeLuminance('不是颜色')).toBe(0)
  })
})

describe('contrastRatio', () => {
  it('黑白对比度为 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2)
  })

  it('同色为 1，与顺序无关', () => {
    expect(contrastRatio('#5FB4F5', '#5FB4F5')).toBeCloseTo(1, 5)
    expect(contrastRatio('#141413', '#EAF6FD')).toBeCloseTo(contrastRatio('#EAF6FD', '#141413'), 5)
  })

  it('非法输入返回 1', () => {
    expect(contrastRatio('#FFFFFF', 'nope')).toBe(1)
  })
})

describe('isLight', () => {
  it('浅色底判为浅，深色底判为深', () => {
    expect(isLight('#FFFFFF')).toBe(true)
    expect(isLight('#E3F5FF')).toBe(true)
    expect(isLight('#000000')).toBe(false)
    expect(isLight('#1B1638')).toBe(false)
  })

  it('判定与实际更清楚的文字色一致', () => {
    for (const hex of ['#FFFFFF', '#808080', '#5FB4F5', '#2B3A67', '#000000']) {
      const better = contrastRatio(hex, TEXT_DARK) >= contrastRatio(hex, TEXT_LIGHT)
      expect(isLight(hex), hex).toBe(better)
    }
  })
})

describe('averageLightness', () => {
  it('黑白各半约在中间', () => {
    expect(averageLightness(['#000000', '#FFFFFF'])).toBeCloseTo(0.5, 2)
  })

  it('浅色配色高于深色配色', () => {
    const light = averageLightness(['#5FB4F5', '#8ED0FA', '#A0DAF7', '#C6ECFB', '#E3F5FF'])
    const dark = averageLightness(['#111827', '#1E2A4A', '#2B3A67', '#3B4C8C', '#5865F2'])
    expect(light).toBeGreaterThan(0.6)
    expect(dark).toBeLessThan(0.6)
    expect(light).toBeGreaterThan(dark)
  })

  it('空数组与全非法输入返回 0', () => {
    expect(averageLightness([])).toBe(0)
    expect(averageLightness(['xxx'])).toBe(0)
  })
})

describe('mixOklch', () => {
  it('两端分别还原两个输入色', () => {
    expect(mixOklch('#D97757', '#5FB4F5', 0)).toBe('#d97757')
    expect(mixOklch('#D97757', '#5FB4F5', 1)).toBe('#5fb4f5')
  })

  it('中点明度落在两端之间，且不发灰', () => {
    const mid = mixOklch('#002F5B', '#E3F5FF', 0.5)
    const a = oklch('#002F5B')!
    const b = oklch('#E3F5FF')!
    const m = oklch(mid)!
    expect(m.l).toBeGreaterThan(a.l)
    expect(m.l).toBeLessThan(b.l)
    expect(m.c).toBeGreaterThan(0.01)
  })

  it('t 超界被夹在 0 到 1', () => {
    expect(mixOklch('#D97757', '#5FB4F5', -2)).toBe(mixOklch('#D97757', '#5FB4F5', 0))
    expect(mixOklch('#D97757', '#5FB4F5', 9)).toBe(mixOklch('#D97757', '#5FB4F5', 1))
  })

  it('结果始终在 sRGB 内', () => {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const hex = mixOklch('#10A37F', '#A82BB2', t)
      expect(hex, `t=${t}`).toMatch(/^#[0-9a-f]{6}$/)
      expect(displayable(hex), `t=${t}`).toBe(true)
    }
  })

  it('一端非法时返回另一端，两端都非法返回黑色', () => {
    expect(mixOklch('nope', '#5FB4F5', 0.5)).toBe('#5fb4f5')
    expect(mixOklch('#5FB4F5', 'nope', 0.5)).toBe('#5fb4f5')
    expect(mixOklch('nope', 'nope', 0.5)).toBe('#000000')
  })
})

describe('paletteThumbCss', () => {
  it('多色按等距停靠点铺开', () => {
    expect(paletteThumbCss(['#000000', '#888888', '#FFFFFF'])).toBe(
      'linear-gradient(135deg, #000000 0%, #888888 50%, #FFFFFF 100%)',
    )
  })

  it('单色也给出完整渐变', () => {
    expect(paletteThumbCss(['#5FB4F5'])).toBe('linear-gradient(135deg, #5FB4F5 0%, #5FB4F5 100%)')
  })

  it('空数组返回 none', () => {
    expect(paletteThumbCss([])).toBe('none')
  })

  it('六色时首尾停靠点是 0% 与 100%', () => {
    const css = paletteThumbCss(['#9CC8F5', '#A5E3F7', '#C9E79A', '#FFD2A0', '#F7B5CC', '#D9B3EA'])
    expect(css).toContain('#9CC8F5 0%')
    expect(css).toContain('#D9B3EA 100%')
  })
})
