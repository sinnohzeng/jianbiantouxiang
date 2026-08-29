/**
 * 四种质感到 @paper-design/shaders 的参数映射。
 *
 * 这里是引擎唯一知道 shader uniform 名字的地方：面板只认 styleParams 的五个滑杆，
 * 渲染层只认 StyleRenderPlan，换 shader 或改区间都只动本文件。
 */

import type { ShaderMountUniforms } from '@paper-design/shaders'
import { averageLightness } from '@/palettes/color'
import type { AvatarConfig, StyleId } from '@/state/config'
import { toShaderColor } from './colors'
import { clamp, lerp, round } from './math'
import { intFrom, pickFrom, rangeFrom, seededRng } from './seed'
import type { Rng } from './seed'
import { loadFragmentShader } from './shader-source'

/**
 * 下面四组常量抄自 @paper-design/shaders 0.0.80，不从包里 import 是有意为之：
 * meta 与 shader 源码同在一个模块，静态引用 meta 就会把那段 GLSL 拖进首屏 chunk。
 * 升级包版本时对照 dist/shaders/*.js 与 dist/shader-sizing.js 复核这四组值。
 */

/** ShaderFitOptions.cover。包内是 none 0、contain 1、cover 2。 */
const FIT_COVER = 2

/** 各 shader 的 maxColorCount。 */
const MAX_COLORS = { mesh: 10, flow: 10, silk: 10, grain: 7 } as const

/** WarpPatterns。 */
const WARP_PATTERNS = { checks: 0, stripes: 1, edge: 2 } as const

/** GrainGradientShapes。 */
const GRAIN_SHAPES = {
  wave: 1,
  dots: 2,
  truchet: 3,
  corners: 4,
  ripple: 5,
  blob: 6,
  sphere: 7,
} as const

export type StyleParamKey = 'intensity' | 'softness' | 'grain' | 'scale' | 'rotation'

export interface StyleParamMeta {
  key: StyleParamKey
  /** i18n key，界面据此取该 style 下的滑杆名，同一参数在不同 style 下叫法不同。 */
  labelKey: string
  min: number
  max: number
  step: number
}

export interface StyleDefinition {
  id: StyleId
  nameKey: string
  /** shader 源码按 style 动态加载，四段 GLSL 都不在首屏 chunk 里。 */
  loadFragmentShader(): Promise<string>
  /** shader 能吃下的最大色数，超出部分丢弃。 */
  maxColors: number
  /** 该 shader 需要包内自带的噪声贴图，挂载前必须先把图片解码完。 */
  needsNoiseTexture: boolean
  /** shader 自身有颗粒 uniform；没有的那个（silk）由 2D 合成阶段补。 */
  hasShaderGrain: boolean
  params: readonly StyleParamMeta[]
  buildUniforms(config: AvatarConfig, rng: Rng, colors: readonly string[]): ShaderMountUniforms
  /** speed 为 0 时 frame 完全决定静态画面，动画类 shader 靠它把种子变成构图。 */
  buildFrame(config: AvatarConfig, rng: Rng): number
}

export interface StyleRenderPlan {
  style: StyleId
  /** 调用方在真要建 ShaderMount 时才 await，纯算 uniforms 的路径不必等网络。 */
  loadFragmentShader(): Promise<string>
  uniforms: ShaderMountUniforms
  frame: number
  needsNoiseTexture: boolean
  hasShaderGrain: boolean
}

/** 色板缺失时的兜底，只保证渲染不崩，不参与产品配色。 */
const FALLBACK_COLORS = ['#c7d2fe', '#fbcfe8', '#a5f3fc'] as const

/**
 * grain 的 7 种形状只取 3 种：dots 与 truchet 是图案不是渐变；blob 的色团常落在画面外，
 * 实测出一整张平色；sphere 是硬边圆球，跟头像的柔光取向冲突。
 *
 * zoom 是各形状自带的缩放倍率，乘在用户的 scale 上。grainGradient 的图案尺度是按大画面调的，
 * 头像这种几百像素的方图里一个色带就铺满整张，于是只剩 colors[0] 一片平色。
 * 320px 实测（见 docs/engineering-lessons.md）：wave 与 corners 要压到 0.45、ripple 要压到 0.30，
 * 五个停靠色才都进得来；三种形状的图案尺度差一倍以上，共用一个倍率必然有一种塌掉。
 */
const GRAIN_SHAPE_POOL = [
  { shape: 'wave', zoom: 0.45 },
  { shape: 'ripple', zoom: 0.3 },
  { shape: 'corners', zoom: 0.45 },
] as const

/** silk 的底纹以 stripes 为主，它才出绸缎折痕；edge 只有一条分界，压成平淡的线性渐变，不收。 */
const WARP_SHAPE_POOL = ['stripes', 'stripes', 'stripes', 'checks'] as const

/**
 * silk 在浅配色上会揉成锡纸：折痕两侧的色差本来就小，swirl 一叠就把最浅的停靠色推到纯白，
 * 剩下的全是硬脊线。压制按配色的 OKLCH 平均明度线性给量，0.75 以下不动，0.90 以上给满。
 * 这两个数是照配色表卡的：出问题的 cloud-white 0.869、graphite-mist 0.858、peach 0.908、
 * mint 0.904、champagne 0.801、blush 0.836 都落在带内，出彩的 sunset 0.717、neon-tide 0.486、
 * aurora-violet 0.580 在带外，折痕原样保留。
 */
const SILK_LIGHT_FLOOR = 0.75
const SILK_LIGHT_CEIL = 0.9

/** 明度压制系数：0 表示不压，1 表示压到底。 */
function silkLightPressure(colors: readonly string[]): number {
  const lightness = averageLightness(colors)
  return clamp((lightness - SILK_LIGHT_FLOOR) / (SILK_LIGHT_CEIL - SILK_LIGHT_FLOOR), 0, 1)
}

/** 动画类 shader 的静态取帧范围，单位毫秒。 */
const FRAME_SPAN = 20000

function paramMeta(key: StyleParamKey, labelKey: string): StyleParamMeta {
  if (key === 'scale') return { key, labelKey, min: 0.5, max: 2, step: 0.01 }
  if (key === 'rotation') return { key, labelKey, min: 0, max: 360, step: 1 }
  return { key, labelKey, min: 0, max: 1, step: 0.01 }
}

function toShaderColors(
  colors: readonly string[],
  maxColors: number,
): [number, number, number, number][] {
  const source = colors.length > 0 ? colors : FALLBACK_COLORS
  return source.slice(0, maxColors).map((color) => toShaderColor(color))
}

/**
 * 四个 shader 共用的尺寸 uniform。worldWidth / worldHeight 传 0 表示以画布本身为世界，
 * fit 用 cover：头像是正方形居多，contain 会在长宽比不同时留出空边。
 */
function sizingUniforms(config: AvatarConfig, rng: Rng): ShaderMountUniforms {
  return {
    u_fit: FIT_COVER,
    u_scale: round(clamp(config.styleParams.scale, 0.01, 4)),
    u_rotation: round(clamp(config.styleParams.rotation, 0, 360)),
    u_originX: 0.5,
    u_originY: 0.5,
    u_offsetX: round(rangeFrom(rng, -0.25, 0.25)),
    u_offsetY: round(rangeFrom(rng, -0.25, 0.25)),
    u_worldWidth: 0,
    u_worldHeight: 0,
  }
}

function grainUniforms(grain: number): ShaderMountUniforms {
  return {
    // 边缘扰动比后处理噪点更耐看，所以 mixer 给的量比 overlay 大
    u_grainMixer: round(lerp(0, 0.55, grain)),
    u_grainOverlay: round(lerp(0, 0.3, grain)),
  }
}

const meshStyle: StyleDefinition = {
  id: 'mesh',
  nameKey: 'style.mesh.name',
  loadFragmentShader: () => loadFragmentShader('mesh'),
  maxColors: MAX_COLORS.mesh,
  needsNoiseTexture: false,
  hasShaderGrain: true,
  params: [
    paramMeta('intensity', 'style.mesh.intensity'),
    paramMeta('softness', 'style.mesh.softness'),
    paramMeta('grain', 'style.param.grain'),
    paramMeta('scale', 'style.param.scale'),
    paramMeta('rotation', 'style.param.rotation'),
  ],
  buildUniforms(config, rng, colors) {
    const { intensity, softness, grain } = config.styleParams
    const sizing = sizingUniforms(config, rng)
    // waveX/waveY 的合法区间就是 0..1，滑杆铺满它才有得调；0.7 封顶时半程之后几乎看不出变化
    const wave = lerp(0.05, 1, intensity)
    const shaderColors = toShaderColors(colors, MAX_COLORS.mesh)
    return {
      ...sizing,
      u_colors: shaderColors,
      u_colorsCount: shaderColors.length,
      u_positions: round(rangeFrom(rng, 0, 100)),
      u_waveX: round(clamp(wave * rangeFrom(rng, 0.75, 1.15), 0.02, 1)),
      u_waveY: round(clamp(wave * rangeFrom(rng, 0.75, 1.15), 0.02, 1)),
      u_waveXShift: round(rng()),
      u_waveYShift: round(rng()),
      // 0.15 是可辨的硬边界，再低会出锯齿状色阶；0.95 已经是完全糊开，留 0.05 余量给抗锯齿
      u_mixing: round(lerp(0.15, 0.95, softness)),
      ...grainUniforms(grain),
    }
  },
  buildFrame() {
    return 0
  },
}

const flowStyle: StyleDefinition = {
  id: 'flow',
  nameKey: 'style.flow.name',
  loadFragmentShader: () => loadFragmentShader('flow'),
  maxColors: MAX_COLORS.flow,
  needsNoiseTexture: false,
  hasShaderGrain: true,
  params: [
    paramMeta('intensity', 'style.flow.intensity'),
    paramMeta('softness', 'style.flow.softness'),
    paramMeta('grain', 'style.param.grain'),
    paramMeta('scale', 'style.param.scale'),
    paramMeta('rotation', 'style.param.rotation'),
  ],
  buildUniforms(config, rng, colors) {
    const { intensity, softness, grain } = config.styleParams
    const sizing = sizingUniforms(config, rng)
    const shaderColors = toShaderColors(colors, MAX_COLORS.flow)
    return {
      ...sizing,
      u_colors: shaderColors,
      u_colorsCount: shaderColors.length,
      u_distortion: round(lerp(0.1, 1, intensity)),
      // 契约里 softness 对 flow 的语义是 1 - swirl
      u_swirl: round(lerp(0.95, 0.1, softness)),
      ...grainUniforms(grain),
    }
  },
  buildFrame(_config, rng) {
    return round(rangeFrom(rng, 0, FRAME_SPAN), 2)
  },
}

const silkStyle: StyleDefinition = {
  id: 'silk',
  nameKey: 'style.silk.name',
  loadFragmentShader: () => loadFragmentShader('silk'),
  maxColors: MAX_COLORS.silk,
  needsNoiseTexture: true,
  hasShaderGrain: false,
  params: [
    paramMeta('intensity', 'style.silk.intensity'),
    paramMeta('softness', 'style.silk.softness'),
    paramMeta('grain', 'style.param.grain'),
    paramMeta('scale', 'style.param.scale'),
    paramMeta('rotation', 'style.param.rotation'),
  ],
  buildUniforms(config, rng, colors) {
    const { intensity, softness } = config.styleParams
    const sizing = sizingUniforms(config, rng)
    const shaderColors = toShaderColors(colors, MAX_COLORS.silk)
    const pressure = silkLightPressure(colors)
    // 压得越狠，折痕越少、过渡越糊
    const damp = lerp(1, 0.4, pressure)
    const softFloor = lerp(0.5, 0.9, pressure)
    return {
      ...sizing,
      u_colors: shaderColors,
      u_colorsCount: shaderColors.length,
      u_proportion: round(rangeFrom(rng, 0.4, 0.6)),
      u_softness: round(lerp(softFloor, 1, softness)),
      u_shape: WARP_PATTERNS[pickFrom(rng, WARP_SHAPE_POOL)],
      // 底纹越密越像布纹噪点，头像要的是大褶皱，所以只取小值；上限从 0.38 收到 0.28 才不出细密脊线
      u_shapeScale: round(rangeFrom(rng, 0.1, 0.28)),
      // 折痕强度参照柔和渐变而不是大理石纹，浅配色靠 damp 单独往回收
      u_distortion: round(lerp(0.05, 0.5, intensity) * damp),
      u_swirl: round(clamp(lerp(0.1, 0.75, intensity) * rangeFrom(rng, 0.85, 1.15) * damp, 0, 1)),
      // 迭代次数是锡纸的主因：每多一层就多一道脊线，浅配色最多给到 4 层
      u_swirlIterations: intFrom(rng, 3, 7 - Math.round(3 * pressure)),
    }
  },
  buildFrame(_config, rng) {
    return round(rangeFrom(rng, 0, FRAME_SPAN), 2)
  },
}

const grainStyle: StyleDefinition = {
  id: 'grain',
  nameKey: 'style.grain.name',
  loadFragmentShader: () => loadFragmentShader('grain'),
  maxColors: MAX_COLORS.grain,
  needsNoiseTexture: true,
  hasShaderGrain: true,
  params: [
    paramMeta('intensity', 'style.grain.intensity'),
    paramMeta('softness', 'style.grain.softness'),
    paramMeta('grain', 'style.param.grain'),
    paramMeta('scale', 'style.param.scale'),
    paramMeta('rotation', 'style.param.rotation'),
  ],
  buildUniforms(config, rng, colors) {
    const { intensity, softness, grain } = config.styleParams
    const sizing = sizingUniforms(config, rng)
    const shaderColors = toShaderColors(colors, MAX_COLORS.grain)
    const back = shaderColors[0] ?? toShaderColor(FALLBACK_COLORS[0])
    const picked = pickFrom(rng, GRAIN_SHAPE_POOL)
    const scale = clamp(config.styleParams.scale, 0.01, 4) * picked.zoom
    return {
      ...sizing,
      u_scale: round(clamp(scale, 0.01, 4)),
      u_colorBack: back,
      u_colors: shaderColors,
      u_colorsCount: shaderColors.length,
      // 0.1 是几乎硬边的色阶，0.9 已经完全糊开：这一段实测把可见色数从 7 个拉到 25 个
      u_softness: round(lerp(0.1, 0.9, softness)),
      // intensity 在这个 shader 里是把色带边界推歪的噪声量，不是色带行程：
      // 0.03 是干净的同心色带，0.85 已经把边界揉成絮状，再往上 fwidth 会抬起来把平滑参数一起吃掉
      u_intensity: round(lerp(0.03, 0.85, intensity)),
      // u_noise 直接加在 shape 上，量大了会把整片推到最亮的停靠色，0.3 是不翻白的上限
      u_noise: round(lerp(0.02, 0.3, grain)),
      u_shape: GRAIN_SHAPES[picked.shape],
    }
  },
  buildFrame(_config, rng) {
    return round(rangeFrom(rng, 0, FRAME_SPAN), 2)
  },
}

export const STYLES: Record<StyleId, StyleDefinition> = {
  mesh: meshStyle,
  flow: flowStyle,
  silk: silkStyle,
  grain: grainStyle,
}

export const STYLE_LIST: readonly StyleDefinition[] = [meshStyle, flowStyle, silkStyle, grainStyle]

export function getStyle(id: StyleId): StyleDefinition {
  return STYLES[id]
}

/**
 * 把一份配置加一组颜色变成挂载所需的全部输入。
 * uniforms 与 frame 走同一条随机数列，取数顺序固定，因此同一 config 结果一致。
 */
export function planRender(config: AvatarConfig, colors: readonly string[]): StyleRenderPlan {
  const style = getStyle(config.style)
  const rng = seededRng(config, `style:${style.id}`)
  const uniforms = style.buildUniforms(config, rng, colors)
  const frame = style.buildFrame(config, rng)
  return {
    style: style.id,
    loadFragmentShader: style.loadFragmentShader,
    uniforms,
    frame,
    needsNoiseTexture: style.needsNoiseTexture,
    hasShaderGrain: style.hasShaderGrain,
  }
}
