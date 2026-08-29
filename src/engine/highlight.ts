/**
 * 光感层：模拟光透过玻璃的低频溢出，不是镜面高光。
 * 半径取到画布量级、边缘完全透明，才不会在头像上留下可见的光圈边。
 */

import { clamp } from './math'
import { mulberry32, rangeFrom } from './seed'

/** 主光用 screen 提亮，副光用 soft-light 补层次，两者叠加不至于过曝。 */
const PRIMARY_ALPHA = 0.55
const SECONDARY_ALPHA = 0.32

export function drawHighlight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
  seed: string,
): void {
  const amount = clamp(strength, 0, 1)
  if (amount <= 0 || width <= 0 || height <= 0) return

  const rng = mulberry32(`${seed}|highlight`)
  const maxDim = Math.max(width, height)
  const count = rng() < 0.45 ? 1 : 2

  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const primary = i === 0
    // 主光压在上半部，副光落到下半部，读起来像自然采光
    const cx = width * rangeFrom(rng, 0.12, 0.88)
    const cy = height * (primary ? rangeFrom(rng, 0.02, 0.5) : rangeFrom(rng, 0.45, 0.95))
    const radius = maxDim * rangeFrom(rng, 0.55, 1.05)
    const alpha = amount * (primary ? PRIMARY_ALPHA : SECONDARY_ALPHA)

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(4)})`)
    gradient.addColorStop(0.35, `rgba(255, 255, 255, ${(alpha * 0.55).toFixed(4)})`)
    gradient.addColorStop(0.7, `rgba(255, 255, 255, ${(alpha * 0.16).toFixed(4)})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.globalCompositeOperation = primary ? 'screen' : 'soft-light'
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
  ctx.restore()
}
