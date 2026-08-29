import type { StyleId } from './config'
import { create } from 'zustand'
import { PALETTES } from '@/palettes/palettes'
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  type AvatarConfig,
  type PartialConfig,
} from '@/state/config'
import { HISTORY_MAX, pushHistory as pushHistoryEntry } from '@/state/history'
import { loadPersisted, loadPersistedState, savePersisted } from '@/state/persist'
import { decodeConfigFromHash, encodeConfigToHash } from '@/state/url'

export type ActivePanel = 'text' | 'palette' | 'style' | 'canvas'
export type FontStatus = 'idle' | 'loading' | 'ready' | 'fallback'

export interface UiState {
  activePanel: ActivePanel
  exportOpen: boolean
  /**
   * 导出抽屉打开过没有。抽屉是懒加载的，挂上就等于拉 chunk，
   * 所以首次打开前不挂；打开过之后一直留在树里，关闭动画与上一次的导出结果才不会丢。
   * 只由 setUi 从 exportOpen 派生，外部不必自己维护。
   */
  exportMounted: boolean
  fontStatus: FontStatus
}

export const DEFAULT_UI: UiState = {
  activePanel: 'text',
  exportOpen: false,
  exportMounted: false,
  fontStatus: 'idle',
}

type TypographyPatch = NonNullable<PartialConfig['typography']>
type StyleParamsPatch = NonNullable<PartialConfig['styleParams']>
type CanvasPatch = NonNullable<PartialConfig['canvas']>
type ExportPatch = NonNullable<PartialConfig['exportOptions']>

export interface AvatarStore {
  config: AvatarConfig
  history: AvatarConfig[]
  ui: UiState
  setConfig: (partial: PartialConfig) => void
  setTypography: (partial: TypographyPatch) => void
  setStyleParams: (partial: StyleParamsPatch) => void
  setCanvas: (partial: CanvasPatch) => void
  setExportOptions: (partial: ExportPatch) => void
  randomize: () => void
  randomizeAll: () => void
  pushHistory: () => void
  restore: (index: number) => void
  reset: () => void
  setUi: (partial: Partial<UiState>) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 面板给的是嵌套局部更新，浅合并会把同层其他字段冲成默认值，所以逐层合并。 */
function deepMerge(base: object, patch: object): Record<string, unknown> {
  const source = patch as Record<string, unknown>
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const key of Object.keys(source)) {
    const next = source[key]
    if (next === undefined) continue
    const current = out[key]
    out[key] = isRecord(next) && isRecord(current) ? deepMerge(current, next) : next
  }
  return out
}

/** 10 位 base36 种子。有 crypto 就用，避免多个标签页同时随机撞到一起。 */
function randomSeed(): string {
  const buf = new Uint32Array(2)
  const webcrypto = globalThis.crypto
  if (typeof webcrypto?.getRandomValues === 'function') {
    webcrypto.getRandomValues(buf)
  } else {
    buf[0] = Math.floor(Math.random() * 0xffffffff)
    buf[1] = Math.floor(Math.random() * 0xffffffff)
  }
  const text = (buf[0] ?? 0).toString(36) + (buf[1] ?? 0).toString(36)
  return text.padEnd(10, '0').slice(0, 10)
}

/** 换一套同 tone 的内置配色。当前是自定义配色或未知 id 时保持不动，别改用户自己调的颜色。 */
function nextPaletteId(current: string): string {
  const active = PALETTES.find((item) => item.id === current)
  if (!active) return current
  const pool = PALETTES.filter((item) => item.tone === active.tone && item.id !== current)
  if (pool.length === 0) return current
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? current
}

/** 本次会话的初始配置是从哪来的。 */
export type ConfigSource = 'hash' | 'storage' | 'default'

let configSource: ConfigSource = 'default'

/**
 * 初始配置来自哪一档。'default' 表示既没有分享链接也没有本机存档，
 * 这时示例文字才由界面语言决定；另外两档都是用户自己的配置，不能覆盖。
 */
export function initialConfigSource(): ConfigSource {
  return configSource
}

/** 初始配置优先级：URL hash > localStorage > 默认。链接分享出去要能覆盖本机存档。 */
export function readInitialConfig(): AvatarConfig {
  const hash = typeof window === 'undefined' ? '' : window.location.hash
  const shared = hash ? decodeConfigFromHash(hash) : null
  if (shared) {
    configSource = 'hash'
    return shared
  }
  const stored = loadPersisted()
  configSource = stored ? 'storage' : 'default'
  return stored ?? DEFAULT_CONFIG
}

function readInitialHistory(): AvatarConfig[] {
  return loadPersistedState()?.history ?? []
}

export const useAvatarStore = create<AvatarStore>()((set, get) => ({
  config: readInitialConfig(),
  history: readInitialHistory(),
  ui: { ...DEFAULT_UI },

  setConfig: (partial) => {
    set({ config: normalizeConfig(deepMerge(get().config, partial)) })
  },

  setTypography: (partial) => {
    get().setConfig({ typography: partial })
  },

  setStyleParams: (partial) => {
    get().setConfig({ styleParams: partial })
  },

  setCanvas: (partial) => {
    get().setConfig({ canvas: partial })
  },

  setExportOptions: (partial) => {
    get().setConfig({ exportOptions: partial })
  },

  randomize: () => {
    set({ config: { ...get().config, seed: randomSeed() } })
  },

  randomizeAll: () => {
    const config = get().config
    const styles: StyleId[] = ['mesh', 'flow', 'silk', 'grain']
    const others = styles.filter((s) => s !== config.style)
    const style = others[Math.floor(Math.random() * others.length)] ?? config.style
    set({
      config: { ...config, seed: randomSeed(), palette: nextPaletteId(config.palette), style },
    })
  },

  pushHistory: () => {
    set({ history: pushHistoryEntry(get().history, get().config, HISTORY_MAX) })
  },

  restore: (index) => {
    const entry = get().history[index]
    if (!entry) return
    set({ config: entry })
  },

  reset: () => {
    set({ config: DEFAULT_CONFIG })
  },

  setUi: (partial) => {
    const next = { ...get().ui, ...partial }
    set({ ui: { ...next, exportMounted: next.exportMounted || next.exportOpen } })
  },
}))

/** 连续拖滑杆时不必每帧写盘，攒 300 ms 再落一次。 */
export const SYNC_DEBOUNCE_MS = 300

let syncTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribe: (() => void) | null = null

function writeSync(config: AvatarConfig, history: readonly AvatarConfig[]): void {
  savePersisted(config, history)
  if (typeof window === 'undefined') return
  try {
    const { pathname, search } = window.location
    // replaceState 而不是给 location.hash 赋值，后者每次调参都会往浏览器历史里塞一条
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${search}${encodeConfigToHash(config)}`,
    )
  } catch {
    // 部分嵌入环境禁用了 replaceState，存档已经落地，链接同步失败可以忍
  }
}

/** 立刻把当前状态写进 localStorage 与 URL，导出前调用，别让用户复制到旧链接。 */
export function flushConfigSync(): void {
  if (syncTimer !== null) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  const { config, history } = useAvatarStore.getState()
  writeSync(config, history)
}

export function stopConfigSync(): void {
  if (syncTimer !== null) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  unsubscribe?.()
  unsubscribe = null
}

export function startConfigSync(): () => void {
  stopConfigSync()
  unsubscribe = useAvatarStore.subscribe((state, prev) => {
    if (state.config === prev.config && state.history === prev.history) return
    if (syncTimer !== null) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      syncTimer = null
      const { config, history } = useAvatarStore.getState()
      writeSync(config, history)
    }, SYNC_DEBOUNCE_MS)
  })
  return stopConfigSync
}

if (typeof window !== 'undefined') startConfigSync()
