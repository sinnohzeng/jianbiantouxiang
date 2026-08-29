/**
 * 2D 阶段的颗粒。warp（silk）没有颗粒 uniform，但产品口径是四种质感都有颗粒滑杆，
 * 缺的那份在这里补上。做法是一张种子噪声小图平铺后 overlay 混合，避免逐像素遍历大画布。
 */

import { clamp } from './math'
import { mulberry32 } from './seed'

const TILE_SIZE = 128

/** 噪声围绕中灰摆动，overlay 混合下中灰不改变底色，只有偏差被看见。 */
const MID_GRAY = 128
const AMPLITUDE = 46

/** 颗粒粒径按导出边长放大，同一 seed 在 512 与 4096 下观感才一致。 */
function grainScale(size: number): number {
  return Math.max(1, Math.round(size / 1024))
}

function createNoiseTile(seed: string, amount: number): HTMLCanvasElement | null {
  const tile = document.createElement('canvas')
  tile.width = TILE_SIZE
  tile.height = TILE_SIZE
  const ctx = tile.getContext('2d')
  if (!ctx) return null

  const image = ctx.createImageData(TILE_SIZE, TILE_SIZE)
  const rng = mulberry32(`${seed}|film-grain`)
  const amplitude = AMPLITUDE * amount
  for (let i = 0; i < image.data.length; i += 4) {
    const value = MID_GRAY + (rng() * 2 - 1) * amplitude
    const level = clamp(Math.round(value), 0, 255)
    image.data[i] = level
    image.data[i + 1] = level
    image.data[i + 2] = level
    image.data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return tile
}

export function applyFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
  seed: string,
): void {
  const strength = clamp(amount, 0, 1)
  if (strength <= 0 || width <= 0 || height <= 0) return
  if (typeof document === 'undefined') return

  const tile = createNoiseTile(seed, strength)
  if (!tile) return

  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return

  const scale = grainScale(Math.max(width, height))
  if (scale > 1 && typeof DOMMatrix !== 'undefined') {
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]))
  }

  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = clamp(0.08 + strength * 0.24, 0, 1)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  tile.width = 0
  tile.height = 0
}
