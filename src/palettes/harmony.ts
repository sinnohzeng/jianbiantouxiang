import { clampChroma, fixupHueShorter, formatHex, oklab, oklch, wcagContrast } from './culori'
import { TEXT_DARK, TEXT_LIGHT } from './color'
import type { PaletteTone } from './palettes'

export type HarmonyScheme = 'analogous' | 'split' | 'duo'

export interface HarmonyOptions {
  /** 第二个种子色，给了就沿短弧在两个色相之间取五档，scheme 不再起作用。 */
  seed2?: string
  tone?: PaletteTone
  scheme?: HarmonyScheme
}

export interface HarmonyResult {
  /** 6 个停靠点：5 档明度阶梯加 1 个光感点。 */
  colors: string[]
  bg: string
  text: string
  /** 文字对色值均值的 WCAG 低于 4.5，UI 应默认开启胶囊底。 */
  plate: boolean
}

/** 明度阶梯与 chroma 系数都是定值，不随种子变，保证同一种子色永远得到同一套。 */
const LIGHT_L = [0.68, 0.76, 0.83, 0.89, 0.94]
const DARK_L = [0.34, 0.42, 0.5, 0.58, 0.66]
/** 浅色高明度端 sRGB 色域变窄，系数随明度递减；深色相反，中段留最多 chroma。 */
const LIGHT_C = [1, 0.9, 0.75, 0.55, 0.35]
const DARK_C = [0.7, 0.85, 1, 1, 0.9]
const ANALOGOUS = [-40, -20, 0, 20, 40]
const SPLIT = [0, 20, 150, 180, 210]
const STEPS = [0, 0.25, 0.5, 0.75, 1]
/** chroma 低于此值的种子按中性方案处理，五档同色相。 */
const NEUTRAL_CHROMA = 0.03
const WCAG_MIN = 4.5

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

function stop(l: number, c: number, h: number): string {
  return formatHex(clampChroma({ mode: 'oklch', l, c, h: ((h % 360) + 360) % 360 }, 'oklch'))
}

function at(list: readonly number[], i: number): number {
  return list[i] ?? 0
}

/** oklab 分量取平均再压回 sRGB，代表整套配色在文字底下的平均观感。 */
function meanColor(colors: readonly string[]): string {
  const parsed = colors.map((color) => oklab(color)).filter((color) => color !== undefined)
  if (parsed.length === 0) return '#808080'
  let l = 0
  let a = 0
  let b = 0
  for (const color of parsed) {
    l += color.l / parsed.length
    a += color.a / parsed.length
    b += color.b / parsed.length
  }
  return formatHex(clampChroma({ mode: 'oklab', l, a, b }, 'oklch'))
}

/**
 * 从 1 到 2 个种子色生成整套配色，实现调研附录 B 的九步。
 * 与附录里三组实测样例逐色一致，改动前先跑 tests/palettes/harmony.test.ts。
 */
export function harmonize(seed: string, opts: HarmonyOptions = {}): HarmonyResult {
  const base = oklch(seed) ?? { mode: 'oklch' as const, l: 0.6, c: 0, h: 0 }
  const c0 = base.c
  const h0 = base.h ?? 0
  const tone = opts.tone ?? 'light'
  const light = tone === 'light'
  const second = opts.seed2 === undefined ? undefined : oklch(opts.seed2)

  let hues: number[]
  if (second) {
    const arc = fixupHueShorter([h0, second.h ?? h0])
    const from = at(arc, 0)
    const to = at(arc, 1)
    hues = STEPS.map((t) => from + (to - from) * t)
  } else if (c0 < NEUTRAL_CHROMA || opts.scheme === 'duo') {
    hues = STEPS.map(() => h0)
  } else if (opts.scheme === 'split') {
    hues = SPLIT.map((delta) => h0 + delta)
  } else {
    hues = ANALOGOUS.map((delta) => h0 + delta)
  }

  const ladder = light ? LIGHT_L : DARK_L
  const factors = light ? LIGHT_C : DARK_C
  const cBase = clamp(c0, 0.04, light ? 0.14 : 0.18)
  const colors = ladder.map((l, i) => stop(l, cBase * at(factors, i), at(hues, i)))
  const midHue = at(hues, 2)
  colors.push(light ? stop(0.975, 0.015, midHue) : stop(0.72, 0.6 * cBase, midHue))

  const bg = light
    ? stop(0.955, Math.min(0.25 * c0, 0.03), second ? midHue : h0)
    : stop(0.17, Math.min(0.5 * c0, 0.06), second ? midHue : h0)

  // 文字色按“对最差停靠点的对比度”选边，背景基底也算进去。
  const surfaces = [...colors, bg]
  const worst = (candidate: string): number =>
    Math.min(...surfaces.map((surface) => wcagContrast(candidate, surface)))
  const text = worst(TEXT_LIGHT) >= worst(TEXT_DARK) ? TEXT_LIGHT : TEXT_DARK

  return { colors, bg, text, plate: wcagContrast(text, meanColor(colors)) < WCAG_MIN }
}
