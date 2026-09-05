/**
 * 文字与图形的墨色工具：WCAG 相对亮度、对比度与明暗判定。
 *
 * v5 起没有「自动文字色」：文字色就是用户在文字节里挑的那一个，
 * 预览与导出读同一个字段，不再有第二条按像素判定的路径。
 * 这里剩下的都是纯函数，描边与投影的反色、图形的兜底色都读它。
 */

/** 描边与投影的两个反色候选，深色不用纯黑，避免在渐变上显得发闷。 */
export const INK_LIGHT = '#FFFFFF'
export const INK_DARK = '#141413'

/** WCAG 2 的正文对比度门槛。 */
export const WCAG_AA = 4.5

function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace('#', '')
  const full =
    raw.length === 3
      ? `${raw[0] ?? '0'}${raw[0] ?? '0'}${raw[1] ?? '0'}${raw[1] ?? '0'}${raw[2] ?? '0'}${raw[2] ?? '0'}`
      : raw.padEnd(6, '0').slice(0, 6)
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return [0, 0, 0]
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 2 相对亮度。 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2 对比度，1 到 21。 */
export function contrastRatio(a: string, b: string): number {
  const x = relativeLuminance(a)
  const y = relativeLuminance(b)
  const light = Math.max(x, y)
  const dark = Math.min(x, y)
  return (light + 0.05) / (dark + 0.05)
}

/** 明暗判定用 0.179 这个门槛，它是白字与黑字对比度相等的分界点。 */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.179
}
