import { getPalette } from '@/palettes/palettes'
import type { AvatarConfig } from '@/state/config'
import type { Rect, TextLayout } from './layout'

/** 自动文字色的两个候选，深色不用纯黑，避免在渐变上显得发闷。 */
export const INK_LIGHT = '#FFFFFF'
export const INK_DARK = '#141413'

/** WCAG 2 的正文对比度门槛。 */
export const WCAG_AA = 4.5

/**
 * 建议开底板的对比度门槛。用 3.0 而不是 4.5：文字在头像上是大号字，
 * WCAG 对大字的门槛本来就是 3.0；按 4.5 卡会让半数配色默认糊上一层底板。
 */
export const PLATE_MIN_CONTRAST = 3

/**
 * custom 配色的明暗分界，比的是文字区域的相对亮度。
 * 不再拿白字与深字的对比度互比：那个比法的分界点在 0.179，
 * 高光一压亮区域就翻面，同一张图里几块文字会取到不同颜色。
 */
const CUSTOM_SPLIT = 0.5

/** 采样点上限，取 64×64，够稳定又不会在 4096 导出时拖慢一拍。 */
const MAX_SAMPLES = 4096
const MAX_SAMPLE_ROWS = 64

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

function luminanceOf(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2 相对亮度。 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return luminanceOf(r, g, b)
}

function ratioOf(a: number, b: number): number {
  const light = Math.max(a, b)
  const dark = Math.min(a, b)
  return (light + 0.05) / (dark + 0.05)
}

/** WCAG 2 对比度，1 到 21。 */
export function contrastRatio(a: string, b: string): number {
  return ratioOf(relativeLuminance(a), relativeLuminance(b))
}

/** 明暗判定用 0.179 这个门槛，它是白字与黑字对比度相等的分界点。 */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.179
}

function clampRegion(rect: Rect, canvasWidth: number, canvasHeight: number): Rect | null {
  const left = Math.max(0, Math.floor(rect.x))
  const top = Math.max(0, Math.floor(rect.y))
  const right = Math.min(canvasWidth, Math.ceil(rect.x + rect.width))
  const bottom = Math.min(canvasHeight, Math.ceil(rect.y + rect.height))
  const width = right - left
  const height = bottom - top
  if (width < 1 || height < 1) return null
  return { x: left, y: top, width, height }
}

/**
 * 取文字包围盒下方像素的平均相对亮度。
 * 逐行读取而不是整块读：4096 导出时整块 ImageData 会瞬时吃掉几十 MB。
 */
function sampleLuminance(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
): number {
  const canvas = ctx.canvas
  const region = clampRegion(layout.box, canvas.width, canvas.height)
  if (!region) return 0.5

  const [bgR, bgG, bgB] = parseHex(config.exportOptions.bgColor)
  const rows = Math.max(1, Math.min(region.height, MAX_SAMPLE_ROWS))
  const cols = Math.max(1, Math.min(region.width, Math.floor(MAX_SAMPLES / rows)))

  let sum = 0
  let count = 0
  for (let row = 0; row < rows; row += 1) {
    const offset = Math.min(region.height - 1, Math.floor(((row + 0.5) * region.height) / rows))
    let data: Uint8ClampedArray
    try {
      data = ctx.getImageData(region.x, region.y + offset, region.width, 1).data
    } catch {
      // 画布被跨源图片污染时读不出像素，退回中性灰。
      return 0.5
    }
    for (let col = 0; col < cols; col += 1) {
      const index = Math.min(region.width - 1, Math.floor(((col + 0.5) * region.width) / cols)) * 4
      const alpha = (data[index + 3] ?? 255) / 255
      const r = (data[index] ?? 0) * alpha + bgR * (1 - alpha)
      const g = (data[index + 1] ?? 0) * alpha + bgG * (1 - alpha)
      const b = (data[index + 2] ?? 0) * alpha + bgB * (1 - alpha)
      sum += luminanceOf(r, g, b)
      count += 1
    }
  }

  return count > 0 ? sum / count : 0.5
}

/**
 * 自动文字色的决定：内置配色直接用配色表里的设计值，同一配色下每块文字都是同一个颜色，
 * 高光、颗粒、种子都改不动它；只有 custom 配色才落到像素判定。
 * 对比度一律拿实际画面的亮度算，用来决定要不要补底板。
 */
function decide(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
): { color: string; contrast: number } {
  const luminance = sampleLuminance(ctx, layout, config)
  const palette = getPalette(config.palette)
  const color = palette ? palette.text : luminance < CUSTOM_SPLIT ? INK_LIGHT : INK_DARK
  return { color, contrast: ratioOf(relativeLuminance(color), luminance) }
}

/**
 * 自动文字色。colorMode 为 custom 时直接返回用户选的颜色。
 */
export function pickTextColor(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
): string {
  if (config.typography.colorMode === 'custom') return config.typography.color
  return decide(ctx, layout, config).color
}

/** 选定的文字色在实际画面上到不了 3:1 时建议开胶囊底板，由界面决定是否自动打开。 */
export function needsPlate(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
): boolean {
  if (config.typography.colorMode === 'custom') return false
  return decide(ctx, layout, config).contrast < PLATE_MIN_CONTRAST
}
