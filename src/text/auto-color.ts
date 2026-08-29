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

/** 采样画布的边长。64×64 与原来的采样点数同量级，一次回读只有 16 KB。 */
const SAMPLE_SIZE = 64

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
 * 新建一张采样用的小画布。合成路径的上下文来自 `src/export/canvas.ts`，没开
 * willReadFrequently，是 GPU 后备存储，在它上面反复回读每次都要同步等一次；
 * 缩到小画布上读，回读发生在这张显式声明会频繁回读的画布上，与预览探针口径一致。
 */
function createSampleContext(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  // 大比例缩图要的是区域平均，低质量插值会在 4096 缩到 64 时漏掉大片像素
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

/**
 * 取文字包围盒下方像素的平均相对亮度。
 * 先把包围盒缩到 64×64 再一次读完，不在全分辨率画布上回读：
 * 整块直接读，4096 导出时 ImageData 会瞬时吃掉几十 MB；
 * 逐行读又要在没开 willReadFrequently 的上下文上往返几十次，一次合成几百 KB。
 * 采到的是缩图后的区域平均值，与原来 64×64 点采样的口径基本等价。
 */
function sampleLuminance(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
): number {
  const source = ctx.canvas
  const region = clampRegion(layout.box, source.width, source.height)
  if (!region) return 0.5

  const width = Math.min(region.width, SAMPLE_SIZE)
  const height = Math.min(region.height, SAMPLE_SIZE)
  const sample = createSampleContext(width, height)
  // 宿主没有 DOM 或拿不到 2D 上下文时无从采样，退回中性灰
  if (!sample) return 0.5

  let data: Uint8ClampedArray
  try {
    sample.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, width, height)
    data = sample.getImageData(0, 0, width, height).data
  } catch {
    // 画布被跨源图片污染时读不出像素，退回中性灰。
    return 0.5
  }

  const [bgR, bgG, bgB] = parseHex(config.exportOptions.bgColor)
  let sum = 0
  let count = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = (data[i + 3] ?? 255) / 255
    const r = (data[i] ?? 0) * alpha + bgR * (1 - alpha)
    const g = (data[i + 1] ?? 0) * alpha + bgG * (1 - alpha)
    const b = (data[i + 2] ?? 0) * alpha + bgB * (1 - alpha)
    sum += luminanceOf(r, g, b)
    count += 1
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

/** 自动文字色的结论：用哪个颜色，以及要不要补胶囊底板。 */
export interface InkDecision {
  color: string
  /** 选定的文字色在实际画面上到不了 3:1，界面据此自动开胶囊底板。 */
  plate: boolean
}

/**
 * 一次采样定下文字色与底板。
 *
 * 颜色与底板是同一次判定的两个结果，分成两个入口的话每个都要自己回读一遍像素，
 * 合成与预览探针都会白采一次；更要紧的是两次采样之间任何差异都会让二者对不上。
 * colorMode 为 custom 时直接用用户选的颜色，底板也不代劳。
 */
export function resolveInk(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
): InkDecision {
  if (config.typography.colorMode === 'custom') {
    return { color: config.typography.color, plate: false }
  }
  const { color, contrast } = decide(ctx, layout, config)
  return { color, plate: contrast < PLATE_MIN_CONTRAST }
}
