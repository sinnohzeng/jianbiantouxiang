import type { AvatarConfig } from '@/state/config'
import { INK_DARK, INK_LIGHT, isLightColor } from './auto-color'
import type { LayoutLine, PillRect, TextLayout } from './layout'
import { cssPx, toGraphemes } from './measure'

type PaintMode = 'fill' | 'stroke'

/** 描边宽度按字号取比例，effectStrength 线性缩放。 */
const OUTLINE_RATIO = 0.06

function inkOpposite(color: string): string {
  return isLightColor(color) ? INK_DARK : INK_LIGHT
}

/**
 * 光晕颜色：浅色字用自己的颜色发光，深色字改用白光。
 * 深色字配同色光晕会在字周围堆出一圈脏晕，越强越脏，白光反而把字托起来。
 */
function glowColor(textColor: string): string {
  return isLightColor(textColor) ? textColor : INK_LIGHT
}

function roundRectPath(ctx: CanvasRenderingContext2D, rect: PillRect): void {
  const radius = Math.max(0, Math.min(rect.radiusPx, Math.min(rect.width, rect.height) / 2))
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
    return
  }
  const { x, y, width, height } = rect
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function paintOne(
  ctx: CanvasRenderingContext2D,
  mode: PaintMode,
  text: string,
  x: number,
  y: number,
) {
  if (mode === 'stroke') ctx.strokeText(text, x, y)
  else ctx.fillText(text, x, y)
}

function paintLine(
  ctx: CanvasRenderingContext2D,
  line: LayoutLine,
  mode: PaintMode,
  letterSpacingPx: number,
  nativeSpacing: boolean,
): void {
  if (line.glyphs.length > 0) {
    for (const glyph of line.glyphs) paintOne(ctx, mode, glyph.char, glyph.x, glyph.y)
    return
  }
  if (nativeSpacing) {
    paintOne(ctx, mode, line.text, line.x, line.y)
    return
  }
  // 引擎不支持 letterSpacing 时逐字补偿，否则画出来会比排版算的窄一截。
  let cursor = line.x
  for (const grapheme of toGraphemes(line.text)) {
    paintOne(ctx, mode, grapheme, cursor, line.y)
    cursor += ctx.measureText(grapheme).width + letterSpacingPx
  }
}

/**
 * 一段同号的行。状态徽章的首行与次行字号不同，字号既决定 ctx.font，
 * 也决定描边、光晕、阴影的尺度，所以效果要按段各算一遍，不能拿整块的字号一刀切。
 */
interface Run {
  lines: LayoutLine[]
  font: string
  fontSizePx: number
  letterSpacingPx: number
}

/** 相邻同字体的行并成一段。纯文字与图标徽章只会得到一段，走的还是原来那条路。 */
function runsOf(layout: TextLayout): Run[] {
  const runs: Run[] = []
  for (const line of layout.lines) {
    const font = line.font ?? layout.font
    const last = runs.at(-1)
    if (last && last.font === font) {
      last.lines.push(line)
      continue
    }
    runs.push({
      lines: [line],
      font,
      fontSizePx: line.fontSizePx ?? layout.fontSizePx,
      letterSpacingPx: line.letterSpacingPx ?? layout.letterSpacingPx,
    })
  }
  return runs
}

function paintAll(
  ctx: CanvasRenderingContext2D,
  run: Run,
  mode: PaintMode,
  nativeSpacing: boolean,
): void {
  for (const line of run.lines) paintLine(ctx, line, mode, run.letterSpacingPx, nativeSpacing)
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/** 竖排逐字定位，字距已经算进坐标，原生字距必须归零。 */
function applyLetterSpacing(ctx: CanvasRenderingContext2D, run: Run, vertical: boolean): boolean {
  if (!('letterSpacing' in ctx)) return run.letterSpacingPx === 0
  ctx.letterSpacing = vertical ? '0px' : cssPx(run.letterSpacingPx)
  return true
}

/**
 * 底板一律取文字色的反色：深字配白底板、白字配黑底板。
 * 跟着导出底色走的老做法在浅配色上会画出一块白底白字的隐形底板。
 */
function drawPlate(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
  textColor: string,
): void {
  const { pill } = config.typography
  ctx.save()
  ctx.globalAlpha = pill.opacity
  ctx.fillStyle = inkOpposite(textColor)
  roundRectPath(ctx, layout.pill)
  ctx.fill()
  ctx.restore()
}

/** 把排版结果画到 2D 上下文，颜色由调用方给（自动色走 pickTextColor）。 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  config: AvatarConfig,
  color: string,
): void {
  if (layout.lines.length === 0) return

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  clearShadow(ctx)

  // 底板包住整块文字，与分段无关，所以铺在所有段之前
  if (config.typography.effect === 'pill') drawPlate(ctx, layout, config, color)

  for (const run of runsOf(layout)) paintRun(ctx, run, layout, config, color)

  clearShadow(ctx)
  ctx.restore()
}

/** 画一段同号的行：先按效果补底层，再落正文那一遍。 */
function paintRun(
  ctx: CanvasRenderingContext2D,
  run: Run,
  layout: TextLayout,
  config: AvatarConfig,
  color: string,
): void {
  const { effect, effectStrength } = config.typography
  ctx.font = run.font
  ctx.fillStyle = color
  clearShadow(ctx)
  const nativeSpacing = applyLetterSpacing(ctx, run, layout.vertical)

  if (effect === 'outline') {
    const lineWidth = run.fontSizePx * OUTLINE_RATIO * effectStrength
    if (lineWidth > 0) {
      ctx.lineWidth = lineWidth
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeStyle = inkOpposite(color)
      paintAll(ctx, run, 'stroke', nativeSpacing)
    }
  } else if (effect === 'shadow') {
    ctx.shadowColor = `rgba(0, 0, 0, ${(0.15 + 0.45 * effectStrength).toFixed(3)})`
    ctx.shadowBlur = run.fontSizePx * 0.16 * effectStrength
    ctx.shadowOffsetY = run.fontSizePx * 0.05 * effectStrength
  } else if (effect === 'glow') {
    // 两层外发光：先大范围铺一层弥散，再补一层近距离的亮边。
    ctx.shadowColor = glowColor(color)
    ctx.shadowBlur = run.fontSizePx * 0.45 * effectStrength
    paintAll(ctx, run, 'fill', nativeSpacing)
    ctx.shadowBlur = run.fontSizePx * 0.18 * effectStrength
    paintAll(ctx, run, 'fill', nativeSpacing)
    clearShadow(ctx)
  }

  paintAll(ctx, run, 'fill', nativeSpacing)
  clearShadow(ctx)
}
