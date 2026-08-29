/**
 * 引擎对外出口。@paper-design/shaders 只从 shader-mount、shader-noise 与 shaders/*
 * 三处进来，全部走 import()，所以这个桶文件本身不会把 WebGL 代码拖进首屏。
 */

export { getRenderCaps, hasWebGL2, resetRenderCaps, revalidateWebGL2 } from './caps'
export type { RenderCaps } from './caps'

export { resolveColors, toShaderColor } from './colors'

export { cssFallbackBackground, fallbackLayers, rgba } from './css-fallback'
export type { FallbackLayer } from './css-fallback'

export { notifyFallback } from './fallback'
export type { FallbackOptions, FallbackReason } from './fallback'

export { applyFilmGrain } from './film-grain'
export { drawHighlight } from './highlight'
export { clamp, lerp, round } from './math'

export { createGradientMount } from './mount'
export type { GradientMount } from './mount'

export { ensureNoiseTexture, loadedNoiseTexture } from './noise-texture'
export { renderGradient } from './render'
export { loadFragmentShader } from './shader-source'

export {
  hashSeed,
  intFrom,
  mulberry32,
  pickFrom,
  randomSeed,
  rangeFrom,
  resolveSeed,
  seededRng,
} from './seed'
export type { Rng } from './seed'

export { STYLES, STYLE_LIST, getStyle, planRender } from './styles'
export type { StyleDefinition, StyleParamKey, StyleParamMeta, StyleRenderPlan } from './styles'
