import {
  clampChroma,
  fixupHueShorter,
  formatHex,
  oklch,
  rgb,
  wcagContrast,
  wcagLuminance,
} from 'culori'

/** 深色文字用暖近黑，浅色文字用纯白，与配色表里的 text 字段同源。 */
export const TEXT_DARK = '#141413'
export const TEXT_LIGHT = '#FFFFFF'

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** WCAG 2 相对亮度，0 到 1。解析不了的颜色按黑色算，调用方无需 try。 */
export function relativeLuminance(hex: string): number {
  const color = rgb(hex)
  return color ? wcagLuminance(color) : 0
}

/** WCAG 2 对比度，1 到 21。任一颜色解析不了时返回 1，表示“完全没有对比”。 */
export function contrastRatio(a: string, b: string): number {
  const ca = rgb(a)
  const cb = rgb(b)
  if (!ca || !cb) return 1
  return wcagContrast(ca, cb)
}

/**
 * 是否算浅色底。判据是深字比白字更清楚，正好对应自动文字色的选边，
 * 比固定明度阈值少一个魔数。
 */
export function isLight(hex: string): boolean {
  return contrastRatio(hex, TEXT_DARK) >= contrastRatio(hex, TEXT_LIGHT)
}

/** 一组颜色的 OKLCH 平均明度，0 到 1，用于判定配色的明暗归属。 */
export function averageLightness(colors: readonly string[]): number {
  let sum = 0
  let count = 0
  for (const color of colors) {
    const c = oklch(color)
    if (!c) continue
    sum += c.l
    count += 1
  }
  return count === 0 ? 0 : sum / count
}

/**
 * 在 OKLCH 里按短弧混色并压回 sRGB。sRGB 直接插值会在中段发灰，
 * 渐变中间色、底板色、hover 态都走这里。
 */
export function mixOklch(a: string, b: string, t: number): string {
  const ca = oklch(a)
  const cb = oklch(b)
  if (!ca) return cb ? formatHex(cb) : '#000000'
  if (!cb) return formatHex(ca)
  const k = clamp01(t)
  const hues = fixupHueShorter([ca.h ?? cb.h ?? 0, cb.h ?? ca.h ?? 0])
  const h0 = hues[0] ?? 0
  const h1 = hues[1] ?? h0
  return formatHex(
    clampChroma(
      {
        mode: 'oklch',
        l: ca.l + (cb.l - ca.l) * k,
        c: ca.c + (cb.c - ca.c) * k,
        h: h0 + (h1 - h0) * k,
      },
      'oklch',
    ),
  )
}

/**
 * 配色缩略图用的 CSS 渐变。选择器里的每个色块要显示真实渐变而不是圆点，
 * 135deg 与预览画布的默认走向一致。
 */
export function paletteThumbCss(colors: readonly string[]): string {
  if (colors.length === 0) return 'none'
  if (colors.length === 1) return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 100%)`
  const last = colors.length - 1
  const stops = colors.map((color, i) => `${color} ${Math.round((i / last) * 1000) / 10}%`)
  return `linear-gradient(135deg, ${stops.join(', ')})`
}
