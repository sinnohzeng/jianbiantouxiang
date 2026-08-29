import type { AvatarConfig } from '@/state/config'
import { canvasToBlob, createCanvas, get2d, releaseCanvas, type EncodableCanvas } from './canvas'

export type EncodeOptions = AvatarConfig['exportOptions']

export interface EncodeResult {
  blob: Blob
  /** 实际使用的质量，PNG 恒为 1。 */
  quality: number
  /** 是否落在体积目标内，false 时界面提示降分辨率。PNG 无损、体积档不适用，恒为 true。 */
  hitTarget: boolean
}

const MIME: Record<EncodeOptions['format'], string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** 起编质量：JPG 0.85 与 WebP 0.9 在 1024 尺寸下肉眼无损。 */
const DEFAULT_QUALITY: Record<'jpg' | 'webp', number> = { jpg: 0.85, webp: 0.9 }

/**
 * 「不限制」档的起编质量。spec §3.5 只给 JPG 定了这一档的质量 92，
 * WebP 那条写的是质量 0.9，不跟着抬。
 */
const UNLIMITED_QUALITY: Record<'jpg' | 'webp', number> = { jpg: 0.92, webp: 0.9 }

/** 再低画质就开始出块状伪影，宁可报告没达标也不继续压。 */
const QUALITY_MIN = 0.6
const QUALITY_MAX = 0.95
const MAX_ROUNDS = 6
/** 压到目标的 92 % 以上就收手，剩下的几十 KB 不值得再编一轮。 */
const GOOD_ENOUGH = 0.92

const TARGET_BYTES: Record<EncodeOptions['sizeTarget'], number> = {
  none: Number.POSITIVE_INFINITY,
  '1mb': 1024 * 1024,
  '2mb': 2048 * 1024,
}

let webpProbe: Promise<boolean> | null = null

/**
 * 探测浏览器能否编码 WebP：不支持的浏览器（Safari 一类）会退回 PNG，
 * 靠返回的 MIME 判断，不看 canPlayType 之类不可靠的声明。结果缓存整个会话。
 */
export function supportsWebP(): Promise<boolean> {
  webpProbe ??= probeWebP()
  return webpProbe
}

async function probeWebP(): Promise<boolean> {
  const canvas = createCanvas(1, 1)
  try {
    const blob = await canvasToBlob(canvas, MIME.webp, DEFAULT_QUALITY.webp)
    return blob.type === MIME.webp
  } catch {
    return false
  } finally {
    releaseCanvas(canvas)
  }
}

/** 质量保留三位小数，避免二分产生一长串浮点尾巴，日志与快照也好读。 */
function roundQuality(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * 把画布编码成目标格式，并在需要时用二分搜索质量逼近体积目标。
 * PNG 无损，没有可调的质量，直接一次编码。
 */
export async function encodeCanvas(
  canvas: EncodableCanvas,
  opts: EncodeOptions,
): Promise<EncodeResult> {
  if (opts.format === 'png') {
    // PNG 无损，没有质量可压，体积档对它不适用（spec §3.5 给 PNG 的提示是分辨率那条）。
    // 这里恒报达标，否则界面会弹出一条“压到质量下限仍超出目标体积”的假警告：
    // 那个二分过程在 PNG 上从未发生，体积档控件也已经禁用，用户无从消除它。
    const blob = await canvasToBlob(canvas, MIME.png)
    return { blob, quality: 1, hitTarget: true }
  }

  const target = TARGET_BYTES[opts.sizeTarget]
  const quality =
    opts.sizeTarget === 'none' ? UNLIMITED_QUALITY[opts.format] : DEFAULT_QUALITY[opts.format]
  // JPG 没有 alpha 通道，圆角与圆形的透明外区不铺底色会被编码成黑边
  const source = opts.format === 'jpg' ? flatten(canvas, opts.bgColor) : canvas
  try {
    return await encodeLossy(source, MIME[opts.format], quality, target)
  } finally {
    if (source !== canvas) releaseCanvas(source)
  }
}

async function encodeLossy(
  canvas: EncodableCanvas,
  mime: string,
  defaultQuality: number,
  target: number,
): Promise<EncodeResult> {
  const first = await canvasToBlob(canvas, mime, defaultQuality)
  if (first.size <= target) return { blob: first, quality: defaultQuality, hitTarget: true }

  let lo = QUALITY_MIN
  // 默认质量已经超标，上界收到它可以省一轮；仍然不越过 QUALITY_MAX
  let hi = Math.min(QUALITY_MAX, defaultQuality)
  let best: { blob: Blob; quality: number } | null = null

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const quality = roundQuality((lo + hi) / 2)
    const blob = await canvasToBlob(canvas, mime, quality)
    if (blob.size > target) {
      hi = quality
      continue
    }
    best = { blob, quality }
    if (blob.size >= target * GOOD_ENOUGH) break
    lo = quality
  }

  if (best) return { ...best, hitTarget: true }

  // 二分只会无限趋近下限而不会取到下限，这里补一次最低质量，给界面一个确定的结论
  const floor = await canvasToBlob(canvas, mime, QUALITY_MIN)
  return { blob: floor, quality: QUALITY_MIN, hitTarget: floor.size <= target }
}

function flatten(canvas: EncodableCanvas, bgColor: string): HTMLCanvasElement {
  const out = createCanvas(canvas.width, canvas.height)
  const ctx = get2d(out)
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas as CanvasImageSource, 0, 0)
  return out
}
