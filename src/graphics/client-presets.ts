import type { PartialConfig } from '@/state/config'

export const CLIENT_ASSET_IDS = [
  'dongli-symbol-white',
  'dongli-lockup-full-white',
  'dongli-wordmark-bilingual-inline-white',
  'dongli-symbol-primary',
  'dongli-symbol-black',
  'dongli-lockup-full-primary',
  'dongli-lockup-full-black',
  'dongli-wordmark-bilingual-inline-primary',
  'dongli-wordmark-bilingual-inline-black',
  'harmay-wordmark-black',
  'harmay-wordmark-white',
] as const
export const CLIENT_PRESET_IDS = [
  'dongli-symbol-white',
  'dongli-lockup-full-white',
  'dongli-wordmark-bilingual-inline-white',
  'harmay-wordmark-white',
] as const
export type ClientPresetId = (typeof CLIENT_ASSET_IDS)[number]
export function isClientPreset(id: string): id is ClientPresetId {
  return (CLIENT_ASSET_IDS as readonly string[]).includes(id)
}

/**
 * 精确原稿：字节分组、ISV 分组与客户素材，按原色原形使用，不做程序染色，选择器也不给单色档。
 * 按 id 判断而不查品牌索引，编辑面板不必为此把整份索引拉进首屏；与索引分类一致由单测守着。
 */
export function isExactBrand(id: string): boolean {
  return (
    isClientPreset(id) ||
    id.startsWith('bd-') ||
    id.startsWith('isv-') ||
    id === 'doubao-work' ||
    id === 'lark' ||
    id === 'tiktok'
  )
}

/** 东黎素材自带品牌规范要求的留白，量尺寸时连留白一起算；其余品牌素材按可见像素裁边。 */
export function keepsClearspace(id: string): boolean {
  return id.startsWith('dongli-')
}
/** White original artwork on a dark background; the SVG's own 9% clearspace stays intact. */
export function clientPresetConfig(id: ClientPresetId): PartialConfig {
  return {
    palette: 'steel-slate',
    highlight: 0.08,
    typography: {
      color: '#ffffff',
      effect: 'plain',
      padding: 0.03,
      optical: true,
      line1: { size: null, offsetX: 0, offsetY: 0 },
      line2: { size: null, offsetX: 0, offsetY: 0 },
    },
    layout: {
      icon: { source: 'brand', id, mono: false },
      // 图形标宽高比约 2.24，0.63 时宽度是安全框的 94%；完整组合约 1.34，0.6 时高度是安全框的 52%
      graphic: id.startsWith('dongli-symbol-')
        ? 0.63
        : id.startsWith('dongli-lockup-')
          ? 0.6
          : 0.52,
      graphicOffsetX: 0,
      graphicOffsetY: 0,
    },
  }
}
