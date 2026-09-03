/**
 * v4 的共享配置契约。所有模块围绕这份类型写，之后只允许增字段，不允许改语义。
 *
 * v4.0 把 v3 的三个用途（纯文字 / 状态徽章 / 图标徽章）收敛为一个两行徽章模型，
 * 见 specs/v4.0-two-line-badge/spec.md：
 * - `text` 最多两行，第三行起并入第二行，旧链接在 `normalizeConfig` 里迁移；
 * - `layout.kind` 与自由排版字段（对齐、锚点、全局偏移、竖排、自动换行开关）退役，
 *   旧载荷里带着它们不报错，读进来即忽略；
 * - 版式只剩一个纵向栈：图标（可选）→ 第一行 → 第二行，水平居中、自动适配。
 */

import { twoLinesOf } from '@/text/wrap'
import type { Locale } from '@/i18n'

export type StyleId = 'mesh' | 'flow' | 'silk' | 'grain'
export type Shape = 'square' | 'rounded' | 'circle'
export type TextEffect = 'plain' | 'outline' | 'shadow' | 'glow' | 'pill'
export type IconSource = 'none' | 'builtin' | 'emoji' | 'upload'

export interface AvatarConfig {
  v: 4
  /** 最多两行：第一行 \n 第二行；第二行为空表示只有第一行。 */
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
    effect: TextEffect
    effectStrength: number // 0..1
    colorMode: 'auto' | 'custom'
    color: string
    /** 两档：次行相对基准字号的乘数。 */
    lineSizeScales: number[]
    /** 两档：逐行水平视觉补偿，按画布宽度比例，落位时只动自己那行。 */
    lineOffsetsX: number[]
    pill: { radius: number; padding: number; opacity: number }
  }
  layout: {
    /** logo：图形占安全框高度的比例。 */
    graphic: number // 0.3..0.8
    icon: {
      source: IconSource
      /** builtin 是 lucide 名，emoji 是去 FE0F 的码点串，upload 是本次会话 id。 */
      id: string
    }
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
export const FONT_SOURCES = ['google', 'system', 'upload'] as const
export const SIZE_MODES = ['auto', 'manual'] as const
export const COLOR_MODES = ['auto', 'custom'] as const
export const EXPORT_FORMATS = ['jpg', 'png', 'webp'] as const
export const SIZE_TARGETS = ['none', '1mb', '2mb'] as const
export const ICON_SOURCES = ['none', 'builtin', 'emoji', 'upload'] as const

/** 图形标识最长 128 字符，防止坏链接把状态与 hash 无限撑大。 */
export const ICON_ID_MAX = 128

/** 行级参数固定两档：两行模型之外没有第三行。 */
export const LINE_OVERRIDE_MAX = 2

/** 次行相对首行的默认字号比例。 */
export const STATUS_SECOND_LINE_SCALE = 0.62

/** 徽章两块之间的留白，按首行字号算。 */
export const STATUS_GAP_RATIO = 0.18

/** 画布边长的合法区间，上限对应桌面导出的 4096。 */
export const CANVAS_MIN = 64
export const CANVAS_MAX = 8192

export const DEFAULT_CONFIG: AvatarConfig = {
  v: 4,
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
  palette: 'clear-sky',
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
    // v4.0 起默认投影：比发光收敛，深浅背景都稳；强度 0.4 是白字与深字适配后的折中
    effect: 'shadow',
    effectStrength: 0.4,
    colorMode: 'custom',
    color: '#ffffff',
    lineSizeScales: [1, STATUS_SECOND_LINE_SCALE],
    lineOffsetsX: [0, 0],
    pill: { radius: 0.5, padding: 0.3, opacity: 0.55 },
  },
  layout: {
    graphic: 0.52,
    icon: { source: 'none', id: '' },
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
 *
 * 同时承担 v3 → v4 的迁移：三行以上的文字第三行起并入第二行；
 * `layout.kind`、对齐、锚点、全局偏移、竖排、自动换行开关这些退役字段读进来即忽略；
 * 旧状态徽章的 `layout.scale` 迁移到次行字号档。
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
  const icon = isRecord(lay.icon) ? lay.icon : {}

  // 换行解释收敛到两行：旧链接的三行以上在这里并档，
  // v4 载荷里被塞进多余换行也走同一条规则，渲染层不会见到第三行
  const [firstLine, secondLine] = twoLinesOf(str(src.text, d.text))
  const text = secondLine === '' ? firstLine : `${firstLine}\n${secondLine}`

  const lineSizeScales = normalizeNumberArray(
    tp.lineSizeScales,
    d.typography.lineSizeScales,
    1,
    0.2,
    2,
  )
  // v3.1 的状态徽章只有 layout.scale 一个自由度。v3.2 已把契约字段移除，
  // 旧链接缺行级数组时在这里迁移，不能把用户调好的比例打回默认。
  if (!Array.isArray(tp.lineSizeScales) && lay.kind === 'status') {
    lineSizeScales[1] = num(lay.scale, STATUS_SECOND_LINE_SCALE, 0.2, 0.8)
  }

  return {
    v: 4,
    text,
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
    layout: (() => {
      const source = pick(icon.source, ICON_SOURCES, d.layout.icon.source)
      const rawId = str(icon.id, d.layout.icon.id).trim()
      const id = source === 'none' || rawId.length > ICON_ID_MAX ? '' : rawId
      return {
        graphic: num(lay.graphic, d.layout.graphic, 0.3, 0.8),
        icon: { source, id },
      }
    })(),
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
