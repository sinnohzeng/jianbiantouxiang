import { describe, expect, it } from 'vitest'
import {
  INK_DARK,
  INK_LIGHT,
  contrastRatio,
  isLightColor,
  needsPlate,
  pickTextColor,
  relativeLuminance,
} from '@/text/auto-color'
import { layoutText } from '@/text/layout'
import { createSolidContext, createStubMeasure, makeConfig } from './helpers'

const measure = createStubMeasure()
const config = makeConfig({
  text: '猪猪',
  typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, anchor: 'c' },
})
const layout = layoutText(config, 1000, 1000, measure)

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

  it('明暗判定用白黑等对比度的分界点', () => {
    expect(isLightColor('#FFFFFF')).toBe(true)
    expect(isLightColor('#141413')).toBe(false)
  })
})

describe('pickTextColor', () => {
  it('深色背景选白字', () => {
    expect(pickTextColor(createSolidContext(16, 16, 16), layout, config)).toBe(INK_LIGHT)
  })

  it('浅色背景选深灰', () => {
    expect(pickTextColor(createSolidContext(240, 240, 240), layout, config)).toBe(INK_DARK)
  })

  it('中灰按对比度取深灰', () => {
    expect(pickTextColor(createSolidContext(128, 128, 128), layout, config)).toBe(INK_DARK)
  })

  it('自定义模式直接返回用户选的颜色', () => {
    const custom = makeConfig({
      ...config,
      typography: { ...config.typography, colorMode: 'custom', color: '#ff0066' },
    })
    expect(pickTextColor(createSolidContext(16, 16, 16), layout, custom)).toBe('#ff0066')
  })

  it('半透明像素按导出底色合成', () => {
    const onWhite = makeConfig({ ...config, exportOptions: { bgColor: '#ffffff' } })
    expect(pickTextColor(createSolidContext(0, 0, 0, 0), layout, onWhite)).toBe(INK_DARK)
  })

  it('画布读不出像素时不抛错', () => {
    const broken = {
      canvas: { width: 1000, height: 1000 },
      getImageData: () => {
        throw new Error('tainted')
      },
    } as unknown as CanvasRenderingContext2D
    expect([INK_LIGHT, INK_DARK]).toContain(pickTextColor(broken, layout, config))
  })
})

describe('needsPlate', () => {
  it('黑白都够对比度时不建议底板', () => {
    expect(needsPlate(createSolidContext(255, 255, 255), layout, config)).toBe(false)
    expect(needsPlate(createSolidContext(0, 0, 0), layout, config)).toBe(false)
  })

  it('中间亮度两个候选都不达标时建议底板', () => {
    expect(needsPlate(createSolidContext(122, 122, 122), layout, config)).toBe(true)
  })

  it('自定义颜色由用户负责，不给建议', () => {
    const custom = makeConfig({
      ...config,
      typography: { ...config.typography, colorMode: 'custom' },
    })
    expect(needsPlate(createSolidContext(122, 122, 122), layout, custom)).toBe(false)
  })
})
