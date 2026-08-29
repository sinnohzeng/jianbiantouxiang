import { resolveSeed } from '@/engine/seed'
import type { AvatarConfig } from '@/state/config'
import { createCanvas, get2d, releaseCanvas } from './canvas'

/**
 * 合成用到的外部能力。抽成参数有两个作用：单测不必拉起 WebGL 与字体网络，
 * 集成时 `compose.ts` 一处装配，合成本身不认识具体实现。
 * L 是排版结果，合成只负责在量测、取色与绘制之间传递，不读它的字段。
 */
export interface ComposeDeps<L> {
  loadFontForConfig(config: AvatarConfig): Promise<unknown>
  renderGradient(config: AvatarConfig, width: number, height: number): Promise<HTMLCanvasElement>
  drawHighlight(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    strength: number,
    seed: string,
  ): void
  layoutText(config: AvatarConfig, width: number, height: number): L
  pickTextColor(ctx: CanvasRenderingContext2D, layout: L, config: AvatarConfig): string
  drawText(ctx: CanvasRenderingContext2D, layout: L, config: AvatarConfig, color: string): void
}

/**
 * 按 底色 → 渐变 → 高光 → 文字 → 形状遮罩 的顺序合成一张完整头像。
 * 顺序是硬性的：高光要压在渐变上，自动文字色要读高光之后的画面，
 * 遮罩必须最后做，否则被裁掉的边角会被后续绘制重新填满。
 */
export async function composeWith<L>(
  config: AvatarConfig,
  width: number,
  height: number,
  deps: ComposeDeps<L>,
): Promise<HTMLCanvasElement> {
  // 字体没就绪就量测，导出会用回退字体，和预览对不上
  await deps.loadFontForConfig(config)

  const gradient = await deps.renderGradient(config, width, height)
  const canvas = createCanvas(width, height)
  const ctx = get2d(canvas)

  // 渐变理论上铺满整张画布，底色只是兜底，防止引擎限幅后留下未绘制的边
  ctx.fillStyle = config.exportOptions.bgColor
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(gradient, 0, 0, width, height)
  releaseCanvas(gradient)

  // 种子派生规则归引擎所有，这里必须调 resolveSeed，
  // 否则空白种子下高光与渐变会用两串不同的随机数
  deps.drawHighlight(ctx, width, height, config.highlight, resolveSeed(config))

  if (config.text.trim() !== '') {
    const layout = deps.layoutText(config, width, height)
    const color =
      config.typography.colorMode === 'auto'
        ? deps.pickTextColor(ctx, layout, config)
        : config.typography.color
    deps.drawText(ctx, layout, config, color)
  }

  applyShapeMask(ctx, config, width, height)
  return canvas
}

/**
 * 用 destination-in 把形状外的像素清成透明。PNG / WebP 导出直接得到透明外区，
 * JPG 在编码阶段再铺底色。
 */
function applyShapeMask(
  ctx: CanvasRenderingContext2D,
  config: AvatarConfig,
  width: number,
  height: number,
): void {
  const { shape, radius } = config.canvas
  const short = Math.min(width, height)
  const corner = shape === 'rounded' ? radius * short : 0
  if (shape === 'square' || (shape === 'rounded' && corner <= 0)) return

  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  // destination-in 只取遮罩的 alpha，颜色随便给一个不透明色
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  if (shape === 'circle') {
    // 非正方形画布取内接圆，拉成椭圆会让文字看着歪
    ctx.arc(width / 2, height / 2, short / 2, 0, Math.PI * 2)
  } else {
    traceRoundRect(ctx, width, height, Math.min(corner, short / 2))
  }
  ctx.fill()
  ctx.restore()
}

/** 用 arcTo 画圆角矩形，避开 roundRect 在旧 Safari 上的缺席。 */
function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  r: number,
): void {
  ctx.moveTo(r, 0)
  ctx.lineTo(width - r, 0)
  ctx.arcTo(width, 0, width, r, r)
  ctx.lineTo(width, height - r)
  ctx.arcTo(width, height, width - r, height, r)
  ctx.lineTo(r, height)
  ctx.arcTo(0, height, 0, height - r, r)
  ctx.lineTo(0, r)
  ctx.arcTo(0, 0, r, 0, r)
  ctx.closePath()
}
