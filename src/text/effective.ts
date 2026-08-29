/**
 * 自动文字色判定要加底板时的实际绘制配置。
 *
 * 用户的 config 不动：底板是引擎替他兜的底，不是他选的样式，
 * 写回 config 会连带进 URL 与存档，下次打开就分不清是谁改的。
 * 预览与导出都走这个函数，两边看到的图才一致。
 */

import type { AvatarConfig } from '@/state/config'

export function effectiveConfig(config: AvatarConfig, plate: boolean): AvatarConfig {
  if (!plate) return config
  // 只在自动取色下代劳。plain 与 glow 都不给文字垫底，对比度不够时补一层胶囊底；
  // glow 是默认效果，不能因为「用户选了效果」就把这层兜底撤掉。
  // outline 与 shadow 是用户主动挑的，不插手；pill 本身就是底板。
  if (config.typography.colorMode !== 'auto') return config
  if (config.typography.effect !== 'plain' && config.typography.effect !== 'glow') return config
  return { ...config, typography: { ...config.typography, effect: 'pill' } }
}
