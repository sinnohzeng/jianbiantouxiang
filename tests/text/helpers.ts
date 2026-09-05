import { normalizeConfig, type AvatarConfig, type PartialConfig } from '@/state/config'
import { isCjk, toGraphemes, type MeasureFn } from '@/text/measure'

/** 单测用的确定性度量：CJK 占满一个 em，其余按 0.6 em，字距只落在字与字之间。 */
export function createStubMeasure(): MeasureFn {
  return (text, font, letterSpacingPx) => {
    const size = fontSizeOf(font)
    const graphemes = toGraphemes(text)
    let width = 0
    for (const grapheme of graphemes) width += isCjk(grapheme) ? size : size * 0.6
    return {
      width: width + letterSpacingPx * Math.max(0, graphemes.length - 1),
      ascent: size * 0.8,
      descent: size * 0.2,
    }
  }
}

export function fontSizeOf(font: string): number {
  const matched = /(-?\d*\.?\d+)px/.exec(font)
  const size = matched ? Number(matched[1]) : Number.NaN
  return Number.isFinite(size) ? size : 16
}

export function makeConfig(overrides: PartialConfig = {}): AvatarConfig {
  return normalizeConfig(overrides)
}

/** 每次落笔时的画笔状态，用来断言底板色与光晕色。 */
export interface PaintState {
  op: 'fill' | 'fillText' | 'strokeText'
  /** 落笔当时的 canvas font，用来盯住逐行换字号有没有真的生效。 */
  font: string
  fillStyle: string
  strokeStyle: string
  shadowColor: string
  shadowBlur: number
  globalAlpha: number
}

export interface StubContext {
  ctx: CanvasRenderingContext2D
  calls: string[]
  paints: PaintState[]
}

/** 记录调用顺序的假 2D 上下文，用来断言绘制顺序与逐字绘制。 */
export function createStubContext(): StubContext {
  const calls: string[] = []
  const paints: PaintState[] = []
  const snap = (op: PaintState['op']): void => {
    paints.push({
      op,
      font: stub.font,
      fillStyle: stub.fillStyle,
      strokeStyle: stub.strokeStyle,
      shadowColor: stub.shadowColor,
      shadowBlur: stub.shadowBlur,
      globalAlpha: stub.globalAlpha,
    })
  }
  const stub = {
    canvas: { width: 1000, height: 1000 },
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineJoin: 'miter',
    miterLimit: 10,
    globalAlpha: 1,
    letterSpacing: '0px',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: () => calls.push('moveTo'),
    arcTo: () => calls.push('arcTo'),
    roundRect: () => calls.push('roundRect'),
    fill: () => {
      snap('fill')
      calls.push('fill')
    },
    fillText: (text: string) => {
      snap('fillText')
      calls.push(`fillText:${text}`)
    },
    strokeText: (text: string) => {
      snap('strokeText')
      calls.push(`strokeText:${text}`)
    },
    measureText: (text: string) => ({ width: text.length * 10 }),
  }
  return { ctx: stub as unknown as CanvasRenderingContext2D, calls, paints }
}
