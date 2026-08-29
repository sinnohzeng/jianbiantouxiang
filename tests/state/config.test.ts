import { describe, expect, it } from 'vitest'
import { CURATED_FONTS } from '@/fonts/curated'
import { LOCALES } from '@/i18n'
import { DEFAULT_CONFIG, LOCALE_DEFAULT_FONT, configHash, normalizeConfig } from '@/state/config'

describe('normalizeConfig 补默认', () => {
  it('空输入返回一份完整默认配置', () => {
    expect(normalizeConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it('非对象输入也不抛错', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig('这不是配置')).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig(42)).toEqual(DEFAULT_CONFIG)
  })

  it('只给局部字段时其余保持默认', () => {
    const config = normalizeConfig({ text: '猪猪家族', canvas: { width: 2048 } })
    expect(config.text).toBe('猪猪家族')
    expect(config.canvas.width).toBe(2048)
    expect(config.canvas.height).toBe(DEFAULT_CONFIG.canvas.height)
    expect(config.typography).toEqual(DEFAULT_CONFIG.typography)
  })

  it('v 恒为 3', () => {
    expect(normalizeConfig({ v: 2 }).v).toBe(3)
  })
})

describe('normalizeConfig 夹值与校验', () => {
  it('数值超界被夹回区间端点', () => {
    const config = normalizeConfig({
      highlight: 9,
      styleParams: { intensity: -3, scale: 99, rotation: -10 },
      canvas: { width: 100000, height: 1, radius: 5 },
      typography: { fontSize: 0, padding: 2, lineHeight: 0.1, letterSpacing: 3, offsetX: -9 },
    })
    expect(config.highlight).toBe(1)
    expect(config.styleParams.intensity).toBe(0)
    expect(config.styleParams.scale).toBe(2)
    expect(config.styleParams.rotation).toBe(0)
    expect(config.canvas.width).toBe(8192)
    expect(config.canvas.height).toBe(64)
    expect(config.canvas.radius).toBe(0.5)
    expect(config.typography.fontSize).toBe(0.04)
    expect(config.typography.padding).toBe(0.3)
    expect(config.typography.lineHeight).toBe(0.85)
    expect(config.typography.letterSpacing).toBe(0.5)
    expect(config.typography.offsetX).toBe(-0.5)
  })

  it('NaN 与非数值回落到默认', () => {
    const config = normalizeConfig({
      highlight: Number.NaN,
      styleParams: { softness: 'soft', grain: Number.POSITIVE_INFINITY },
      canvas: { width: '很宽' },
    })
    expect(config.highlight).toBe(DEFAULT_CONFIG.highlight)
    expect(config.styleParams.softness).toBe(DEFAULT_CONFIG.styleParams.softness)
    expect(config.styleParams.grain).toBe(DEFAULT_CONFIG.styleParams.grain)
    expect(config.canvas.width).toBe(DEFAULT_CONFIG.canvas.width)
  })

  it('画布边长取整', () => {
    expect(normalizeConfig({ canvas: { width: 1023.6 } }).canvas.width).toBe(1024)
  })

  it('非法枚举回落到默认', () => {
    const config = normalizeConfig({
      style: 'plasma',
      canvas: { shape: 'triangle' },
      typography: { anchor: 'zz', align: 'justify', effect: 'emboss' },
      exportOptions: { format: 'gif', sizeTarget: '10mb' },
    })
    expect(config.style).toBe('mesh')
    expect(config.canvas.shape).toBe('rounded')
    expect(config.typography.anchor).toBe('c')
    expect(config.typography.align).toBe('center')
    expect(config.typography.effect).toBe('glow')
    expect(config.exportOptions.format).toBe('jpg')
    expect(config.exportOptions.sizeTarget).toBe('1mb')
  })

  it('合法枚举原样保留', () => {
    const config = normalizeConfig({
      style: 'silk',
      canvas: { shape: 'circle' },
      typography: { anchor: 'br', align: 'right', effect: 'glow', fontSource: 'upload' },
      exportOptions: { format: 'webp', sizeTarget: 'none' },
    })
    expect(config.style).toBe('silk')
    expect(config.canvas.shape).toBe('circle')
    expect(config.typography.anchor).toBe('br')
    expect(config.typography.effect).toBe('glow')
    expect(config.exportOptions.format).toBe('webp')
  })

  it('自定义配色过滤非法值、补全三位写法、最多留 6 个', () => {
    const config = normalizeConfig({
      customColors: ['#FFF', 'red', '#123456', 42, '#abcdef', '#111', '#222', '#333', '#444'],
    })
    expect(config.customColors).toEqual([
      '#ffffff',
      '#123456',
      '#abcdef',
      '#111111',
      '#222222',
      '#333333',
    ])
  })

  it('非数组的自定义配色回落到默认', () => {
    expect(normalizeConfig({ customColors: '#fff' }).customColors).toEqual([])
  })

  it('颜色字段非法时回落到默认', () => {
    const config = normalizeConfig({
      typography: { color: 'chartreuse' },
      exportOptions: { bgColor: '#GGGGGG' },
    })
    expect(config.typography.color).toBe(DEFAULT_CONFIG.typography.color)
    expect(config.exportOptions.bgColor).toBe(DEFAULT_CONFIG.exportOptions.bgColor)
  })

  it('布尔字段只接受布尔值', () => {
    const config = normalizeConfig({ typography: { vertical: 'true', autoWrap: 0 } })
    expect(config.typography.vertical).toBe(DEFAULT_CONFIG.typography.vertical)
    expect(config.typography.autoWrap).toBe(DEFAULT_CONFIG.typography.autoWrap)
  })

  it('归一化是幂等的', () => {
    const once = normalizeConfig({ text: '产品设计部', styleParams: { scale: 1.7 } })
    expect(normalizeConfig(once)).toEqual(once)
  })
})

describe('configHash', () => {
  it('同一配置得到同一哈希', () => {
    expect(configHash(DEFAULT_CONFIG)).toBe(configHash(normalizeConfig({})))
  })

  it('哈希是 8 位小写 hex', () => {
    expect(configHash(DEFAULT_CONFIG)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('键序不影响哈希', () => {
    const a = normalizeConfig({ text: 'AI', style: 'flow' })
    const b = normalizeConfig({ style: 'flow', text: 'AI' })
    expect(configHash(a)).toBe(configHash(b))
  })

  it('任一字段变化都改变哈希', () => {
    const base = configHash(DEFAULT_CONFIG)
    expect(configHash(normalizeConfig({ text: '别的字' }))).not.toBe(base)
    expect(configHash(normalizeConfig({ styleParams: { grain: 0.9 } }))).not.toBe(base)
    expect(configHash(normalizeConfig({ canvas: { width: 2048 } }))).not.toBe(base)
  })
})

describe('LOCALE_DEFAULT_FONT', () => {
  it('五种界面语言各有一套默认字体', () => {
    expect(LOCALE_DEFAULT_FONT).toEqual({
      'zh-CN': 'Noto Sans SC',
      'zh-HK': 'Noto Sans TC',
      en: 'Inter',
      ja: 'Noto Sans JP',
      ko: 'Noto Sans KR',
    })
    for (const locale of LOCALES) {
      expect(LOCALE_DEFAULT_FONT[locale], locale).toBeTruthy()
    }
  })

  it('默认字体都在精选清单里，且带默认字重', () => {
    for (const family of Object.values(LOCALE_DEFAULT_FONT)) {
      const entry = CURATED_FONTS.find((item) => item.family === family)
      expect(entry, family).toBeDefined()
      expect(entry?.weights, family).toContain(DEFAULT_CONFIG.typography.fontWeight)
    }
  })

  it('每种语言的默认字体带对应 subset，字形不会掉回系统字体', () => {
    const subsetsOf = (family: string): string[] =>
      CURATED_FONTS.find((item) => item.family === family)?.subsets ?? []
    expect(subsetsOf(LOCALE_DEFAULT_FONT.ko)).toContain('korean')
    expect(subsetsOf(LOCALE_DEFAULT_FONT.ja)).toContain('japanese')
    expect(subsetsOf(LOCALE_DEFAULT_FONT['zh-HK'])).toContain('chinese-traditional')
    expect(subsetsOf(LOCALE_DEFAULT_FONT['zh-CN'])).toContain('chinese-simplified')
    expect(subsetsOf(LOCALE_DEFAULT_FONT.en)).toContain('latin')
    // 韩文界面配简体字体正是原来的缺陷：谚文不在它的切片里
    expect(subsetsOf(LOCALE_DEFAULT_FONT['zh-CN'])).not.toContain('korean')
  })

  it('简体中文那份与 DEFAULT_CONFIG 一致，默认档不必额外写一次 store', () => {
    expect(LOCALE_DEFAULT_FONT['zh-CN']).toBe(DEFAULT_CONFIG.typography.fontFamily)
  })
})
