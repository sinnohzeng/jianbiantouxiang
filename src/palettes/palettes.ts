import type { AvatarConfig } from '@/state/config'

/** 配色名与家族名的语言键，与 src/i18n 的五份字典对齐。 */
export type PaletteLocale = 'zh-CN' | 'zh-HK' | 'en' | 'ja' | 'ko'

/** light 配深字（#141413），dark 配白字（#FFFFFF）。 */
export type PaletteTone = 'light' | 'dark'

export interface Palette {
  id: string
  tone: PaletteTone
  /** 2 到 6 个 hex，渐变停靠点，顺序即深到浅（或反之）的排布顺序。 */
  colors: string[]
  /** 推荐文字色。 */
  text: string
  /** 画布留白与 JPG 底色用的低饱和基底，不进渐变。 */
  bg: string
  name: Record<PaletteLocale, string>
}

type Names = readonly [zhCN: string, zhHK: string, en: string, ja: string, ko: string]

/** 一行一套配色：id、明暗、色值、文字色、背景色、五语名。 */
type Row = readonly [
  id: string,
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
 * 中间 9 套由 v2 的 12 套配色（见 git 历史 src/core/palettes.js）筛出，色值原样保留，tone 按 OKLCH 平均明度判定，
 * text 取 #FFFFFF 与 #141413 中对色值均值对比度更高者，bg 按附录 B 第 6 步从最浅色降饱和推得。
 *
 * 末尾 11 套是 v5 补的深色系。原来浅底 21 套、深底只有 5 套，「深色系」那一档几乎是空的。
 * 取材自公认的深色界面色族：午夜藏青、深祖母绿、暗琥珀、牛血红、暗紫、深青、
 * 玫瑰午夜、宇宙靛蓝、林夜、古铜、钢灰蓝。每套五档从近黑爬到中明度，
 * OKLab 平均明度都在 0.31 到 0.38 之间，最亮一档不超过 0.60，白字压上去始终读得清。
 */
const ROWS: readonly Row[] = [
  // 浅底 · 新配色
  [
    'glacier',
    'light',
    ['#5FB4F5', '#8ED0FA', '#A0DAF7', '#C6ECFB', '#E3F5FF'],
    '#141413',
    '#EAF6FD',
    ['冰川蓝', '冰川藍', 'Glacier Blue', 'グレイシャーブルー', '글레이셔 블루'],
  ],
  [
    'coral-dawn',
    'light',
    ['#D97757', '#F0A07A', '#F7C4A5', '#FBD9C9', '#FFF1E8'],
    '#141413',
    '#FBEFE6',
    ['珊瑚日出', '珊瑚日出', 'Coral Dawn', 'コーラルサンライズ', '코랄 선라이즈'],
  ],
  [
    'clay-oat',
    'light',
    ['#C6613F', '#D97757', '#E3B58E', '#E3DACC', '#FAF9F5'],
    '#141413',
    '#F5E3C7',
    ['陶土燕麦', '陶土燕麥', 'Clay Oat', 'テラコッタオート', '테라코타 오트'],
  ],
  [
    'lavender-mist',
    'light',
    ['#8D7CF0', '#B39DF5', '#DFC8F5', '#EAD9FB', '#FFD1D4'],
    '#141413',
    '#F3EEFB',
    ['薰衣草雾', '薰衣草霧', 'Lavender Mist', 'ラベンダーミスト', '라벤더 미스트'],
  ],
  [
    'lime-mint',
    'light',
    ['#10A37F', '#5CCB9B', '#B3F4A8', '#DAF5C4', '#F4F9A7'],
    '#141413',
    '#EEFBEF',
    ['青柠薄荷', '青檸薄荷', 'Lime Mint', 'ライムミント', '라임 민트'],
  ],
  [
    'turquoise',
    'light',
    ['#2CA0AB', '#35BDC8', '#6ACBD4', '#92DCE2', '#C4EEF2'],
    '#141413',
    '#DEF7F9',
    ['松石青', '松石青', 'Turquoise', 'ターコイズ', '터콰이즈'],
  ],
  [
    'amber-dusk',
    'light',
    ['#F26A2E', '#FF8A1F', '#FFAF00', '#FFD000', '#FFEBB0'],
    '#141413',
    '#FFF4D6',
    ['琥珀夕照', '琥珀夕照', 'Amber Dusk', 'アンバーサンセット', '앰버 선셋'],
  ],
  [
    'cloud-white',
    'light',
    ['#F0EEE9', '#E3DACC', '#D8DEE6', '#BFD3E7', '#B0AEA5'],
    '#141413',
    '#F7F3EE',
    ['云舞白', '雲舞白', 'Cloud White', 'クラウドホワイト', '클라우드 화이트'],
  ],
  [
    'holo-iris',
    'light',
    ['#C8B6FF', '#A0DAF7', '#B3F4A8', '#FFD1D4', '#F4F9A7'],
    '#141413',
    '#F8F5FF',
    ['全息虹彩', '全息虹彩', 'Holo Iris', 'ホログラフィック', '홀로그래픽'],
  ],
  [
    'champagne',
    'light',
    ['#B08050', '#D4B46A', '#E8D3B0', '#F1E4CC', '#C9B79C'],
    '#141413',
    '#F4ECDC',
    ['香槟金', '香檳金', 'Champagne Gold', 'シャンパンゴールド', '샴페인 골드'],
  ],
  [
    'spectrum-soft',
    'light',
    ['#9CC8F5', '#A5E3F7', '#C9E79A', '#FFD2A0', '#F7B5CC', '#D9B3EA'],
    '#141413',
    '#FFFFFF',
    ['光谱柔彩', '光譜柔彩', 'Soft Spectrum', 'ソフトスペクトラム', '소프트 스펙트럼'],
  ],
  [
    'graphite-mist',
    'light',
    ['#E6E8EE', '#D2D6DE', '#B4B8C0', '#9AA0AA', '#FFFFFF'],
    '#141413',
    '#F4F4F5',
    ['石墨浅灰', '石墨淺灰', 'Graphite Mist', 'グラファイトミスト', '그래파이트 미스트'],
  ],
  // 浅底 · v2 保留
  [
    'warm',
    'light',
    ['#FF6B6B', '#FF8E53', '#FFA07A', '#FFB347', '#FF69B4'],
    '#141413',
    '#FDEDDB',
    ['温暖活力', '溫暖活力', 'Warm Vitality', 'ウォームバイタル', '웜 바이탈'],
  ],
  [
    'cool',
    'light',
    ['#4ECDC4', '#45B7D1', '#5B86E5', '#36D1DC', '#6C63FF'],
    '#141413',
    '#DAF7F9',
    ['冷静科技', '冷靜科技', 'Cool Tech', 'クールテック', '쿨 테크'],
  ],
  [
    'sunset',
    'light',
    ['#FF5F6D', '#FF9966', '#FFC371', '#FC5C7D', '#B24592'],
    '#141413',
    '#FDEEDB',
    ['落日热情', '落日熱情', 'Sunset Glow', 'サンセットグロー', '선셋 글로우'],
  ],
  [
    'forest',
    'light',
    ['#2E8B57', '#6B8E23', '#3CB371', '#8FBC8F', '#BDB76B'],
    '#141413',
    '#F2F1DF',
    ['自然生态', '自然生態', 'Forest', 'フォレスト', '포레스트'],
  ],
  [
    'ocean',
    'light',
    ['#0077B6', '#00B4D8', '#0096C7', '#90E0EF', '#CAF0F8'],
    '#141413',
    '#E9F2F4',
    ['深邃专业', '深邃專業', 'Deep Ocean', 'ディープオーシャン', '딥 오션'],
  ],
  [
    'peach',
    'light',
    ['#FFB5A7', '#FCD5CE', '#F8EDEB', '#F9DCC4', '#FAE1DD'],
    '#141413',
    '#F2EFEF',
    ['桃粉柔和', '桃粉柔和', 'Soft Peach', 'ソフトピーチ', '소프트 피치'],
  ],
  [
    'mint',
    'light',
    ['#B5EAD7', '#C7F0DB', '#E2F0CB', '#FFDAC1', '#95E1D3'],
    '#141413',
    '#EEF2E9',
    ['薄荷清新', '薄荷清新', 'Fresh Mint', 'フレッシュミント', '프레시 민트'],
  ],
  [
    'aurora',
    'light',
    ['#C3B1E1', '#A2D2FF', '#FFAFCC', '#BDE0FE', '#CDB4DB'],
    '#141413',
    '#E9F1F9',
    ['极光梦幻', '極光夢幻', 'Aurora Dream', 'オーロラドリーム', '오로라 드림'],
  ],
  [
    'blush',
    'light',
    ['#FFCDB2', '#FFB4A2', '#E5989B', '#F4ACB7', '#FFCAD4'],
    '#141413',
    '#FAECEE',
    ['腮红暖粉', '腮紅暖粉', 'Blush Pink', 'ブラッシュピンク', '블러시 핑크'],
  ],
  // 深底 · 新配色
  [
    'electric-blue',
    'dark',
    ['#002F5B', '#1E48C8', '#4D6BFE', '#2F8CFF', '#5FA3FF'],
    '#FFFFFF',
    '#0A0F1E',
    ['电光蓝', '電光藍', 'Electric Blue', 'エレクトリックブルー', '일렉트릭 블루'],
  ],
  [
    'aurora-violet',
    'dark',
    ['#3F7FD0', '#5E6FCB', '#7E64B5', '#A65C90', '#C05868'],
    '#FFFFFF',
    '#1B1638',
    ['极光蓝紫', '極光藍紫', 'Aurora Violet', 'オーロラバイオレット', '오로라 바이올렛'],
  ],
  [
    'deep-space',
    'dark',
    ['#111827', '#1E2A4A', '#2B3A67', '#3B4C8C', '#5865F2'],
    '#FFFFFF',
    '#0B0E14',
    ['深空', '深空', 'Deep Space', 'ディープスペース', '딥 스페이스'],
  ],
  [
    'neon-tide',
    'dark',
    ['#1C2B6B', '#3B7BFF', '#6A3BE2', '#A82BB2', '#0E5F5A'],
    '#FFFFFF',
    '#070A0F',
    ['霓虹暗潮', '霓虹暗潮', 'Neon Tide', 'ネオンタイド', '네온 타이드'],
  ],
  [
    'ink-black',
    'dark',
    ['#141413', '#2B2F36', '#3D3D3A', '#4B5563', '#1E1F22'],
    '#FFFFFF',
    '#080808',
    ['墨黑单色', '墨黑單色', 'Ink Black', 'インクブラック', '잉크 블랙'],
  ],
  // 深底 · v5 补充
  [
    'midnight-navy',
    'dark',
    ['#0D1B2A', '#152B40', '#1F3E5B', '#2E5A80', '#4A82AE'],
    '#FFFFFF',
    '#080F18',
    ['午夜藏青', '午夜藏青', 'Midnight Navy', 'ミッドナイトネイビー', '미드나이트 네이비'],
  ],
  [
    'deep-emerald',
    'dark',
    ['#04170F', '#0A2A1D', '#11432F', '#1B6448', '#2A8C62'],
    '#FFFFFF',
    '#050F0B',
    ['深祖母绿', '深祖母綠', 'Deep Emerald', 'ディープエメラルド', '딥 에메랄드'],
  ],
  [
    'ember-dusk',
    'dark',
    ['#150C05', '#331A0A', '#5C2E10', '#8A4A18', '#B86A24'],
    '#FFFFFF',
    '#120A05',
    ['余烬暮色', '餘燼暮色', 'Ember Dusk', 'エンバーダスク', '엠버 더스크'],
  ],
  [
    'oxblood',
    'dark',
    ['#1C060C', '#3A0C17', '#5E1526', '#87203A', '#A83A52'],
    '#FFFFFF',
    '#130509',
    ['牛血红', '牛血紅', 'Oxblood', 'オックスブラッド', '옥스블러드'],
  ],
  [
    'plum-night',
    'dark',
    ['#12042A', '#25093F', '#3D1160', '#5A1D86', '#7B32AB'],
    '#FFFFFF',
    '#0C0320',
    ['夜紫李', '夜紫李', 'Plum Night', 'プラムナイト', '플럼 나이트'],
  ],
  [
    'abyss-teal',
    'dark',
    ['#031A19', '#062B29', '#0A4340', '#0F615C', '#178C83'],
    '#FFFFFF',
    '#031312',
    ['深海青', '深海青', 'Abyss Teal', 'アビスティール', '어비스 틸'],
  ],
  [
    'rose-midnight',
    'dark',
    ['#170812', '#33112A', '#571E43', '#7D2C5D', '#A34078'],
    '#FFFFFF',
    '#11060E',
    ['玫瑰午夜', '玫瑰午夜', 'Rose Midnight', 'ローズミッドナイト', '로즈 미드나이트'],
  ],
  [
    'cosmic-indigo',
    'dark',
    ['#080A24', '#121540', '#20265F', '#333B8A', '#4C56B8'],
    '#FFFFFF',
    '#06081A',
    ['宇宙靛蓝', '宇宙靛藍', 'Cosmic Indigo', 'コズミックインディゴ', '코스믹 인디고'],
  ],
  [
    'forest-night',
    'dark',
    ['#06150C', '#0F2A18', '#193F26', '#265838', '#35784C'],
    '#FFFFFF',
    '#050F09',
    ['林间夜色', '林間夜色', 'Forest Night', 'フォレストナイト', '포레스트 나이트'],
  ],
  [
    'copper-dusk',
    'dark',
    ['#150F0B', '#2C1F16', '#4A3324', '#6E4C33', '#946946'],
    '#FFFFFF',
    '#100B08',
    ['古铜黄昏', '古銅黃昏', 'Copper Dusk', 'カッパーダスク', '코퍼 더스크'],
  ],
  [
    'steel-slate',
    'dark',
    ['#0E1418', '#182229', '#26353F', '#374C59', '#4E6A7A'],
    '#FFFFFF',
    '#0A0F12',
    ['钢灰石板', '鋼灰石板', 'Steel Slate', 'スチールスレート', '스틸 슬레이트'],
  ],
]

export const PALETTES: Palette[] = ROWS.map(([id, tone, colors, text, bg, names]) => ({
  id,
  tone,
  colors: [...colors],
  text,
  bg,
  name: toName(names),
}))

/**
 * 推荐文字色对最差停靠点低于 WCAG 4.5 的配色。文字正好压在这些配色最亮的那块色斑上时
 * 对比度不够，界面据此提示开胶囊底。
 */
export const PLATE_HINT_IDS: readonly string[] = [
  'cool',
  'sunset',
  'forest',
  'ocean',
  'electric-blue',
  'aurora-violet',
  'neon-tide',
  'midnight-navy',
  'deep-emerald',
  'ember-dusk',
  'abyss-teal',
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
