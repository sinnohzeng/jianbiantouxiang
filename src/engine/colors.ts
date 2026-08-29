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

/**
 * hex 转 shader 的 vec4 颜色（0 到 1 的 RGBA）。
 *
 * 这段口径与 @paper-design/shaders 的 getShaderColorFromString 的 hex 分支一致，
 * 自己写一份是为了让整包 shader 代码留在动态 chunk 里：只要首屏静态引用它一个符号，
 * 包的入口模块就会被并进主 chunk，四段 GLSL 与 ShaderMount 也就跟着回来了。
 * 传进来的颜色全部先过 usable / normalizeHex，非法值按中性灰兜底。
 */
export function toShaderColor(hex: string): [number, number, number, number] {
  const raw = typeof hex === 'string' ? hex.trim().replace(/^#/, '') : ''
  const full =
    raw.length === 3 || raw.length === 4
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw
  const rgba = full.length === 6 ? `${full}ff` : full
  if (!/^[0-9a-f]{8}$/i.test(rgba)) return [0.5, 0.5, 0.5, 1]
  return [
    parseInt(rgba.slice(0, 2), 16) / 255,
    parseInt(rgba.slice(2, 4), 16) / 255,
    parseInt(rgba.slice(4, 6), 16) / 255,
    parseInt(rgba.slice(6, 8), 16) / 255,
  ]
}
