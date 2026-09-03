import type { AvatarConfig } from '@/state/config'

/** 配色名与家族名的语言键，与 src/i18n 的五份字典对齐。 */
export type PaletteLocale = 'zh-CN' | 'zh-HK' | 'en' | 'ja' | 'ko'

/** light 配深字（#141413），dark 配白字（#FFFFFF）。 */
export type PaletteTone = 'light' | 'dark'

export type PaletteFamilyId =
  | 'warm-clay'
  | 'blue-mono'
  | 'blue'
  | 'violet'
  | 'violet-pink'
  | 'green'
  | 'teal'
  | 'amber'
  | 'deep-navy'
  | 'neon'
  | 'warm-neutral'
  | 'holographic'
  | 'metallic'
  | 'spectrum'
  | 'mono'

export interface Palette {
  id: string
  family: PaletteFamilyId
  tone: PaletteTone
  /** 2 到 6 个 hex，渐变停靠点，顺序即深到浅（或反之）的排布顺序。 */
  colors: string[]
  /** 推荐文字色。 */
  text: string
  /** 画布留白与 JPG 底色用的低饱和基底，不进渐变。 */
  bg: string
  name: Record<PaletteLocale, string>
}

export interface PaletteFamily {
  id: PaletteFamilyId
  name: Record<PaletteLocale, string>
}

type Names = readonly [zhCN: string, zhHK: string, en: string, ja: string, ko: string]

/** 一行一套配色：id、家族、明暗、色值、文字色、背景色、五语名。 */
type Row = readonly [
  id: string,
  family: PaletteFamilyId,
  tone: PaletteTone,
  colors: readonly string[],
  text: string,
  bg: string,
  names: Names,
]

function toName(names: Names): Record<PaletteLocale, string> {
  return { 'zh-CN': names[0], 'zh-HK': names[1], en: names[2], ja: names[3], ko: names[4] }
}

/**
 * 前 17 套的色值、背景、文字色直接取自调研附录 A（culori 4.0.2 校验，全部停靠点在 sRGB 内），不得改动。
 * 后 9 套由 v2 的 12 套配色（见 git 历史 src/core/palettes.js）筛出，色值原样保留，tone 按 OKLCH 平均明度判定，
 * text 取 #FFFFFF 与 #141413 中对色值均值对比度更高者，bg 按附录 B 第 6 步从最浅色降饱和推得。
 */
const ROWS: readonly Row[] = [
  // 浅底 · 新配色
  [
    'glacier',
    'blue-mono',
    'light',
    ['#5FB4F5', '#8ED0FA', '#A0DAF7', '#C6ECFB', '#E3F5FF'],
    '#141413',
    '#EAF6FD',
    ['冰川蓝', '冰川藍', 'Glacier Blue', 'グレイシャーブルー', '글레이셔 블루'],
  ],
  [
    'coral-dawn',
    'warm-clay',
    'light',
    ['#D97757', '#F0A07A', '#F7C4A5', '#FBD9C9', '#FFF1E8'],
    '#141413',
    '#FBEFE6',
    ['珊瑚日出', '珊瑚日出', 'Coral Dawn', 'コーラルサンライズ', '코랄 선라이즈'],
  ],
  [
    'clay-oat',
    'warm-clay',
    'light',
    ['#C6613F', '#D97757', '#E3B58E', '#E3DACC', '#FAF9F5'],
    '#141413',
    '#F5E3C7',
    ['陶土燕麦', '陶土燕麥', 'Clay Oat', 'テラコッタオート', '테라코타 오트'],
  ],
  [
    'lavender-mist',
    'violet',
    'light',
    ['#8D7CF0', '#B39DF5', '#DFC8F5', '#EAD9FB', '#FFD1D4'],
    '#141413',
    '#F3EEFB',
    ['薰衣草雾', '薰衣草霧', 'Lavender Mist', 'ラベンダーミスト', '라벤더 미스트'],
  ],
  [
    'lime-mint',
    'green',
    'light',
    ['#10A37F', '#5CCB9B', '#B3F4A8', '#DAF5C4', '#F4F9A7'],
    '#141413',
    '#EEFBEF',
    ['青柠薄荷', '青檸薄荷', 'Lime Mint', 'ライムミント', '라임 민트'],
  ],
  [
    'turquoise',
    'teal',
    'light',
    ['#2CA0AB', '#35BDC8', '#6ACBD4', '#92DCE2', '#C4EEF2'],
    '#141413',
    '#DEF7F9',
    ['松石青', '松石青', 'Turquoise', 'ターコイズ', '터콰이즈'],
  ],
  [
    'amber-dusk',
    'amber',
    'light',
    ['#F26A2E', '#FF8A1F', '#FFAF00', '#FFD000', '#FFEBB0'],
    '#141413',
    '#FFF4D6',
    ['琥珀夕照', '琥珀夕照', 'Amber Dusk', 'アンバーサンセット', '앰버 선셋'],
  ],
  [
    'cloud-white',
    'warm-neutral',
    'light',
    ['#F0EEE9', '#E3DACC', '#D8DEE6', '#BFD3E7', '#B0AEA5'],
    '#141413',
    '#F7F3EE',
    ['云舞白', '雲舞白', 'Cloud White', 'クラウドホワイト', '클라우드 화이트'],
  ],
  [
    'holo-iris',
    'holographic',
    'light',
    ['#C8B6FF', '#A0DAF7', '#B3F4A8', '#FFD1D4', '#F4F9A7'],
    '#141413',
    '#F8F5FF',
    ['全息虹彩', '全息虹彩', 'Holo Iris', 'ホログラフィック', '홀로그래픽'],
  ],
  [
    'champagne',
    'metallic',
    'light',
    ['#B08050', '#D4B46A', '#E8D3B0', '#F1E4CC', '#C9B79C'],
    '#141413',
    '#F4ECDC',
    ['香槟金', '香檳金', 'Champagne Gold', 'シャンパンゴールド', '샴페인 골드'],
  ],
  [
    'spectrum-soft',
    'spectrum',
    'light',
    ['#9CC8F5', '#A5E3F7', '#C9E79A', '#FFD2A0', '#F7B5CC', '#D9B3EA'],
    '#141413',
    '#FFFFFF',
    ['光谱柔彩', '光譜柔彩', 'Soft Spectrum', 'ソフトスペクトラム', '소프트 스펙트럼'],
  ],
  [
    'graphite-mist',
    'mono',
    'light',
    ['#E6E8EE', '#D2D6DE', '#B4B8C0', '#9AA0AA', '#FFFFFF'],
    '#141413',
    '#F4F4F5',
    ['石墨浅灰', '石墨淺灰', 'Graphite Mist', 'グラファイトミスト', '그래파이트 미스트'],
  ],
  // 浅底 · v2 保留
  [
    'warm',
    'amber',
    'light',
    ['#FF6B6B', '#FF8E53', '#FFA07A', '#FFB347', '#FF69B4'],
    '#141413',
    '#FDEDDB',
    ['温暖活力', '溫暖活力', 'Warm Vitality', 'ウォームバイタル', '웜 바이탈'],
  ],
  [
    'cool',
    'blue',
    'light',
    ['#4ECDC4', '#45B7D1', '#5B86E5', '#36D1DC', '#6C63FF'],
    '#141413',
    '#DAF7F9',
    ['冷静科技', '冷靜科技', 'Cool Tech', 'クールテック', '쿨 테크'],
  ],
  [
    'sunset',
    'spectrum',
    'light',
    ['#FF5F6D', '#FF9966', '#FFC371', '#FC5C7D', '#B24592'],
    '#141413',
    '#FDEEDB',
    ['落日热情', '落日熱情', 'Sunset Glow', 'サンセットグロー', '선셋 글로우'],
  ],
  [
    'forest',
    'green',
    'light',
    ['#2E8B57', '#6B8E23', '#3CB371', '#8FBC8F', '#BDB76B'],
    '#141413',
    '#F2F1DF',
    ['自然生态', '自然生態', 'Forest', 'フォレスト', '포레스트'],
  ],
  [
    'ocean',
    'blue-mono',
    'light',
    ['#0077B6', '#00B4D8', '#0096C7', '#90E0EF', '#CAF0F8'],
    '#141413',
    '#E9F2F4',
    ['深邃专业', '深邃專業', 'Deep Ocean', 'ディープオーシャン', '딥 오션'],
  ],
  [
    'peach',
    'warm-clay',
    'light',
    ['#FFB5A7', '#FCD5CE', '#F8EDEB', '#F9DCC4', '#FAE1DD'],
    '#141413',
    '#F2EFEF',
    ['桃粉柔和', '桃粉柔和', 'Soft Peach', 'ソフトピーチ', '소프트 피치'],
  ],
  [
    'mint',
    'green',
    'light',
    ['#B5EAD7', '#C7F0DB', '#E2F0CB', '#FFDAC1', '#95E1D3'],
    '#141413',
    '#EEF2E9',
    ['薄荷清新', '薄荷清新', 'Fresh Mint', 'フレッシュミント', '프레시 민트'],
  ],
  [
    'aurora',
    'holographic',
    'light',
    ['#C3B1E1', '#A2D2FF', '#FFAFCC', '#BDE0FE', '#CDB4DB'],
    '#141413',
    '#E9F1F9',
    ['极光梦幻', '極光夢幻', 'Aurora Dream', 'オーロラドリーム', '오로라 드림'],
  ],
  [
    'blush',
    'warm-clay',
    'light',
    ['#FFCDB2', '#FFB4A2', '#E5989B', '#F4ACB7', '#FFCAD4'],
    '#141413',
    '#FAECEE',
    ['腮红暖粉', '腮紅暖粉', 'Blush Pink', 'ブラッシュピンク', '블러시 핑크'],
  ],
  // 深底 · 新配色
  [
    'electric-blue',
    'blue',
    'dark',
    ['#002F5B', '#1E48C8', '#4D6BFE', '#2F8CFF', '#5FA3FF'],
    '#FFFFFF',
    '#0A0F1E',
    ['电光蓝', '電光藍', 'Electric Blue', 'エレクトリックブルー', '일렉트릭 블루'],
  ],
  [
    'aurora-violet',
    'violet-pink',
    'dark',
    ['#3F7FD0', '#5E6FCB', '#7E64B5', '#A65C90', '#C05868'],
    '#FFFFFF',
    '#1B1638',
    ['极光蓝紫', '極光藍紫', 'Aurora Violet', 'オーロラバイオレット', '오로라 바이올렛'],
  ],
  [
    'deep-space',
    'deep-navy',
    'dark',
    ['#111827', '#1E2A4A', '#2B3A67', '#3B4C8C', '#5865F2'],
    '#FFFFFF',
    '#0B0E14',
    ['深空', '深空', 'Deep Space', 'ディープスペース', '딥 스페이스'],
  ],
  [
    'neon-tide',
    'neon',
    'dark',
    ['#1C2B6B', '#3B7BFF', '#6A3BE2', '#A82BB2', '#0E5F5A'],
    '#FFFFFF',
    '#070A0F',
    ['霓虹暗潮', '霓虹暗潮', 'Neon Tide', 'ネオンタイド', '네온 타이드'],
  ],
  [
    'ink-black',
    'mono',
    'dark',
    ['#141413', '#2B2F36', '#3D3D3A', '#4B5563', '#1E1F22'],
    '#FFFFFF',
    '#080808',
    ['墨黑单色', '墨黑單色', 'Ink Black', 'インクブラック', '잉크 블랙'],
  ],
  [
    'clear-sky',
    'blue',
    'light',
    ['#E3EEFF', '#B9D4FF', '#8FBBFF', '#66A3FF', '#4A8EFF'],
    '#141413',
    '#F4F8FF',
    ['晴空', '晴空', 'Clear Sky', 'クリアスカイ', '클리어 스카이'],
  ],
]

export const PALETTES: Palette[] = ROWS.map(([id, family, tone, colors, text, bg, names]) => ({
  id,
  family,
  tone,
  colors: [...colors],
  text,
  bg,
  name: toName(names),
}))

const FAMILY_NAMES: Record<PaletteFamilyId, Names> = {
  'warm-clay': ['暖陶土', '暖陶土', 'Warm Clay', 'ウォームクレイ', '웜 클레이'],
  'blue-mono': ['蓝色单色', '藍色單色', 'Mono Blue', 'モノブルー', '모노 블루'],
  blue: ['蓝色', '藍色', 'Blue', 'ブルー', '블루'],
  violet: ['蓝紫', '藍紫', 'Violet', 'バイオレット', '바이올렛'],
  'violet-pink': ['蓝紫粉', '藍紫粉', 'Violet Pink', 'バイオレットピンク', '바이올렛 핑크'],
  green: ['绿色', '綠色', 'Green', 'グリーン', '그린'],
  teal: ['青色', '青色', 'Teal', 'ティール', '틸'],
  amber: ['暖橙黄', '暖橙黃', 'Amber', 'アンバー', '앰버'],
  'deep-navy': ['深蓝中性', '深藍中性', 'Deep Navy', 'ディープネイビー', '딥 네이비'],
  neon: ['霓虹', '霓虹', 'Neon', 'ネオン', '네온'],
  'warm-neutral': ['暖白中性', '暖白中性', 'Warm Neutral', 'ウォームニュートラル', '웜 뉴트럴'],
  holographic: ['柔彩全息', '柔彩全息', 'Holographic', 'ホログラフィック', '홀로그래픽'],
  metallic: ['去饱和金属', '去飽和金屬', 'Muted Metal', 'メタリック', '메탈릭'],
  spectrum: ['多色丝带', '多色絲帶', 'Spectrum', 'スペクトラム', '스펙트럼'],
  mono: ['黑白极简', '黑白極簡', 'Monochrome', 'モノクローム', '모노크롬'],
}

/** 家族筛选项，顺序即配色里首次出现的顺序。 */
export const PALETTE_FAMILIES: PaletteFamily[] = (() => {
  const seen = new Set<PaletteFamilyId>()
  const out: PaletteFamily[] = []
  for (const palette of PALETTES) {
    if (seen.has(palette.family)) continue
    seen.add(palette.family)
    out.push({ id: palette.family, name: toName(FAMILY_NAMES[palette.family]) })
  }
  return out
})()

/**
 * 推荐文字色对最差停靠点低于 WCAG 4.5 的配色。文字压在这些配色的极端色斑上时，
 * 自动文字色会判失败，UI 据此默认开启胶囊底而不是换色。
 */
export const PLATE_HINT_IDS: readonly string[] = [
  'cool',
  'sunset',
  'forest',
  'ocean',
  'electric-blue',
  'aurora-violet',
  'neon-tide',
]

const BY_ID = new Map(PALETTES.map((palette) => [palette.id, palette]))

/** 默认配色，也是 id 查不到时的兜底。 */
export const DEFAULT_PALETTE_ID = 'glacier'
const FALLBACK: Palette = BY_ID.get(DEFAULT_PALETTE_ID) ?? PALETTES[0]!

export function getPalette(id: string): Palette | undefined {
  return BY_ID.get(id)
}

/** 取当前配置该用的色值：custom 且给够 2 色时用自定义色，否则回到内置配色。 */
export function paletteColors(config: AvatarConfig): string[] {
  if (config.palette === 'custom' && config.customColors.length >= 2) {
    return config.customColors.slice(0, 6)
  }
  return [...(getPalette(config.palette) ?? FALLBACK).colors]
}
