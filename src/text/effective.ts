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
  // 只在“自动取色 + 纯色文字”这一种组合下代劳，用户自己选了效果就不插手
  if (config.typography.colorMode !== 'auto') return config
  if (config.typography.effect !== 'plain') return config
  return { ...config, typography: { ...config.typography, effect: 'pill' } }
}
