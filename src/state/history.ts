import { configHash, type AvatarConfig } from '@/state/config'

/** “最近生成”条最多留 8 条，够回溯又不至于在手机上撑满一屏。 */
export const HISTORY_MAX = 8

/**
 * 把一份配置放到历史表首位。相同配置只保留一条：用户反复点回同一状态时，
 * 历史表不该被同一张图挤满。
 */
export function pushHistory(
  list: readonly AvatarConfig[],
  config: AvatarConfig,
  max: number = HISTORY_MAX,
): AvatarConfig[] {
  if (max <= 0) return []
  const hash = configHash(config)
  const rest = list.filter((item) => configHash(item) !== hash)
  return [config, ...rest].slice(0, max)
}
