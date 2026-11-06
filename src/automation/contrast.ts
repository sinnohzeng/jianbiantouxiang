import type { Rect } from '@/text/layout'

function channel(value: number) {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
export function luminance(r: number, g: number, b: number) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
export function contrastRatio(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** A sampled minimum is diagnostic, not a claim of WCAG compliance for an image. */
export function selectInk(ctx: CanvasRenderingContext2D, boxes: Rect[]) {
  const samples: number[] = []
  for (const box of boxes) {
    if (!box.width || !box.height) continue
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        const px = Math.max(
          0,
          Math.min(ctx.canvas.width - 1, Math.floor(box.x + (box.width * (x + 0.5)) / 5)),
        )
        const py = Math.max(
          0,
          Math.min(ctx.canvas.height - 1, Math.floor(box.y + (box.height * (y + 0.5)) / 5)),
        )
        const data = ctx.getImageData(px, py, 1, 1).data
        samples.push(luminance(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0))
      }
  }
  const black = Math.min(...samples.map((l) => contrastRatio(l, luminance(20, 20, 19))))
  const white = Math.min(...samples.map((l) => contrastRatio(l, 1)))
  return {
    color: black >= white ? '#141413' : '#ffffff',
    sampledMinContrast: Number(Math.max(black, white).toFixed(2)),
  }
}
