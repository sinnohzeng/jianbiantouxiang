import { drawHighlight } from '@/engine/highlight'
import { renderGradient } from '@/engine/render'
import { loadFontForConfig } from '@/fonts/loader'
import { drawGraphic } from '@/graphics/draw'
import { loadGraphic } from '@/graphics/source'
import type { AvatarConfig } from '@/state/config'
import { resolveInk } from '@/text/auto-color'
import { drawText } from '@/text/draw'
import { layoutText, type TextLayout } from '@/text/layout'
import { composeWith, type ComposeDeps } from './compose-core'

/**
 * 引擎、文字、字体与图形四个模块的装配点。合成逻辑在 compose-core，
 * 这里只负责把真实实现接上，单测因此不用碰 WebGL 与字体网络。
 */
const deps: ComposeDeps<TextLayout> = {
  loadFontForConfig,
  loadGraphicForConfig: (config) => loadGraphic(config.layout.icon),
  renderGradient,
  drawHighlight,
  layoutText: (config, width, height, graphic) => layoutText(config, width, height, undefined, graphic),
  resolveInk,
  drawText,
  drawGraphic,
}

/** 合成一张 width×height 的头像画布，调用方负责释放（releaseCanvas）。 */
export function composeAvatar(
  config: AvatarConfig,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  return composeWith(config, width, height, deps)
}
