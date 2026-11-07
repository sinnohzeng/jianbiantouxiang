import symbol from '@/graphics/client-assets/dongli-symbol-white.svg?raw'
import full from '@/graphics/client-assets/dongli-lockup-full-white.svg?raw'
import inline from '@/graphics/client-assets/dongli-wordmark-bilingual-inline-white.svg?raw'
import harmay from '@/graphics/client-assets/harmay-wordmark-white.png?inline'
import { CLIENT_PRESET_IDS } from '@/graphics/client-presets'
type ClientPresetId = (typeof CLIENT_PRESET_IDS)[number]
const sources: Record<Exclude<ClientPresetId, 'harmay-wordmark-white'>, string> = {
  'dongli-symbol-white': symbol,
  'dongli-lockup-full-white': full,
  'dongli-wordmark-bilingual-inline-white': inline,
}
export function presetLogo(id: ClientPresetId) {
  if (id === 'harmay-wordmark-white')
    return {
      mimeType: 'image/png' as const,
      data: harmay.split(',')[1] ?? '',
      color: 'original' as const,
      background: 'transparent' as const,
      preservePadding: false,
    }
  return {
    mimeType: 'image/svg+xml' as const,
    data: btoa(String.fromCharCode(...new TextEncoder().encode(sources[id]))),
    color: 'original' as const,
    background: 'transparent' as const,
    preservePadding: true,
  }
}
