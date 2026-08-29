/**
 * 光感层：模拟光透过玻璃的低频溢出，不是镜面高光。
 * 半径取到画布量级、边缘完全透明，才不会在头像上留下可见的光圈边。
 */

import { clamp } from './math'
import { mulberry32, rangeFrom } from './seed'

/**
 * 两盏灯都用 screen。预览层是 CSS 的 mix-blend-mode: screen，导出是画布的
 * globalCompositeOperation，只有混合模式一致，两边看到的才是同一张图；
 * 副光曾经走 soft-light，它在 CSS 与画布上对底色的响应不同，预览与导出会差出一层。
 * 副光的量本来就比主光小，改成 screen 之后也不至于过曝。
 */
const PRIMARY_ALPHA = 0.55
const SECONDARY_ALPHA = 0.32

/** 预览层的 CSS mix-blend-mode 与这里必须同名，改一处就要改另一处。 */
const BLEND_MODE = 'screen'

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

    ctx.globalCompositeOperation = BLEND_MODE
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
  ctx.restore()
}
