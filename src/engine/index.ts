/**
 * 引擎对外出口。mount 与 render 会带进 @paper-design/shaders，
 * 需要代码分割的调用方直接从具体模块导入，别走这个桶文件。
 */

export { getRenderCaps, hasWebGL2, resetRenderCaps } from './caps'
export type { RenderCaps } from './caps'

export { resolveColors } from './colors'

export { cssFallbackBackground, fallbackLayers, rgba } from './css-fallback'
export type { FallbackLayer } from './css-fallback'

export { applyFilmGrain } from './film-grain'
export { drawHighlight } from './highlight'
export { clamp, lerp, round } from './math'

export { createGradientMount } from './mount'
export type { GradientMount } from './mount'

export { ensureNoiseTexture, loadedNoiseTexture } from './noise-texture'
export { renderGradient } from './render'

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
