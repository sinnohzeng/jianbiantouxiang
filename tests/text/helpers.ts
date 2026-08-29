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
  fillStyle: string
  strokeStyle: string
  shadowColor: string
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
      fillStyle: stub.fillStyle,
      strokeStyle: stub.strokeStyle,
      shadowColor: stub.shadowColor,
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

/** 源画布上某个像素的 RGBA，坐标是画布绝对坐标。 */
export type PixelFn = (x: number, y: number) => readonly [number, number, number, number]

/** 挂在假画布上的取色函数，采样画布缩图时按它取源像素。 */
const PIXEL = Symbol('pixel')

interface FakeSource {
  width: number
  height: number
  [PIXEL]: PixelFn
}

/**
 * 假的像素源。自动取色只把 ctx.canvas 当 drawImage 的源，不读它别的字段，
 * 所以这里只给尺寸与取色函数。
 */
export function createPixelContext(pixel: PixelFn, size = 1000): CanvasRenderingContext2D {
  const canvas: FakeSource = { width: size, height: size, [PIXEL]: pixel }
  return {
    canvas,
    getImageData() {
      throw new Error('采样不应直接在全分辨率画布上回读')
    },
  } as unknown as CanvasRenderingContext2D
}

/** 返回纯色像素的假上下文，用于自动文字色的采样。 */
export function createSolidContext(r: number, g: number, b: number, a = 255) {
  return createPixelContext(() => [r, g, b, a])
}

/** 一次缩图采样的记录：采样画布尺寸、getContext 参数、drawImage 的源矩形、回读次数。 */
export interface SampleRecord {
  width: number
  height: number
  options: CanvasRenderingContext2DSettings | undefined
  draws: Array<{ sx: number; sy: number; sw: number; sh: number; dw: number; dh: number }>
  reads: number
  smoothingQuality: string
}

export interface SampleRecorder {
  /** 按新建顺序排列，一次取色对应一条。 */
  records: SampleRecord[]
  restore(): void
}

interface SampleFakeOptions {
  /** 模拟拿不到 2D 上下文的宿主。 */
  failContext?: boolean
  /** 模拟画布被跨源图片污染，回读抛 SecurityError。 */
  failRead?: boolean
}

interface DrawMap {
  source: FakeSource
  sx: number
  sy: number
  sw: number
  sh: number
  dw: number
  dh: number
}

function createSampleCanvas(record: SampleRecord, options: SampleFakeOptions): HTMLCanvasElement {
  let drawn: DrawMap | null = null
  // 平滑开关放在外面，免得对象字面量在自己的方法里引用自己
  const smoothing = { enabled: false, quality: 'low' }
  const ctx = {
    get imageSmoothingEnabled() {
      return smoothing.enabled
    },
    set imageSmoothingEnabled(value: boolean) {
      smoothing.enabled = value
    },
    get imageSmoothingQuality() {
      return smoothing.quality
    },
    set imageSmoothingQuality(value: string) {
      smoothing.quality = value
    },
    drawImage(
      source: FakeSource,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      _dx: number,
      _dy: number,
      dw: number,
      dh: number,
    ) {
      record.draws.push({ sx, sy, sw, sh, dw, dh })
      drawn = { source, sx, sy, sw, sh, dw, dh }
    },
    getImageData(x: number, y: number, width: number, height: number) {
      record.reads += 1
      record.smoothingQuality = smoothing.quality
      if (options.failRead) throw new Error('tainted')
      const data = new Uint8ClampedArray(width * height * 4)
      const map: DrawMap | null = drawn
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
          const index = (row * width + col) * 4
          if (!map) continue
          // 缩图按最近点回映射到源坐标，纯色与分块图案下与真实缩图等价
          const srcX = Math.floor(map.sx + ((x + col + 0.5) * map.sw) / map.dw)
          const srcY = Math.floor(map.sy + ((y + row + 0.5) * map.sh) / map.dh)
          const [r, g, b, a] = map.source[PIXEL](srcX, srcY)
          data[index] = r
          data[index + 1] = g
          data[index + 2] = b
          data[index + 3] = a
        }
      }
      return { data, width, height, colorSpace: 'srgb' as const }
    },
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext(kind: string, settings?: CanvasRenderingContext2DSettings) {
      if (kind !== '2d' || options.failContext) return null
      record.width = canvas.width
      record.height = canvas.height
      record.options = settings
      return ctx as unknown as CanvasRenderingContext2D
    },
  }
  return canvas as unknown as HTMLCanvasElement
}

/**
 * 接管 document.createElement('canvas')，把自动取色新建的采样画布换成可断言的假画布。
 * jsdom 没有 2D 上下文实现，真画布在这里拿不到 ctx，采样路径只能靠这份假画布覆盖。
 */
export function installSampleCanvas(options: SampleFakeOptions = {}): SampleRecorder {
  const records: SampleRecord[] = []
  const original = document.createElement
  document.createElement = function createElement(this: Document, tag: string, ...rest: unknown[]) {
    if (tag !== 'canvas') {
      return (original as (...args: unknown[]) => HTMLElement).call(this, tag, ...rest)
    }
    const record: SampleRecord = {
      width: 0,
      height: 0,
      options: undefined,
      draws: [],
      reads: 0,
      smoothingQuality: '',
    }
    records.push(record)
    return createSampleCanvas(record, options)
  } as typeof document.createElement
  return {
    records,
    restore: () => {
      document.createElement = original
    },
  }
}
