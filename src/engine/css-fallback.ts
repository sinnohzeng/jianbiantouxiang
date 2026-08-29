/**
 * 无 WebGL2 时的静态近似：多层 radial-gradient 叠出色斑，最底下压一层实色保证不透。
 * 只用于预览，导出路径另有说明。
 */

import type { AvatarConfig } from '@/state/config'
import { resolveColors } from './colors'
import { clamp, lerp, round } from './math'
import { rangeFrom, seededRng } from './seed'

export interface FallbackLayer {
  /** 圆心位置，画布宽高的百分比。 */
  x: number
  y: number
  /** 椭圆半径，画布宽高的百分比。 */
  radiusX: number
  radiusY: number
  color: string
  alpha: number
}

const MIN_LAYERS = 4
const MAX_LAYERS = 6

function parseHex(hex: string): [number, number, number] | null {
  const body = hex.trim().replace(/^#/, '')
  if (body.length === 3) {
    const r = body[0]
    const g = body[1]
    const b = body[2]
    if (!r || !g || !b) return null
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)]
  }
  if (body.length === 6) {
    return [
      parseInt(body.slice(0, 2), 16),
      parseInt(body.slice(2, 4), 16),
      parseInt(body.slice(4, 6), 16),
    ]
  }
  return null
}

/** 把 hex 转成带透明度的 rgba()，非法值退到中性灰而不是抛错。 */
export function rgba(hex: string, alpha: number): string {
  const parsed = parseHex(hex) ?? [148, 163, 184]
  const a = round(clamp(alpha, 0, 1), 3)
  return `rgba(${parsed[0]}, ${parsed[1]}, ${parsed[2]}, ${a})`
}

/**
 * 由种子派生的色斑布局。2D 兜底渲染与 CSS 兜底共用这份数据，
 * 两条路径因此得到同一个构图。
 */
export function fallbackLayers(config: AvatarConfig, colors: readonly string[]): FallbackLayer[] {
  const source = colors.length > 0 ? colors : ['#dbeafe', '#c7d2fe']
  const rng = seededRng(config, 'css-fallback')
  const spread = lerp(0.75, 1.25, config.styleParams.intensity)
  const count = MIN_LAYERS + Math.floor(rng() * (MAX_LAYERS - MIN_LAYERS + 1))

  const layers: FallbackLayer[] = []
  for (let i = 0; i < count; i += 1) {
    const color = source[i % source.length] ?? source[0] ?? '#c7d2fe'
    layers.push({
      x: round(rangeFrom(rng, 5, 95), 2),
      y: round(rangeFrom(rng, 5, 95), 2),
      radiusX: round(clamp(rangeFrom(rng, 45, 85) * spread, 20, 140), 2),
      radiusY: round(clamp(rangeFrom(rng, 45, 85) * spread, 20, 140), 2),
      color,
      alpha: round(rangeFrom(rng, 0.55, 0.95), 3),
    })
  }
  return layers
}

/**
 * 生成可直接赋给 background 的字符串。色斑在前、实色在后，
 * CSS 背景层是后写的在下方，所以实色兜底必须放最后。
 */
export function cssFallbackBackground(
  config: AvatarConfig,
  colors: readonly string[] = resolveColors(config),
): string {
  const layers = fallbackLayers(config, colors)
  const base = colors[0] ?? '#c7d2fe'
  const parts = layers.map(
    (layer) =>
      `radial-gradient(ellipse ${layer.radiusX}% ${layer.radiusY}% at ${layer.x}% ${layer.y}%, ` +
      `${rgba(layer.color, layer.alpha)} 0%, ${rgba(layer.color, 0)} 100%)`,
  )
  parts.push(`linear-gradient(${rgba(base, 1)}, ${rgba(base, 1)})`)
  return parts.join(', ')
}
