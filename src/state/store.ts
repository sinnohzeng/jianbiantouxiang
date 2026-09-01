import type { StyleId } from './config'
import { randomSeed } from '@/engine/seed'
import { create } from 'zustand'
import { PALETTES } from '@/palettes/palettes'
import {
  DEFAULT_CONFIG,
  configHash,
  normalizeConfig,
  type AvatarConfig,
  type PartialConfig,
} from '@/state/config'
import {
  HISTORY_MAX,
  attachHistoryThumb as attachThumbEntry,
  pushHistory as pushHistoryEntry,
  type HistoryEntry,
} from '@/state/history'
import { loadPersisted, loadPersistedState, savePersisted } from '@/state/persist'
import { decodeConfigFromHash, encodeConfigToHash, hasBrokenConfigHash } from '@/state/url'

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

/** 配置级撤销上限。配置对象本身很小，50 份足够回退一串误操作。 */
export const UNDO_MAX = 50

export const DEFAULT_UI: UiState = {
  activePanel: 'text',
  exportOpen: false,
  exportMounted: false,
  fontStatus: 'idle',
}

type TypographyPatch = NonNullable<PartialConfig['typography']>
type LayoutPatch = NonNullable<PartialConfig['layout']>
type StyleParamsPatch = NonNullable<PartialConfig['styleParams']>
type CanvasPatch = NonNullable<PartialConfig['canvas']>
type ExportPatch = NonNullable<PartialConfig['exportOptions']>

export interface AvatarStore {
  config: AvatarConfig
  /** 撤销栈，只存在内存，不进 URL、存档或历史条。 */
  past: AvatarConfig[]
  /** 重做栈。新的配置动作一出现就清空。 */
  future: AvatarConfig[]
  history: HistoryEntry[]
  ui: UiState
  setConfig: (partial: PartialConfig) => void
  undo: () => void
  redo: () => void
  setTypography: (partial: TypographyPatch) => void
  setLayout: (partial: LayoutPatch) => void
  setStyleParams: (partial: StyleParamsPatch) => void
  setCanvas: (partial: CanvasPatch) => void
  setExportOptions: (partial: ExportPatch) => void
  randomize: () => void
  randomizeAll: () => void
  pushHistory: () => void
  attachThumb: (hash: string, thumb: string) => void
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

/**
 * 换一套内置配色，只给「随机配色 + 质感」用，必定换掉当前这套。
 *
 * 深浅是 spec §3.2 里的一等筛选维度，用户挑了浅色系就不该被随机翻成深色，所以优先在同 tone 内换。
 * 当前是自定义配色或未知 id 时没有 tone 可依，改从全部内置配色里挑：菜单写了换配色就得真的换。
 * customColors 原样留在配置里，用户在配色面板一键切回自己的颜色，上一版也已经进了「最近生成」。
 */
function nextPaletteId(current: string): string {
  const active = PALETTES.find((item) => item.id === current)
  const others = PALETTES.filter((item) => item.id !== current)
  const sameTone = active ? others.filter((item) => item.tone === active.tone) : []
  // 同 tone 只剩当前这一套时跨 tone 挑，宁可翻深浅也别让按钮看起来没反应
  const pool = sameTone.length > 0 ? sameTone : others
  if (pool.length === 0) return current
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? current
}

/** 写入下一份配置，并把当前份压进撤销栈。无变化时不入栈。 */
function commitConfig(
  set: (partial: Partial<AvatarStore>) => void,
  get: () => AvatarStore,
  next: AvatarConfig,
): void {
  const { config, past } = get()
  if (configHash(next) === configHash(config)) return
  set({ config: next, past: [...past, config].slice(-UNDO_MAX), future: [] })
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

let brokenHash = false

/**
 * 打开页面时那条分享链接带着配置却读不出来。
 *
 * 界面要据此提示一次：不然用户点进来看到的是自己本机的旧配置，
 * 而 300 ms 后的一次 replaceState 还会把链接里那段坏载荷换成他自己的，
 * 现场就没了，他只会以为对方发的链接没做上去。
 */
export function initialHashBroken(): boolean {
  return brokenHash
}

/** 初始配置优先级：URL hash > localStorage > 默认。链接分享出去要能覆盖本机存档。 */
export function readInitialConfig(): AvatarConfig {
  const hash = typeof window === 'undefined' ? '' : window.location.hash
  const shared = hash ? decodeConfigFromHash(hash) : null
  if (shared) {
    configSource = 'hash'
    return shared
  }
  brokenHash = hasBrokenConfigHash(hash)
  const stored = loadPersisted()
  configSource = stored ? 'storage' : 'default'
  return stored ?? DEFAULT_CONFIG
}

function readInitialHistory(): HistoryEntry[] {
  return loadPersistedState()?.history ?? []
}

export const useAvatarStore = create<AvatarStore>()((set, get) => ({
  config: readInitialConfig(),
  past: [],
  future: [],
  history: readInitialHistory(),
  ui: { ...DEFAULT_UI },

  setConfig: (partial) => {
    const next = normalizeConfig(deepMerge(get().config, partial))
    commitConfig(set, get, next)
  },

  undo: () => {
    const { config, past, future } = get()
    const previous = past.at(-1)
    if (!previous) return
    set({
      config: previous,
      past: past.slice(0, -1),
      future: [config, ...future].slice(0, UNDO_MAX),
    })
  },

  redo: () => {
    const { config, past, future } = get()
    const next = future[0]
    if (!next) return
    set({
      config: next,
      past: [...past, config].slice(-UNDO_MAX),
      future: future.slice(1),
    })
  },

  setTypography: (partial) => {
    get().setConfig({ typography: partial })
  },

  setLayout: (partial) => {
    get().setConfig({ layout: partial })
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
    commitConfig(set, get, { ...get().config, seed: randomSeed() })
  },

  randomizeAll: () => {
    const config = get().config
    const styles: StyleId[] = ['mesh', 'flow', 'silk', 'grain']
    // 从当前质感以外的三种里挑，与配色同一口径：点一下必须看得出变化
    const others = styles.filter((s) => s !== config.style)
    const style = others[Math.floor(Math.random() * others.length)] ?? config.style
    commitConfig(set, get, {
      ...config,
      seed: randomSeed(),
      palette: nextPaletteId(config.palette),
      style,
    })
  },

  pushHistory: () => {
    set({ history: pushHistoryEntry(get().history, get().config, HISTORY_MAX) })
  },

  attachThumb: (hash, thumb) => {
    set({ history: attachThumbEntry(get().history, hash, thumb) })
  },

  restore: (index) => {
    const entry = get().history[index]
    if (!entry) return
    commitConfig(set, get, entry.config)
  },

  reset: () => {
    // 必须是 DEFAULT_CONFIG 本身，不能换成等值的新对象：
    // src/App.tsx 的 LocaleDefaults 靠这份引用认出“回到默认档”，好让示例文字与默认字体重新跟随语言
    commitConfig(set, get, DEFAULT_CONFIG)
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

function writeSync(config: AvatarConfig, history: readonly HistoryEntry[]): void {
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
