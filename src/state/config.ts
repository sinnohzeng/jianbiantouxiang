/**
 * v3 的共享配置契约。所有模块围绕这份类型写，之后只允许增字段，不允许改语义。
 */

import type { Locale } from '@/i18n'

export type StyleId = 'mesh' | 'flow' | 'silk' | 'grain'
export type Shape = 'square' | 'rounded' | 'circle'
export type TextEffect = 'plain' | 'outline' | 'shadow' | 'glow' | 'pill'
export type Anchor = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br'
/**
 * 用途：画面怎么构成。版式写死在代码里，用户只选用途、填内容，见 specs/v3.1-badge-templates。
 * 规约里的图标徽章（logo）推迟到 v3.2，那一档要先有图形来源才有意义，
 * 现在不进取值集，未来版本的链接落到这里会退回 text，画出来仍是一张正常的纯文字图。
 */
export type LayoutKind = 'text' | 'status'

export interface AvatarConfig {
  v: 3
  text: string
  seed: string // 空字符串表示由 text 哈希派生
  style: StyleId
  styleParams: {
    intensity: number // 0..1，各 style 自行映射（mesh: wave；flow: distortion；silk: 褶皱；grain: intensity）
    softness: number // 0..1（mesh: mixing；flow: 1-swirl；silk: softness；grain: softness）
    grain: number // 0..1，联动 grainMixer / grainOverlay / noise
    scale: number // 0.5..2
    rotation: number // 0..360
  }
  highlight: number // 0..1，2D 合成阶段的柔白高光强度
  palette: string // 内置配色 id 或 'custom'
  customColors: string[] // 2..6 个 hex
  canvas: { width: number; height: number; shape: Shape; radius: number /* 0..0.5 */ }
  typography: {
    fontFamily: string
    fontSource: 'google' | 'system' | 'upload'
    fontWeight: number
    sizeMode: 'auto' | 'manual'
    fontSize: number // 画布短边比例 0.04..0.92，manual 时生效
    padding: number // 每边安全边距比例 0..0.3
    lineHeight: number // 0.85..2
    letterSpacing: number // em，-0.1..0.5
    align: 'left' | 'center' | 'right'
    anchor: Anchor
    offsetX: number // 画布宽比例 -0.5..0.5
    offsetY: number
    vertical: boolean
    autoWrap: boolean
    effect: TextEffect
    effectStrength: number // 0..1
    colorMode: 'auto' | 'custom'
    color: string
    /** 显式行相对基准字号的乘数；自动换行的续行沿用源段落的值。 */
    lineSizeScales: number[]
    /** 显式行的水平视觉补偿，按画布宽度比例。 */
    lineOffsetsX: number[]
    pill: { radius: number; padding: number; opacity: number }
  }
  layout: {
    kind: LayoutKind
    scale: number // status：次行相对首行的字号比例 0.2..0.8
  }
  exportOptions: {
    format: 'jpg' | 'png' | 'webp'
    sizeTarget: 'none' | '1mb' | '2mb'
    bgColor: string // JPG 与圆角外区域的底色
  }
}

export const STYLE_IDS: readonly StyleId[] = ['mesh', 'flow', 'silk', 'grain']
export const SHAPES: readonly Shape[] = ['square', 'rounded', 'circle']
export const TEXT_EFFECTS: readonly TextEffect[] = ['plain', 'outline', 'shadow', 'glow', 'pill']
export const ANCHORS: readonly Anchor[] = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br']
export const FONT_SOURCES = ['google', 'system', 'upload'] as const
export const SIZE_MODES = ['auto', 'manual'] as const
export const ALIGNS = ['left', 'center', 'right'] as const
export const COLOR_MODES = ['auto', 'custom'] as const
export const EXPORT_FORMATS = ['jpg', 'png', 'webp'] as const
export const SIZE_TARGETS = ['none', '1mb', '2mb'] as const
export const LAYOUT_KINDS: readonly LayoutKind[] = ['text', 'status']

/** 行级参数最多保存 12 档，防止坏链接把状态与 URL 无限撑大。 */
export const LINE_OVERRIDE_MAX = 12

/** 状态徽章里两块之间的留白，按首行字号算。 */
export const STATUS_GAP_RATIO = 0.18

/** 画布边长的合法区间，上限对应桌面导出的 4096。 */
export const CANVAS_MIN = 64
export const CANVAS_MAX = 8192

export const DEFAULT_CONFIG: AvatarConfig = {
  v: 3,
  text: '飞书\n效率先锋',
  seed: '',
  style: 'mesh',
  styleParams: {
    intensity: 0.5,
    softness: 0.5,
    grain: 0.15,
    scale: 1,
    rotation: 0,
  },
  highlight: 0.25,
  palette: 'aurora',
  customColors: [],
  canvas: { width: 1024, height: 1024, shape: 'square', radius: 0.2 },
  typography: {
    // 契约基线，也是 normalizeConfig 的兜底值。首次进入实际用哪套字体按界面语言定，见 LOCALE_DEFAULT_FONT
    fontFamily: 'Noto Sans SC',
    fontSource: 'google',
    fontWeight: 700,
    sizeMode: 'auto',
    fontSize: 0.42,
    padding: 0.15,
    lineHeight: 1.03,
    letterSpacing: 0,
    align: 'center',
    anchor: 'c',
    offsetX: 0,
    offsetY: 0,
    vertical: false,
    autoWrap: true,
    effect: 'glow',
    effectStrength: 0.5,
    colorMode: 'custom',
    color: '#ffffff',
    lineSizeScales: [1, 0.62],
    lineOffsetsX: [0, 0],
    pill: { radius: 0.5, padding: 0.3, opacity: 0.55 },
  },
  layout: {
    kind: 'text',
    scale: 0.62,
  },
  exportOptions: {
    format: 'jpg',
    sizeTarget: '1mb',
    bgColor: '#ffffff',
  },
}

/**
 * 界面语言对应的默认字体，对齐 spec §54：默认配置只有字体跟着语言变，其余字段一视同仁。
 *
 * 五个 family 都在 CURATED_FONTS 里，且都覆盖 DEFAULT_CONFIG 的 700 字重。
 * 不能一律用 Noto Sans SC：它的 subset 只有 chinese-simplified 与拉丁系，谚文不在切片里，
 * 韩文界面拿它渲染会被判成加载失败，整块掉回系统字体，字体按钮上写的名字与画面对不上。
 *
 * 谁来用它：src/App.tsx 的 LocaleDefaults，只在配置来自默认值这一档接管。
 * 分享链接与本机存档都是用户自己的配置，一个字段都不能按语言改，见 store 的 readInitialConfig。
 */
export const LOCALE_DEFAULT_FONT: Record<Locale, string> = {
  'zh-CN': 'Noto Sans SC',
  'zh-HK': 'Noto Sans TC',
  en: 'Inter',
  ja: 'Noto Sans JP',
  ko: 'Noto Sans KR',
}

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T

/** 递归的可选版本，用于接收链接、localStorage 与面板的局部更新。 */
export type PartialConfig = DeepPartial<AvatarConfig>

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** 取数值：非有限数回落到 fallback，再按区间夹值。 */
function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(num(value, fallback, min, max))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/** 归一化 hex：接受 #rgb 与 #rrggbb，输出小写六位；非法值回落到 fallback。 */
export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const raw = value.trim()
  if (!HEX_RE.test(raw)) return fallback
  const body = raw.slice(1).toLowerCase()
  if (body.length === 3) {
    return `#${body[0]!}${body[0]!}${body[1]!}${body[1]!}${body[2]!}${body[2]!}`
  }
  return `#${body}`
}

function normalizeColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_CONFIG.customColors]
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const hex = normalizeHex(item, '')
    if (hex) out.push(hex)
    if (out.length === 6) break
  }
  return out
}

function normalizeNumberArray(
  value: unknown,
  fallback: readonly number[],
  missing: number,
  min: number,
  max: number,
): number[] {
  if (!Array.isArray(value)) return [...fallback]
  const out: number[] = []
  for (let index = 0; index < Math.min(value.length, LINE_OVERRIDE_MAX); index += 1) {
    out.push(num(value[index], fallback[index] ?? missing, min, max))
  }
  return out.length > 0 ? out : [...fallback]
}

/**
 * 把任意局部输入补成完整配置：缺字段补默认，数值按注释里的区间夹值，
 * 枚举与数组做合法性校验。任何输入都不会抛错。
 */
export function normalizeConfig(partial: unknown): AvatarConfig {
  const d = DEFAULT_CONFIG
  const src = isRecord(partial) ? partial : {}

  const sp = isRecord(src.styleParams) ? src.styleParams : {}
  const cv = isRecord(src.canvas) ? src.canvas : {}
  const tp = isRecord(src.typography) ? src.typography : {}
  const pill = isRecord(tp.pill) ? tp.pill : {}
  const ex = isRecord(src.exportOptions) ? src.exportOptions : {}
  const lay = isRecord(src.layout) ? src.layout : {}
  const lineSizeScales = normalizeNumberArray(
    tp.lineSizeScales,
    d.typography.lineSizeScales,
    1,
    0.2,
    2,
  )
  // v3.1 的状态徽章只有 layout.scale 一个自由度。旧链接缺行级数组时，
  // 把第二行迁移成同一个值，不能因为契约扩了就把用户调好的比例打回默认。
  if (!Array.isArray(tp.lineSizeScales) && lay.kind === 'status') {
    lineSizeScales[1] = num(lay.scale, d.layout.scale, 0.2, 0.8)
  }

  return {
    v: 3,
    text: str(src.text, d.text),
    seed: str(src.seed, d.seed),
    style: pick(src.style, STYLE_IDS, d.style),
    styleParams: {
      intensity: num(sp.intensity, d.styleParams.intensity, 0, 1),
      softness: num(sp.softness, d.styleParams.softness, 0, 1),
      grain: num(sp.grain, d.styleParams.grain, 0, 1),
      scale: num(sp.scale, d.styleParams.scale, 0.5, 2),
      rotation: num(sp.rotation, d.styleParams.rotation, 0, 360),
    },
    highlight: num(src.highlight, d.highlight, 0, 1),
    palette: str(src.palette, d.palette),
    customColors: normalizeColors(src.customColors),
    canvas: {
      width: int(cv.width, d.canvas.width, CANVAS_MIN, CANVAS_MAX),
      height: int(cv.height, d.canvas.height, CANVAS_MIN, CANVAS_MAX),
      shape: pick(cv.shape, SHAPES, d.canvas.shape),
      radius: num(cv.radius, d.canvas.radius, 0, 0.5),
    },
    typography: {
      fontFamily: str(tp.fontFamily, d.typography.fontFamily),
      fontSource: pick(tp.fontSource, FONT_SOURCES, d.typography.fontSource),
      fontWeight: int(tp.fontWeight, d.typography.fontWeight, 100, 900),
      sizeMode: pick(tp.sizeMode, SIZE_MODES, d.typography.sizeMode),
      fontSize: num(tp.fontSize, d.typography.fontSize, 0.04, 0.92),
      padding: num(tp.padding, d.typography.padding, 0, 0.3),
      lineHeight: num(tp.lineHeight, d.typography.lineHeight, 0.85, 2),
      letterSpacing: num(tp.letterSpacing, d.typography.letterSpacing, -0.1, 0.5),
      align: pick(tp.align, ALIGNS, d.typography.align),
      anchor: pick(tp.anchor, ANCHORS, d.typography.anchor),
      offsetX: num(tp.offsetX, d.typography.offsetX, -0.5, 0.5),
      offsetY: num(tp.offsetY, d.typography.offsetY, -0.5, 0.5),
      vertical: bool(tp.vertical, d.typography.vertical),
      autoWrap: bool(tp.autoWrap, d.typography.autoWrap),
      effect: pick(tp.effect, TEXT_EFFECTS, d.typography.effect),
      effectStrength: num(tp.effectStrength, d.typography.effectStrength, 0, 1),
      colorMode: pick(tp.colorMode, COLOR_MODES, d.typography.colorMode),
      color: normalizeHex(tp.color, d.typography.color),
      lineSizeScales,
      lineOffsetsX: normalizeNumberArray(
        tp.lineOffsetsX,
        d.typography.lineOffsetsX,
        0,
        -0.25,
        0.25,
      ),
      pill: {
        radius: num(pill.radius, d.typography.pill.radius, 0, 0.5),
        padding: num(pill.padding, d.typography.pill.padding, 0, 1),
        opacity: num(pill.opacity, d.typography.pill.opacity, 0, 1),
      },
    },
    layout: {
      kind: pick(lay.kind, LAYOUT_KINDS, d.layout.kind),
      scale: num(lay.scale, d.layout.scale, 0.2, 0.8),
    },
    exportOptions: {
      format: pick(ex.format, EXPORT_FORMATS, d.exportOptions.format),
      sizeTarget: pick(ex.sizeTarget, SIZE_TARGETS, d.exportOptions.sizeTarget),
      bgColor: normalizeHex(ex.bgColor, d.exportOptions.bgColor),
    },
  }
}

/** 稳定序列化：对象键按字典序排列，保证同一配置得到同一字符串。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
  return `{${parts.join(',')}}`
}

/** FNV-1a 32 位哈希，返回 8 位小写 hex，用作缓存键与渲染去重标记。 */
export function configHash(config: AvatarConfig): string {
  const input = stableStringify(config)
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
