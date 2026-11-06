import { createCanvas, releaseCanvas } from '@/lib/canvas'
import type { Rect } from '@/text/layout'

/** 只识别透明留白；黑色、白色及低透明度笔画全部保留。 */
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number): Rect | null {
  let left = width,
    top = height,
    right = -1,
    bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 0) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
  return right < left
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** 有界扫描透明边界，原图仍用于最终绘制，SVG 不因量测而变成低分辨率位图。 */
export function visibleImageRect(
  image: CanvasImageSource,
  width: number,
  height: number,
): Rect | null {
  const scale = Math.min(1, 2048 / Math.max(width, height))
  const w = Math.max(1, Math.ceil(width * scale)),
    h = Math.max(1, Math.ceil(height * scale))
  const canvas = createCanvas(w, h)
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image measurement unavailable')
    ctx.drawImage(image, 0, 0, w, h)
    const rect = alphaBounds(ctx.getImageData(0, 0, w, h).data, w, h)
    if (!rect) return null
    // 缩略扫描时向外保留一个采样像素，避免抗锯齿边缘被截断。
    const margin = scale < 1 ? 1 : 0
    const x = Math.max(0, rect.x - margin) * (width / w)
    const y = Math.max(0, rect.y - margin) * (height / h)
    return {
      x,
      y,
      width: Math.min(width, (rect.x + rect.width + margin) * (width / w)) - x,
      height: Math.min(height, (rect.y + rect.height + margin) * (height / h)) - y,
    }
  } finally {
    releaseCanvas(canvas)
  }
}
