/**
 * 共享配置契约。预览、导出、存档与历史都读这一份类型，默认值、归一与哈希也都定义在这里。
 *
 * 文字最多两行：`text` 用一个换行分开第一行与第二行，第三行起并入第二行，见 `twoLinesOf`。
 * 版式是一个纵向栈：图标（可选）→ 第一行 → 第二行，水平居中、自动适配。
 *
 * 逐行参数收在 `typography.line1` 与 `typography.line2` 两组里，每组是字体、字号与两向补偿，
 * 其余排版参数两行共用。两组里的 `null` 是同一个意思：这个值不由用户定，由系统派生。
 * 第一行字号由求解器派生；第二行的字号与字体由第一行派生，第二行的生效字体一律经 `lineFont` 读。
 *
 * 契约不带版本号：存档结构一变就升 `src/state/persist.ts` 的 `PERSIST_KEY`，旧存档不读。
 */

import { clamp } from '@/engine/math'
import type { Locale } from '@/i18n'

export type StyleId = 'mesh' | 'flow' | 'silk' | 'grain'
export type Shape = 'square' | 'rounded' | 'circle'
export type TextEffect = 'plain' | 'outline' | 'shadow' | 'glow' | 'pill'
export type IconSource = 'none' | 'builtin' | 'emoji' | 'brand' | 'upload'

/** 字重九档。字体目录只收这九档，存档里的字重也取整到其中一档。 */
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export type FontWeight = (typeof FONT_WEIGHTS)[number]

export const FONT_SOURCES = ['google', 'system', 'upload'] as const
export type FontSource = (typeof FONT_SOURCES)[number]

/**
 * 一款字体的选择。只存 family：canvas、css2 与 document.fonts 认的都是 family，
 * fontsource id、可用字重与版本由 `findFontEntry` 按 family 查。
 * 上传字体的 family 带 `-upload` 后缀，那是它在 document.fonts 里的命名空间，与 `source` 各管一件事。
 */
export interface FontChoice {
  family: string
  source: FontSource
  weight: FontWeight
}

/** 第一行：字体、字号与两向补偿。 */
export interface Line1Style {
  font: FontChoice
  /** 画布短边比例 LINE_SIZE_MIN..LINE_SIZE_MAX；null 为自动，由求解器填满安全框。 */
  size: number | null
  /** 水平视觉补偿，画布宽比例 ±LINE_OFFSET_MAX，落位时只动这一行。 */
  offsetX: number
  /** 垂直视觉补偿，画布高比例 ±LINE_OFFSET_MAX，落位时只动这一行。 */
  offsetY: number
}

/** 第二行：与第一行同构，字体与字号为 null 时跟随第一行。 */
export interface Line2Style {
  /** null 跟随第一行，生效字体经 `lineFont` 读。 */
  font: FontChoice | null
  /** 画布短边比例 LINE2_SIZE_MIN..LINE_SIZE_MAX；null 跟随第一行，取其基准字号的 LINE2_FOLLOW_SCALE。 */
  size: number | null
  offsetX: number
  offsetY: number
}

export interface AvatarConfig {
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
    line1: Line1Style
    line2: Line2Style
    padding: number // 每边安全边距比例 0..0.3
    lineHeight: number // 0.85..2
    letterSpacing: number // em，-0.1..0.5
    effect: TextEffect
    effectStrength: number // 0..1
    color: string
    pill: { radius: number; padding: number; opacity: number }
  }
  layout: {
    /** logo：图形占安全框高度的比例。 */
    graphic: number // 0.3..0.8
    /** 图形的水平视觉补偿，按安全框宽度比例，正数往右。 */
    graphicOffsetX: number // -0.25..0.25
    /** 图形的垂直视觉补偿，按安全框高度比例，正数往下。 */
    graphicOffsetY: number // -0.25..0.25
    icon: {
      source: IconSource
      /** builtin 是 lucide 名，emoji 是去 FE0F 的码点串，brand 是品牌文件名，upload 是本次会话 id。 */
      id: string
      /**
       * 品牌标志的单色档。开着就把标志压成一块纯色剪影，颜色跟文字色走。
       * 只对 `source === 'brand'` 生效，别的来源留着这一位也不参与绘制。
       */
      mono: boolean
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
// 投影是默认档，排第一：默认值理应是列表里第一个，用户看到的顺序就是分量顺序
export const TEXT_EFFECTS: readonly TextEffect[] = ['shadow', 'plain', 'outline', 'glow', 'pill']
export const EXPORT_FORMATS = ['jpg', 'png', 'webp'] as const
export const SIZE_TARGETS = ['none', '1mb', '2mb'] as const
export const ICON_SOURCES = ['none', 'builtin', 'emoji', 'brand', 'upload'] as const

/** 图形标识最长 128 字符，防止坏数据把状态与存档无限撑大。 */
export const ICON_ID_MAX = 128

/** 字号的短边比例下限：第一行手动字号、求解器的二分区间与第一行滑杆共用。 */
export const LINE_SIZE_MIN = 0.04

/**
 * 第二行手动字号的下限。低于第一行下限乘跟随比例（0.04 × 0.62），
 * 把跟随值钉成手动值时不会被下限抬高。
 */
export const LINE2_SIZE_MIN = 0.02

/** 字号的短边比例上限，两行共用。 */
export const LINE_SIZE_MAX = 0.92

/** 逐行补偿的量程：水平按画布宽、垂直按画布高的比例，正负对称。 */
export const LINE_OFFSET_MAX = 0.25

/** 第二行跟随时取第一行基准字号的比例。 */
export const LINE2_FOLLOW_SCALE = 0.62

/** 两行之间的留白比例，按两行里较大的那个字号算。 */
export const LINE_GAP_RATIO = 0.18

/**
 * 字号滑杆的步进（画布短边比例）。自动档回写给滑杆的值也按它向下对齐：
 * 滑杆控件在触碰时会把值取整到步进，回写值不在网格上的话，轻触一下就会被取整到比求解上限更大的档，
 * 画面没动、「超出安全区」却先亮了。
 */
export const FONT_SIZE_STEP = 0.005

/** 向下对齐到字号步进网格，结果不大于输入，所以永远不越过求解器给的上限。 */
export function snapFontRatio(ratio: number): number {
  return Math.round(Math.floor(ratio / FONT_SIZE_STEP + 1e-9) * FONT_SIZE_STEP * 1000) / 1000
}

/** 画布边长的合法区间，上限对应桌面导出的 4096。 */
export const CANVAS_MIN = 64
export const CANVAS_MAX = 8192

export const DEFAULT_CONFIG: AvatarConfig = {
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
  canvas: { width: 2048, height: 2048, shape: 'square', radius: 0.2 },
  typography: {
    line1: {
      // 契约基线，也是 normalizeConfig 的兜底值。首次进入实际用哪套字体按界面语言定，见 LOCALE_DEFAULT_FONT
      font: { family: 'Noto Sans SC', source: 'google', weight: 700 },
      size: null,
      offsetX: 0,
      offsetY: 0,
    },
    line2: { font: null, size: null, offsetX: 0, offsetY: 0 },
    padding: 0.15,
    lineHeight: 1.03,
    letterSpacing: 0,
    // 默认投影：比发光收敛，深浅背景都稳；强度 0.4 是白字与深字适配后的折中
    effect: 'shadow',
    effectStrength: 0.4,
    color: '#ffffff',
    pill: { radius: 0.5, padding: 0.3, opacity: 0.55 },
  },
  layout: {
    graphic: 0.52,
    graphicOffsetX: 0,
    graphicOffsetY: 0,
    icon: { source: 'none', id: '', mono: false },
  },
  exportOptions: {
    format: 'jpg',
    sizeTarget: '2mb',
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
 * 本机存档是用户自己的配置，一个字段都不能按语言改，见 store 的 readInitialConfig。
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

/** 递归的可选版本，用于接收 localStorage 与面板的局部更新。 */
export type PartialConfig = DeepPartial<AvatarConfig>

/** 排版段的局部更新，`setTypography` 收它，下面几个写字体的函数也返回它。 */
export type TypographyPatch = NonNullable<PartialConfig['typography']>

type Typography = AvatarConfig['typography']

const LINE_BREAK_RE = /\r\n|\r|\n/

/**
 * 两行模型对显式换行的唯一解释：最多两行，第三行起并入第二行，每行两端空白去掉。
 *
 * 前导空行保留：第一行为空、第二行有内容是合法槽位（图标加说明文字就是这么存的），
 * 空槽位留住，逐行参数才能跟着内容走，求解层的晋升分支才够得着。
 * 归一、排版求解、字体加载与界面共用这一条，口径不会分叉。
 */
export function twoLinesOf(text: string): [string, string] {
  if (typeof text !== 'string' || text === '') return ['', '']
  const lines = text.split(LINE_BREAK_RE).map((line) => line.trim())
  const first = lines[0] ?? ''
  if (lines.length <= 1) return [first, '']
  return [first, lines.slice(1).join('')]
}

/** 取字体真实提供的字重里离目标最近的一档，等距时偏大；表为空时原样返回目标。 */
export function nearestWeight(available: readonly FontWeight[], want: FontWeight): FontWeight {
  let best = available[0]
  if (best === undefined) return want
  for (const w of available) {
    const d = Math.abs(w - want)
    const bd = Math.abs(best - want)
    if (d < bd || (d === bd && w > best)) best = w
  }
  return best
}

/** 某一行的生效字体：第二行为 null 时就是第一行那款。 */
export function lineFont(t: Typography, line: 1 | 2): FontChoice {
  return line === 2 ? (t.line2.font ?? t.line1.font) : t.line1.font
}

/** 同一款字体的身份键：加载器的缓存与去重、画布字体 effect 的依赖键共用它。 */
export function fontKey(font: FontChoice): string {
  return `${font.source}|${font.family}|${font.weight}`
}

function sameFont(a: FontChoice, b: FontChoice): boolean {
  return a.family === b.family && a.source === b.source && a.weight === b.weight
}

/**
 * 写第二行字体。与第一行那款的 family、来源、字重全相同时写 null，回到跟随：
 * 跟随态下点中打勾的那一项、把字重改回第一行那档，都不会造出画面没变、哈希却变了的钉住。
 */
export function withLine2Font(t: Typography, next: FontChoice): TypographyPatch {
  return { line2: { font: sameFont(next, t.line1.font) ? null : next } }
}

/**
 * 写第一行字体，`weights` 是新字体真实提供的字重。
 *
 * 第二行跟随时本来就读第一行，不必写。第二行钉住、且与旧的第一行同 family 同来源时，
 * 说明它只改过字重：这时随第一行换成新 family，字重取 `weights` 里离原字重最近的一档。
 * 第二行钉在别的字体上时不动。
 */
export function withLine1Font(
  t: Typography,
  next: FontChoice,
  weights: readonly FontWeight[],
): TypographyPatch {
  const pinned = t.line2.font
  const previous = t.line1.font
  if (pinned === null || pinned.family !== previous.family || pinned.source !== previous.source) {
    return { line1: { font: next } }
  }
  return {
    line1: { font: next },
    line2: { font: { ...next, weight: nearestWeight(weights, pinned.weight) } },
  }
}

/** “跟随”钮写它：第二行字体回到跟随第一行。 */
export const FOLLOW_LINE1: TypographyPatch = { line2: { font: null } }

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

/** 字重四舍五入到整百再夹进九档，缺省 400。 */
function normalizeWeight(value: unknown): FontWeight {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 400
  return FONT_WEIGHTS[clamp(Math.round(value / 100), 1, FONT_WEIGHTS.length) - 1] ?? 400
}

/**
 * 字体整份成立或整份作废：family 去掉首尾空白后非空、来源在三种之内才成立，否则返回 null。
 * 字段级回落会拼出不存在的组合，例如把来源坏掉的上传件读成一款 Google 字体，加载器白等三档超时。
 */
function normalizeFont(value: unknown): FontChoice | null {
  if (!isRecord(value) || typeof value.family !== 'string') return null
  const family = value.family.trim()
  const source = FONT_SOURCES.find((item) => item === value.source)
  if (family === '' || source === undefined) return null
  return { family, source, weight: normalizeWeight(value.weight) }
}

/** 字号：有限数夹进 min..LINE_SIZE_MAX，其余一律 null，交给系统派生。 */
function lineSize(value: unknown, min: number): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, LINE_SIZE_MAX)
    : null
}

function lineOffset(value: unknown): number {
  return num(value, 0, -LINE_OFFSET_MAX, LINE_OFFSET_MAX)
}

/**
 * 把任意局部输入补成完整配置：缺字段补默认，数值按注释里的区间夹值，
 * 枚举与数组做合法性校验。任何输入都不会抛错。
 *
 * 三行以上的文字按 `twoLinesOf` 并成两行，渲染层不会见到第三行。
 * 不在契约里的字段读进来即忽略。第一行字体作废回默认字体，第二行字体作废即跟随。
 */
export function normalizeConfig(partial: unknown): AvatarConfig {
  const d = DEFAULT_CONFIG
  const src = isRecord(partial) ? partial : {}

  const sp = isRecord(src.styleParams) ? src.styleParams : {}
  const cv = isRecord(src.canvas) ? src.canvas : {}
  const tp = isRecord(src.typography) ? src.typography : {}
  const l1 = isRecord(tp.line1) ? tp.line1 : {}
  const l2 = isRecord(tp.line2) ? tp.line2 : {}
  const pill = isRecord(tp.pill) ? tp.pill : {}
  const ex = isRecord(src.exportOptions) ? src.exportOptions : {}
  const lay = isRecord(src.layout) ? src.layout : {}
  const icon = isRecord(lay.icon) ? lay.icon : {}

  const [firstLine, secondLine] = twoLinesOf(str(src.text, d.text))
  const text = secondLine === '' ? firstLine : `${firstLine}\n${secondLine}`

  return {
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
      line1: {
        font: normalizeFont(l1.font) ?? { ...d.typography.line1.font },
        size: lineSize(l1.size, LINE_SIZE_MIN),
        offsetX: lineOffset(l1.offsetX),
        offsetY: lineOffset(l1.offsetY),
      },
      line2: {
        font: normalizeFont(l2.font),
        size: lineSize(l2.size, LINE2_SIZE_MIN),
        offsetX: lineOffset(l2.offsetX),
        offsetY: lineOffset(l2.offsetY),
      },
      padding: num(tp.padding, d.typography.padding, 0, 0.3),
      lineHeight: num(tp.lineHeight, d.typography.lineHeight, 0.85, 2),
      letterSpacing: num(tp.letterSpacing, d.typography.letterSpacing, -0.1, 0.5),
      effect: pick(tp.effect, TEXT_EFFECTS, d.typography.effect),
      effectStrength: num(tp.effectStrength, d.typography.effectStrength, 0, 1),
      color: normalizeHex(tp.color, d.typography.color),
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
        graphicOffsetX: num(lay.graphicOffsetX, d.layout.graphicOffsetX, -0.25, 0.25),
        graphicOffsetY: num(lay.graphicOffsetY, d.layout.graphicOffsetY, -0.25, 0.25),
        // 单色档只认布尔真
        icon: { source, id, mono: icon.mono === true },
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
