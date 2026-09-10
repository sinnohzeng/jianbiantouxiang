import { createCanvas, releaseCanvas } from '@/lib/canvas'
import { INK_DARK, INK_LIGHT, isLightColor } from '@/text/ink'
import type { AvatarConfig } from '@/state/config'
import type { Rect } from '@/text/layout'
import type { Graphic } from './types'

function inkOpposite(color: string): string {
  return isLightColor(color) ? INK_DARK : INK_LIGHT
}

function glowColor(color: string): string {
  return isLightColor(color) ? color : INK_LIGHT
}

function paintLucide(
  ctx: CanvasRenderingContext2D,
  graphic: Extract<Graphic, { kind: 'lucide' }>,
  rect: Rect,
  config: AvatarConfig,
  color: string,
): void {
  const { effect, effectStrength } = config.typography
  ctx.save()
  ctx.translate(rect.x, rect.y)
  ctx.scale(rect.width / graphic.width, rect.height / graphic.height)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color

  if (effect === 'outline') {
    ctx.save()
    ctx.lineWidth = 2 + 6 * effectStrength
    ctx.strokeStyle = inkOpposite(color)
    ctx.stroke(graphic.path)
    ctx.restore()
  } else if (effect === 'shadow') {
    ctx.shadowColor = `rgba(0, 0, 0, ${(0.15 + 0.45 * effectStrength).toFixed(3)})`
    ctx.shadowBlur = rect.height * 0.16 * effectStrength
    ctx.shadowOffsetY = rect.height * 0.05 * effectStrength
  } else if (effect === 'glow') {
    ctx.shadowColor = glowColor(color)
    ctx.shadowBlur = rect.height * 0.45 * effectStrength
    ctx.stroke(graphic.path)
    ctx.shadowBlur = rect.height * 0.18 * effectStrength
    ctx.stroke(graphic.path)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  ctx.stroke(graphic.path)
  ctx.restore()
}

/**
 * 单色档的着色：先把图形画到一张按落位矩形开的离屏画布，
 * 再用 source-in 把不透明的那部分整块填成当前文字色，最后贴回主画布。
 *
 * 合成状态全落在离屏那张上，主画布的 globalCompositeOperation 一路不动。
 * 离屏画布不缓存，用完立刻缩到 1×1 交还显存：导出 8192 时图形也有上千像素见方。
 * 拿不到 2D 上下文就回 false，调用方退回原色绘制，图形位不会因此空掉。
 */
function paintMono(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  rect: Rect,
  color: string,
): boolean {
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)
  if (width <= 0 || height <= 0) return false
  const offscreen = createCanvas(width, height)
  try {
    const off = offscreen.getContext('2d')
    if (!off) return false
    off.drawImage(image, 0, 0, width, height)
    off.globalCompositeOperation = 'source-in'
    off.fillStyle = color
    off.fillRect(0, 0, width, height)
    ctx.drawImage(offscreen, rect.x, rect.y, rect.width, rect.height)
    return true
  } finally {
    releaseCanvas(offscreen)
  }
}

/** 图形与文字共用效果口径；emoji 与上传图形保持原色，不做文字效果。 */
export function drawGraphic(
  ctx: CanvasRenderingContext2D,
  graphic: Graphic,
  rect: Rect,
  config: AvatarConfig,
  color: string,
): void {
  if (rect.width <= 0 || rect.height <= 0) return
  if (graphic.kind === 'lucide') {
    paintLucide(ctx, graphic, rect, config, color)
    return
  }
  // 单色只认品牌来源：界面上那个分段控件也只在品牌来源时出现，
  // 换到 emoji 或上传图片之后这一位仍留着旧值，不能拿它去压平用户自己的图
  const icon = config.layout.icon
  if (icon.source === 'brand' && icon.mono && paintMono(ctx, graphic.image, rect, color)) return
  ctx.drawImage(graphic.image, rect.x, rect.y, rect.width, rect.height)
}
