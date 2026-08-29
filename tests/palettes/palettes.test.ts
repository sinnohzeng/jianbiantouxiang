import { describe, expect, it } from 'vitest'
import { oklab, wcagContrast } from '@/palettes/culori'
import {
  DEFAULT_PALETTE_ID,
  PALETTES,
  PALETTE_FAMILIES,
  PLATE_HINT_IDS,
  getPalette,
  paletteColors,
  type PaletteLocale,
} from '@/palettes/palettes'
import { DEFAULT_CONFIG, normalizeConfig } from '@/state/config'

const HEX = /^#[0-9A-Fa-f]{6}$/
const LOCALES: PaletteLocale[] = ['zh-CN', 'zh-HK', 'en', 'ja', 'ko']

/**
 * 附录 A 提到这两套按 WCAG 单门槛卡最差停靠点过不了 4.5，属已知偏低；
 * 判定用的是色值均值而不是单个停靠点，所以这里只把门槛放宽到 2.5。
 */
const LOW_CONTRAST_IDS = new Set(['electric-blue', 'aurora-violet'])

function meanContrast(text: string, colors: readonly string[]): number {
  let l = 0
  let a = 0
  let b = 0
  for (const color of colors) {
    const c = oklab(color)!
    l += c.l / colors.length
    a += c.a / colors.length
    b += c.b / colors.length
  }
  return wcagContrast(text, { mode: 'oklab', l, a, b })
}

describe('PALETTES 结构', () => {
  it('至少 24 套', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(24)
  })

  it('id 唯一', () => {
    const ids = PALETTES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每套 2 到 6 色，色值、文字色、背景色都是合法 hex', () => {
    for (const palette of PALETTES) {
      expect(palette.colors.length, palette.id).toBeGreaterThanOrEqual(2)
      expect(palette.colors.length, palette.id).toBeLessThanOrEqual(6)
      for (const color of palette.colors) expect(color, palette.id).toMatch(HEX)
      expect(palette.text, palette.id).toMatch(HEX)
      expect(palette.bg, palette.id).toMatch(HEX)
    }
  })

  it('浅底配深字、深底配白字', () => {
    for (const palette of PALETTES) {
      expect(palette.text, palette.id).toBe(palette.tone === 'light' ? '#141413' : '#FFFFFF')
    }
  })

  it('每套五种语言的名字都在且不为空', () => {
    for (const palette of PALETTES) {
      for (const locale of LOCALES) {
        expect(palette.name[locale], `${palette.id} ${locale}`).toBeTruthy()
      }
    }
  })

  it('文字色对色值均值的对比度达标', () => {
    for (const palette of PALETTES) {
      const min = LOW_CONTRAST_IDS.has(palette.id) ? 2.5 : 3
      expect(meanContrast(palette.text, palette.colors), palette.id).toBeGreaterThanOrEqual(min)
    }
  })

  it('PLATE_HINT_IDS 恰好是最差停靠点低于 WCAG 4.5 的那些', () => {
    const actual = PALETTES.filter(
      (p) => Math.min(...p.colors.map((c) => wcagContrast(p.text, c))) < 4.5,
    ).map((p) => p.id)
    expect([...actual].sort()).toEqual([...PLATE_HINT_IDS].sort())
  })
})

describe('附录 A 的 17 套色值原样入库', () => {
  const APPENDIX: Record<string, [colors: string, bg: string]> = {
    'coral-dawn': ['#D97757 #F0A07A #F7C4A5 #FBD9C9 #FFF1E8', '#FBEFE6'],
    'clay-oat': ['#C6613F #D97757 #E3B58E #E3DACC #FAF9F5', '#F5E3C7'],
    glacier: ['#5FB4F5 #8ED0FA #A0DAF7 #C6ECFB #E3F5FF', '#EAF6FD'],
    'electric-blue': ['#002F5B #1E48C8 #4D6BFE #2F8CFF #5FA3FF', '#0A0F1E'],
    'lavender-mist': ['#8D7CF0 #B39DF5 #DFC8F5 #EAD9FB #FFD1D4', '#F3EEFB'],
    'aurora-violet': ['#3F7FD0 #5E6FCB #7E64B5 #A65C90 #C05868', '#1B1638'],
    'lime-mint': ['#10A37F #5CCB9B #B3F4A8 #DAF5C4 #F4F9A7', '#EEFBEF'],
    turquoise: ['#2CA0AB #35BDC8 #6ACBD4 #92DCE2 #C4EEF2', '#DEF7F9'],
    'amber-dusk': ['#F26A2E #FF8A1F #FFAF00 #FFD000 #FFEBB0', '#FFF4D6'],
    'deep-space': ['#111827 #1E2A4A #2B3A67 #3B4C8C #5865F2', '#0B0E14'],
    'neon-tide': ['#1C2B6B #3B7BFF #6A3BE2 #A82BB2 #0E5F5A', '#070A0F'],
    'cloud-white': ['#F0EEE9 #E3DACC #D8DEE6 #BFD3E7 #B0AEA5', '#F7F3EE'],
    'holo-iris': ['#C8B6FF #A0DAF7 #B3F4A8 #FFD1D4 #F4F9A7', '#F8F5FF'],
    champagne: ['#B08050 #D4B46A #E8D3B0 #F1E4CC #C9B79C', '#F4ECDC'],
    'spectrum-soft': ['#9CC8F5 #A5E3F7 #C9E79A #FFD2A0 #F7B5CC #D9B3EA', '#FFFFFF'],
    'graphite-mist': ['#E6E8EE #D2D6DE #B4B8C0 #9AA0AA #FFFFFF', '#F4F4F5'],
    'ink-black': ['#141413 #2B2F36 #3D3D3A #4B5563 #1E1F22', '#080808'],
  }

  it('17 套全部收入且色值与背景色一字不差', () => {
    for (const [id, [colors, bg]] of Object.entries(APPENDIX)) {
      const palette = getPalette(id)
      expect(palette, id).toBeDefined()
      expect(palette!.colors.join(' '), id).toBe(colors)
      expect(palette!.bg, id).toBe(bg)
    }
  })

  it('另有至少 7 套来自 v2', () => {
    const legacy = PALETTES.filter((p) => !(p.id in APPENDIX))
    expect(legacy.length).toBeGreaterThanOrEqual(7)
  })
})

describe('getPalette 与 paletteColors', () => {
  it('默认配色 glacier 存在，且与 DEFAULT_CONFIG 对得上', () => {
    expect(getPalette('glacier')).toBeDefined()
    expect(DEFAULT_PALETTE_ID).toBe('glacier')
    expect(DEFAULT_CONFIG.palette).toBe('glacier')
  })

  it('查不到的 id 返回 undefined', () => {
    expect(getPalette('没有这套')).toBeUndefined()
  })

  it('按配置取色：内置 id 取内置色', () => {
    const config = normalizeConfig({ palette: 'ink-black' })
    expect(paletteColors(config)).toEqual(getPalette('ink-black')!.colors)
  })

  it('custom 且给够 2 色时用自定义色', () => {
    const config = normalizeConfig({ palette: 'custom', customColors: ['#112233', '#445566'] })
    expect(paletteColors(config)).toEqual(['#112233', '#445566'])
  })

  it('custom 但色不够、或 id 不认识时回到默认配色', () => {
    const short = normalizeConfig({ palette: 'custom', customColors: ['#112233'] })
    expect(paletteColors(short)).toEqual(getPalette('glacier')!.colors)
    const unknown = normalizeConfig({ palette: '不存在的配色' })
    expect(paletteColors(unknown)).toEqual(getPalette('glacier')!.colors)
  })

  it('返回的是副本，改它不会污染配色表', () => {
    const colors = paletteColors(normalizeConfig({ palette: 'glacier' }))
    colors[0] = '#000000'
    expect(getPalette('glacier')!.colors[0]).toBe('#5FB4F5')
  })
})

describe('PALETTE_FAMILIES', () => {
  it('覆盖所有配色用到的家族且不重复', () => {
    const used = new Set(PALETTES.map((p) => p.family))
    const listed = PALETTE_FAMILIES.map((f) => f.id)
    expect(new Set(listed).size).toBe(listed.length)
    expect(new Set(listed)).toEqual(used)
  })

  it('每个家族有五种语言的名字', () => {
    for (const family of PALETTE_FAMILIES) {
      for (const locale of LOCALES) {
        expect(family.name[locale], `${family.id} ${locale}`).toBeTruthy()
      }
    }
  })
})
