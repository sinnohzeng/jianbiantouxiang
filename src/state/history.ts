import { configHash, type AvatarConfig } from '@/state/config'

/** “最近生成”条最多留 8 条，够回溯又不至于在手机上撑满一屏。 */
export const HISTORY_MAX = 8

export interface HistoryEntry {
  config: AvatarConfig
  /** 96 px JPEG data URL。旧存档没有时历史条回落到 CSS 近似缩略图。 */
  thumb?: string
}

/**
 * 把一份配置放到历史表首位。相同配置只保留一条：用户反复点回同一状态时，
 * 历史表不该被同一张图挤满。
 */
export function pushHistory(
  list: readonly HistoryEntry[],
  config: AvatarConfig,
  max: number = HISTORY_MAX,
): HistoryEntry[] {
  if (max <= 0) return []
  const hash = configHash(config)
  const rest = list.filter((item) => configHash(item.config) !== hash)
  return [{ config }, ...rest].slice(0, max)
}

/** 按配置哈希补缩略图，避免异步渲染期间历史表移动导致贴错条目。 */
export function attachHistoryThumb(
  list: readonly HistoryEntry[],
  hash: string,
  thumb: string,
): HistoryEntry[] {
  return list.map((entry) =>
    configHash(entry.config) === hash ? { ...entry, thumb } : entry,
  )
}
