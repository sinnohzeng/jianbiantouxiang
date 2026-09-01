import { INK_DARK, INK_LIGHT, isLightColor } from '@/text/auto-color'
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
  ctx.drawImage(graphic.image, rect.x, rect.y, rect.width, rect.height)
}
