import { describe, expect, it } from 'vitest'
import { CURATED_FONTS } from '@/fonts/curated'
import { LOCALES } from '@/i18n'
import {
  DEFAULT_CONFIG,
  FOLLOW_LINE1,
  LOCALE_DEFAULT_FONT,
  configHash,
  fontKey,
  lineFont,
  nearestWeight,
  normalizeConfig,
  withLine1Font,
  withLine2Font,
  type AvatarConfig,
  type FontChoice,
} from '@/state/config'

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

  it('默认是方形、白色文字、15% 边距、1.03 行高与两行示例', () => {
    expect(DEFAULT_CONFIG.canvas.shape).toBe('square')
    expect(DEFAULT_CONFIG.text).toBe('飞书\n效率先锋')
    expect(DEFAULT_CONFIG.typography.color).toBe('#ffffff')
    expect(DEFAULT_CONFIG.typography.padding).toBe(0.15)
    expect(DEFAULT_CONFIG.typography.lineHeight).toBe(1.03)
    expect(DEFAULT_CONFIG.typography.line1).toEqual({
      font: { family: 'Noto Sans SC', source: 'google', weight: 700 },
      size: null,
      offsetX: 0,
      offsetY: 0,
    })
    expect(DEFAULT_CONFIG.typography.line2).toEqual({
      font: null,
      size: null,
      offsetX: 0,
      offsetY: 0,
    })
    expect(DEFAULT_CONFIG.layout.graphicOffsetY).toBe(0)
  })

  it('显式给出的旧默认值不会被新默认值覆盖', () => {
    const config = normalizeConfig({ typography: { padding: 0.1, lineHeight: 1.15 } })
    expect(config.typography.padding).toBe(0.1)
    expect(config.typography.lineHeight).toBe(1.15)
  })
})

describe('normalizeConfig 夹值与校验', () => {
  it('数值超界被夹回区间端点', () => {
    const config = normalizeConfig({
      highlight: 9,
      styleParams: { intensity: -3, scale: 99, rotation: -10 },
      canvas: { width: 100000, height: 1, radius: 5 },
      typography: {
        line1: { size: 0, offsetX: -9, offsetY: 9 },
        line2: { size: 0, offsetX: 9, offsetY: -9 },
        padding: 2,
        lineHeight: 0.1,
        letterSpacing: 3,
      },
    })
    expect(config.highlight).toBe(1)
    expect(config.styleParams.intensity).toBe(0)
    expect(config.styleParams.scale).toBe(2)
    expect(config.styleParams.rotation).toBe(0)
    expect(config.canvas.width).toBe(8192)
    expect(config.canvas.height).toBe(64)
    expect(config.canvas.radius).toBe(0.5)
    expect(config.typography.line1.size).toBe(0.04)
    expect(config.typography.line2.size).toBe(0.02)
    expect(config.typography.padding).toBe(0.3)
    expect(config.typography.lineHeight).toBe(0.85)
    expect(config.typography.letterSpacing).toBe(0.5)
    expect(config.typography.line1.offsetX).toBe(-0.25)
    expect(config.typography.line1.offsetY).toBe(0.25)
    expect(config.typography.line2.offsetX).toBe(0.25)
    expect(config.typography.line2.offsetY).toBe(-0.25)
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
      typography: { effect: 'emboss' },
      exportOptions: { format: 'gif', sizeTarget: '10mb' },
    })
    expect(config.style).toBe('mesh')
    expect(config.canvas.shape).toBe('square')
    expect(config.typography.effect).toBe('shadow')
    expect(config.exportOptions.format).toBe('jpg')
    expect(config.exportOptions.sizeTarget).toBe('2mb')
  })

  it('合法枚举原样保留', () => {
    const config = normalizeConfig({
      style: 'silk',
      canvas: { shape: 'circle' },
      typography: { effect: 'glow', line1: { font: { family: 'Mine-upload', source: 'upload' } } },
      exportOptions: { format: 'webp', sizeTarget: 'none' },
    })
    expect(config.style).toBe('silk')
    expect(config.canvas.shape).toBe('circle')
    expect(config.typography.effect).toBe('glow')
    expect(config.typography.line1.font.source).toBe('upload')
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

  it('归一化是幂等的', () => {
    const once = normalizeConfig({ text: '产品设计部', styleParams: { scale: 1.7 } })
    expect(normalizeConfig(once)).toEqual(once)
  })
})

describe('normalizeConfig 的 layout 子树', () => {
  it('缺 layout 的旧配置补成默认版式', () => {
    const config = normalizeConfig({ text: '产品设计部', typography: { line1: { size: 0.5 } } })
    expect(config.layout).toEqual(DEFAULT_CONFIG.layout)
  })

  it('kind 退役：旧用途字段读进来即忽略', () => {
    expect(normalizeConfig({ layout: { kind: 'status' } }).layout).toEqual(DEFAULT_CONFIG.layout)
    expect('kind' in normalizeConfig({ layout: { kind: 'logo' } }).layout).toBe(false)
  })

  it('三行以上文字：第三行起并入第二行', () => {
    expect(normalizeConfig({ text: '一行\n二行\n三行\n四行' }).text).toBe('一行\n二行三行四行')
    expect(normalizeConfig({ text: '甲\n乙\n丙' }).text).toBe('甲\n乙丙')
  })

  it('前导空行保留槽位：第一行空、第二行有内容是合法的图标加说明形态', () => {
    expect(normalizeConfig({ text: '\n第二行' }).text).toBe('\n第二行')
  })

  it('graphic 与 icon 同轮补默认并夹值', () => {
    expect(normalizeConfig({ layout: {} }).layout).toEqual({
      graphic: DEFAULT_CONFIG.layout.graphic,
      graphicOffsetX: DEFAULT_CONFIG.layout.graphicOffsetX,
      graphicOffsetY: DEFAULT_CONFIG.layout.graphicOffsetY,
      icon: { source: 'none', id: '', mono: false },
    })

    // 两向补偿超界都要夹回来，老存档没有这两个字段就落到 0
    expect(normalizeConfig({ layout: { graphicOffsetX: 9 } }).layout.graphicOffsetX).toBe(0.25)
    expect(normalizeConfig({ layout: { graphicOffsetX: -9 } }).layout.graphicOffsetX).toBe(-0.25)
    expect(normalizeConfig({ layout: { graphicOffsetY: 9 } }).layout.graphicOffsetY).toBe(0.25)
    expect(normalizeConfig({ layout: { graphicOffsetY: -9 } }).layout.graphicOffsetY).toBe(-0.25)

    const config = normalizeConfig({
      layout: {
        graphic: 0.1,
        icon: { source: 'emoji', id: '1f334' },
      },
    })
    expect(config.layout.graphic).toBe(0.3)
    expect(config.layout.icon).toEqual({ source: 'emoji', id: '1f334', mono: false })
  })

  it('graphic 夹在 0.3..0.8，非法值回落默认', () => {
    expect(normalizeConfig({ layout: { graphic: 0 } }).layout.graphic).toBe(0.3)
    expect(normalizeConfig({ layout: { graphic: 0.3 } }).layout.graphic).toBe(0.3)
    expect(normalizeConfig({ layout: { graphic: 0.8 } }).layout.graphic).toBe(0.8)
    expect(normalizeConfig({ layout: { graphic: 9 } }).layout.graphic).toBe(0.8)
    expect(normalizeConfig({ layout: { graphic: 'wide' } }).layout.graphic).toBe(
      DEFAULT_CONFIG.layout.graphic,
    )
  })

  it('icon source 校验，none 强制清空 id，超长 id 拒绝', () => {
    expect(normalizeConfig({ layout: { icon: { source: 'photo', id: 'x' } } }).layout.icon).toEqual(
      { source: 'none', id: '', mono: false },
    )
    expect(
      normalizeConfig({ layout: { icon: { source: 'none', id: '1f334' } } }).layout.icon,
    ).toEqual({ source: 'none', id: '', mono: false })
    expect(
      normalizeConfig({
        layout: { icon: { source: 'emoji', id: 'x'.repeat(129) } },
      }).layout.icon,
    ).toEqual({ source: 'emoji', id: '', mono: false })
  })

  it('icon.mono 只认布尔真，缺省补 false', () => {
    const missing = normalizeConfig({ layout: { icon: { source: 'brand', id: 'github-light' } } })
    expect(missing.layout.icon).toEqual({ source: 'brand', id: 'github-light', mono: false })

    expect(
      normalizeConfig({ layout: { icon: { source: 'brand', id: 'lark', mono: true } } }).layout.icon
        .mono,
    ).toBe(true)
    // 'true'、1 这类真值不认，只有布尔真才算开
    for (const truthy of ['true', 1, {}]) {
      expect(
        normalizeConfig({ layout: { icon: { source: 'brand', id: 'lark', mono: truthy } } }).layout
          .icon.mono,
      ).toBe(false)
    }
  })

  it('逐行补偿缺省补 0，超界夹到 ±0.25', () => {
    const config = normalizeConfig({
      typography: { line1: { offsetX: 0.1 }, line2: { offsetX: -0.4, offsetY: 0.9 } },
    })
    expect(config.typography.line1.offsetX).toBe(0.1)
    expect(config.typography.line1.offsetY).toBe(0)
    expect(config.typography.line2.offsetX).toBe(-0.25)
    expect(config.typography.line2.offsetY).toBe(0.25)
  })

  it('第一行字号夹到 0.04..0.92，null、缺省与非有限数都是自动', () => {
    const size = (value: unknown) =>
      normalizeConfig({ typography: { line1: { size: value } } }).typography.line1.size
    expect(size(0.3)).toBe(0.3)
    expect(size(1.5)).toBe(0.92)
    expect(size(0)).toBe(0.04)
    expect(size(null)).toBeNull()
    expect(size(Number.NaN)).toBeNull()
    expect(size('0.3')).toBeNull()
    expect(normalizeConfig({ typography: {} }).typography.line1.size).toBeNull()
  })

  it('第二行字号夹到 0.02..0.92，null 与缺省都是跟随', () => {
    const size = (value: unknown) =>
      normalizeConfig({ typography: { line2: { size: value } } }).typography.line2.size
    expect(size(0.3)).toBe(0.3)
    expect(size(1.5)).toBe(0.92)
    expect(size(0)).toBe(0.02)
    expect(size(null)).toBeNull()
    expect(size(Number.NaN)).toBeNull()
    expect(normalizeConfig({ typography: {} }).typography.line2.size).toBeNull()
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
    expect(configHash(normalizeConfig({ canvas: { width: 1024 } }))).not.toBe(base)
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
      expect(entry?.weights, family).toContain(DEFAULT_CONFIG.typography.line1.font.weight)
    }
  })

  it('每种语言的默认字体覆盖对应文字，字形不会掉回系统字体', () => {
    const cjkOf = (family: string) => CURATED_FONTS.find((item) => item.family === family)?.cjk
    expect(cjkOf(LOCALE_DEFAULT_FONT.ko)).toBe('kr')
    expect(cjkOf(LOCALE_DEFAULT_FONT.ja)).toBe('jp')
    expect(cjkOf(LOCALE_DEFAULT_FONT['zh-HK'])).toBe('tc')
    expect(cjkOf(LOCALE_DEFAULT_FONT['zh-CN'])).toBe('sc')
    expect(cjkOf(LOCALE_DEFAULT_FONT.en)).toBeUndefined()
  })

  it('简体中文那份与 DEFAULT_CONFIG 一致，默认档不必额外写一次 store', () => {
    expect(LOCALE_DEFAULT_FONT['zh-CN']).toBe(DEFAULT_CONFIG.typography.line1.font.family)
  })
})

describe('字体归一：整份成立或整份作废', () => {
  const line1Font = (font: unknown) =>
    normalizeConfig({ typography: { line1: { font } } }).typography.line1.font
  const line2Font = (font: unknown) =>
    normalizeConfig({ typography: { line2: { font } } }).typography.line2.font

  it('family 去掉空白后为空时作废，第二行回到跟随', () => {
    expect(line2Font({ family: '  ', source: 'google', weight: 400 })).toBeNull()
  })

  it('family 去掉首尾空白后保留', () => {
    expect(line2Font({ family: ' Inter ', source: 'google', weight: 400 })?.family).toBe('Inter')
  })

  it('字重取整到最近的一档，超界夹到 100..900', () => {
    expect(line2Font({ family: 'Inter', source: 'google', weight: 450 })?.weight).toBe(500)
    expect(line2Font({ family: 'Inter', source: 'google', weight: 1000 })?.weight).toBe(900)
    expect(line2Font({ family: 'Inter', source: 'google', weight: 20 })?.weight).toBe(100)
    expect(line2Font({ family: 'Inter', source: 'google' })?.weight).toBe(400)
  })

  it('来源非法时整份作废', () => {
    expect(line2Font({ family: 'Inter', source: 'cdn', weight: 400 })).toBeNull()
    expect(line1Font({ family: 'Inter', source: 'cdn', weight: 400 })).toEqual(
      DEFAULT_CONFIG.typography.line1.font,
    )
  })

  it('第一行字体不是对象时回默认字体', () => {
    expect(line1Font('x')).toEqual(DEFAULT_CONFIG.typography.line1.font)
    expect(line1Font(null)).toEqual(DEFAULT_CONFIG.typography.line1.font)
  })
})

const SC: FontChoice = { family: 'Noto Sans SC', source: 'google', weight: 700 }
const JP: FontChoice = { family: 'Noto Sans JP', source: 'google', weight: 700 }
const KUAILE: FontChoice = { family: 'ZCOOL KuaiLe', source: 'google', weight: 400 }

function typographyWith(line2Font: FontChoice | null): AvatarConfig['typography'] {
  return normalizeConfig({ typography: { line1: { font: SC }, line2: { font: line2Font } } })
    .typography
}

describe('lineFont 与 fontKey', () => {
  it('第二行为 null 时读第一行那款，钉住时读自己的', () => {
    expect(lineFont(typographyWith(null), 2)).toEqual(SC)
    expect(lineFont(typographyWith(KUAILE), 2)).toEqual(KUAILE)
    expect(lineFont(typographyWith(KUAILE), 1)).toEqual(SC)
  })

  it('来源、family、字重任一不同就是另一个键', () => {
    expect(fontKey(SC)).toBe('google|Noto Sans SC|700')
    expect(fontKey({ ...SC, weight: 400 })).not.toBe(fontKey(SC))
    expect(fontKey({ ...SC, source: 'system' })).not.toBe(fontKey(SC))
  })
})

describe('withLine2Font 与 FOLLOW_LINE1', () => {
  it('与第一行全相同时写 null，回到跟随', () => {
    expect(withLine2Font(typographyWith(KUAILE), { ...SC })).toEqual({ line2: { font: null } })
  })

  it('字重不同就钉住', () => {
    const next = { ...SC, weight: 400 as const }
    expect(withLine2Font(typographyWith(null), next)).toEqual({ line2: { font: next } })
  })

  it('FOLLOW_LINE1 把第二行字体写回 null', () => {
    expect(FOLLOW_LINE1).toEqual({ line2: { font: null } })
  })
})

describe('withLine1Font', () => {
  const jpWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

  it('第二行跟随时只写第一行', () => {
    expect(withLine1Font(typographyWith(null), JP, jpWeights)).toEqual({ line1: { font: JP } })
  })

  it('第二行只改过字重时随第一行换款，字重吸附到新字体有的一档', () => {
    const onlyWeight = typographyWith({ ...SC, weight: 400 })
    expect(withLine1Font(onlyWeight, KUAILE, [400])).toEqual({
      line1: { font: KUAILE },
      line2: { font: { ...KUAILE, weight: 400 } },
    })
    const light = typographyWith({ ...SC, weight: 300 })
    expect(withLine1Font(light, JP, [400, 700])).toEqual({
      line1: { font: JP },
      line2: { font: { ...JP, weight: 400 } },
    })
  })

  it('第二行钉在别款字体上时不动', () => {
    expect(withLine1Font(typographyWith(KUAILE), JP, jpWeights)).toEqual({ line1: { font: JP } })
  })
})

describe('nearestWeight', () => {
  it('取最近的一档，等距时偏大', () => {
    expect(nearestWeight([400, 700], 500)).toBe(400)
    expect(nearestWeight([400, 700], 600)).toBe(700)
    expect(nearestWeight([300, 500], 400)).toBe(500)
    expect(nearestWeight([400], 900)).toBe(400)
  })

  it('字重表为空时原样返回目标', () => {
    expect(nearestWeight([], 700)).toBe(700)
  })
})
