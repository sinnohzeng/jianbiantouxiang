import { normalizeConfig, type AvatarConfig } from '@/state/config'
import { HISTORY_MAX } from '@/state/history'

/** 键名带版本，v4 换结构时旧数据自然失效，不用写迁移代码。 */
export const PERSIST_KEY = 'gradient-avatar:v3'

const PERSIST_VERSION = 3

export interface PersistedState {
  config: AvatarConfig
  history: AvatarConfig[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Safari 无痕模式下光是读 localStorage 就会抛，所以取存储对象本身也要包起来。 */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** 读整份存档。取不到、解析失败、版本对不上一律返回 null。 */
export function loadPersistedState(): PersistedState | null {
  const store = storage()
  if (!store) return null

  let raw: string | null
  try {
    raw = store.getItem(PERSIST_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.v !== PERSIST_VERSION || !isRecord(parsed.config)) return null

  const history = Array.isArray(parsed.history)
    ? parsed.history.filter(isRecord).slice(0, HISTORY_MAX).map(normalizeConfig)
    : []

  return { config: normalizeConfig(parsed.config), history }
}

export function loadPersisted(): AvatarConfig | null {
  return loadPersistedState()?.config ?? null
}

/** 省略 history 时保留已存的那份，避免只想存配置却把历史抹了。 */
export function savePersisted(config: AvatarConfig, history?: readonly AvatarConfig[]): void {
  const store = storage()
  if (!store) return

  const kept = history ?? loadPersistedState()?.history ?? []
  try {
    store.setItem(
      PERSIST_KEY,
      JSON.stringify({ v: PERSIST_VERSION, config, history: kept.slice(0, HISTORY_MAX) }),
    )
  } catch {
    // 配额写满或隐私模式，丢掉这次写入即可，界面不受影响
  }
}

export function clearPersisted(): void {
  try {
    storage()?.removeItem(PERSIST_KEY)
  } catch {
    // 同上
  }
}
