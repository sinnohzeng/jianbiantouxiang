import symbol from '@/graphics/client-assets/dongli-symbol-white.svg?raw'
import full from '@/graphics/client-assets/dongli-lockup-full-white.svg?raw'
import inline from '@/graphics/client-assets/dongli-wordmark-bilingual-inline-white.svg?raw'
import type { ClientPresetId } from '@/graphics/client-presets'
const sources: Record<ClientPresetId, string> = {
  'dongli-symbol-white': symbol,
  'dongli-lockup-full-white': full,
  'dongli-wordmark-bilingual-inline-white': inline,
}
export function presetLogo(id: ClientPresetId) {
  return {
    mimeType: 'image/svg+xml' as const,
    data: btoa(String.fromCharCode(...new TextEncoder().encode(sources[id]))),
    color: 'original' as const,
    background: 'transparent' as const,
    preservePadding: true,
  }
}
