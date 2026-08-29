/**
 * 按 style 取 fragment shader 源码。四段 GLSL 各自成 chunk，
 * 用户切到哪种质感才拉哪一段，首屏一段都不带。
 */

import type { StyleId } from '@/state/config'

const LOADERS: Record<StyleId, () => Promise<{ fragmentShader: string }>> = {
  mesh: () => import('./shaders/mesh'),
  flow: () => import('./shaders/flow'),
  silk: () => import('./shaders/silk'),
  grain: () => import('./shaders/grain'),
}

/** 同一 style 重复调只走一次网络，之后命中模块缓存。 */
export function loadFragmentShader(style: StyleId): Promise<string> {
  return LOADERS[style]().then((module) => module.fragmentShader)
}
