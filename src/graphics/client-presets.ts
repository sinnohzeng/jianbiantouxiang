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
      graphic: id.startsWith('dongli-symbol-') ? 0.42 : 0.52,
      graphicOffsetX: 0,
      graphicOffsetY: 0,
    },
  }
}
