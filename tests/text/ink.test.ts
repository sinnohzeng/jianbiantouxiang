import { describe, expect, it } from 'vitest'
import { INK_DARK, INK_LIGHT, contrastRatio, isLightColor, relativeLuminance } from '@/text/ink'

describe('色彩计算', () => {
  it('相对亮度覆盖黑白两端', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1)
    expect(relativeLuminance('#000000')).toBeCloseTo(0)
  })

  it('对比度上限 21', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1)
  })

  it('三位 hex 与省略井号都能解析', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1)
    expect(relativeLuminance('ffffff')).toBeCloseTo(1)
  })

  it('坏值当黑色处理，不抛错', () => {
    expect(relativeLuminance('#zzzzzz')).toBeCloseTo(0)
    expect(relativeLuminance('')).toBeCloseTo(0)
  })

  it('明暗判定用白黑等对比度的分界点', () => {
    expect(isLightColor('#FFFFFF')).toBe(true)
    expect(isLightColor('#141413')).toBe(false)
    expect(isLightColor(INK_LIGHT)).toBe(true)
    expect(isLightColor(INK_DARK)).toBe(false)
  })
})
