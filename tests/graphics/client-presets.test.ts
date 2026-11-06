import { it, expect } from 'vitest'
import { CLIENT_PRESET_IDS, clientPresetConfig, isClientPreset } from '@/graphics/client-presets'
import { renderSchema } from '@/automation/schema'
import { normalizeConfig } from '@/state/config'

it('customer presets keep original white marks on a dark background', () => {
  for (const id of CLIENT_PRESET_IDS) {
    const config = normalizeConfig(clientPresetConfig(id))
    expect(config.layout.icon.mono).toBe(false)
    expect(config.typography.effect).toBe('plain')
    expect(config.palette).toBe('steel-slate')
    expect(renderSchema.parse({ preset: id }).preset).toBe(id)
  }
  expect(isClientPreset('../../file')).toBe(false)
  expect(renderSchema.safeParse({ preset: 'https://localhost' }).success).toBe(false)
})
