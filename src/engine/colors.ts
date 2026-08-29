/** 引擎取色的唯一入口，把配色表的细节挡在渲染之外。 */

import { paletteColors } from '@/palettes/palettes'
import type { AvatarConfig } from '@/state/config'

/** 配色表给不出可用颜色时的兜底，中性冷色，任何 shader 下都不会翻车。 */
const NEUTRAL_RAMP = ['#dbeafe', '#c7d2fe', '#e9d5ff'] as const

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function usable(colors: readonly string[]): string[] {
  return colors.filter((color) => typeof color === 'string' && HEX_RE.test(color.trim()))
}

/** shader 至少要两个色才有渐变，不够就依次退到自定义色与中性色。 */
export function resolveColors(config: AvatarConfig): string[] {
  const fromPalette = usable(paletteColors(config))
  if (fromPalette.length >= 2) return fromPalette

  const fromCustom = usable(config.customColors)
  if (fromCustom.length >= 2) return fromCustom

  return [...NEUTRAL_RAMP]
}
