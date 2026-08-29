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

export interface StubContext {
  ctx: CanvasRenderingContext2D
  calls: string[]
}

/** 记录调用顺序的假 2D 上下文，用来断言绘制顺序与逐字绘制。 */
export function createStubContext(): StubContext {
  const calls: string[] = []
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
    fill: () => calls.push('fill'),
    fillText: (text: string) => calls.push(`fillText:${text}`),
    strokeText: (text: string) => calls.push(`strokeText:${text}`),
    measureText: (text: string) => ({ width: text.length * 10 }),
  }
  return { ctx: stub as unknown as CanvasRenderingContext2D, calls }
}

/** 返回纯色像素的假上下文，用于自动文字色的采样。 */
export function createSolidContext(r: number, g: number, b: number, a = 255) {
  const stub = {
    canvas: { width: 1000, height: 1000 },
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4)
      for (let i = 0; i < width * height; i += 1) {
        data[i * 4] = r
        data[i * 4 + 1] = g
        data[i * 4 + 2] = b
        data[i * 4 + 3] = a
      }
      return { data, width, height, colorSpace: 'srgb' as const }
    },
  }
  return stub as unknown as CanvasRenderingContext2D
}
