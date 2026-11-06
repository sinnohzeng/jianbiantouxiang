import { DEFAULT_CONFIG, type AvatarConfig, type PartialConfig } from '@/state/config'
import { clientPresetConfig, isClientPreset } from '@/graphics/client-presets'
/** 挑选栏四张卡片共用的小工具：两行文字的读写。 */

/** 单行输入不允许带出换行：粘贴进来的多行在这里并成一行。 */
export function stripBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '')
}

/** 第二行为空时不留尾随换行，存储形态与两行模型一一对应。 */
export function joinLines(first: string, second: string): string {
  return second === '' ? first : `${first}\n${second}`
}

/** Restore composition only; content, fonts, artwork and colors belong to the user. */
export function automaticLayoutPatch(config: AvatarConfig): PartialConfig {
  const icon = config.layout.icon
  const graphic =
    icon.source === 'brand' && isClientPreset(icon.id)
      ? (clientPresetConfig(icon.id).layout?.graphic ?? DEFAULT_CONFIG.layout.graphic)
      : DEFAULT_CONFIG.layout.graphic
  return {
    typography: {
      line1: { size: null, offsetX: 0, offsetY: 0 },
      line2: { size: null, offsetX: 0, offsetY: 0 },
    },
    layout: { graphic, graphicOffsetX: 0, graphicOffsetY: 0 },
  }
}
