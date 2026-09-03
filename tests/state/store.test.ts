import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
import { PERSIST_KEY, savePersisted } from '@/state/persist'
import { decodeConfigFromHash, encodeConfigToHash } from '@/state/url'
import {
  DEFAULT_UI,
  SYNC_DEBOUNCE_MS,
  flushConfigSync,
  readInitialConfig,
  startConfigSync,
  stopConfigSync,
  useAvatarStore,
} from '@/state/store'
import { memoryStorage as storage } from '../setup'

// 只用到 id 与 tone，给三套固定数据让“换同 tone 配色”有唯一解
vi.mock('@/palettes/palettes', () => ({
  PALETTES: [
    { id: 'clear-sky', tone: 'light' },
    { id: 'frost', tone: 'light' },
    { id: 'midnight', tone: 'dark' },
  ],
}))

const store = () => useAvatarStore.getState()

beforeEach(() => {
  stopConfigSync()
  window.history.replaceState(null, '', '/')
  useAvatarStore.setState({
    config: DEFAULT_CONFIG,
    past: [],
    future: [],
    history: [],
    ui: { ...DEFAULT_UI },
  })
})

afterEach(() => {
  stopConfigSync()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('setConfig 与分组动作', () => {
  it('嵌套局部更新只改目标字段', () => {
    store().setConfig({ typography: { fontSize: 0.6 } })
    const { typography } = store().config
    expect(typography.fontSize).toBe(0.6)
    expect(typography.fontFamily).toBe(DEFAULT_CONFIG.typography.fontFamily)
    expect(typography.pill).toEqual(DEFAULT_CONFIG.typography.pill)
  })

  it('连续调用互不覆盖', () => {
    store().setConfig({ text: '产品设计部' })
    store().setConfig({ canvas: { width: 512 } })
    const { config } = store()
    expect(config.text).toBe('产品设计部')
    expect(config.canvas.width).toBe(512)
    expect(config.canvas.height).toBe(DEFAULT_CONFIG.canvas.height)
  })

  it('越界值按契约夹回区间', () => {
    store().setConfig({ highlight: 9, styleParams: { scale: 99 } })
    expect(store().config.highlight).toBe(1)
    expect(store().config.styleParams.scale).toBe(2)
  })

  it('setTypography 支持两层嵌套', () => {
    store().setTypography({ pill: { opacity: 0.9 } })
    expect(store().config.typography.pill.opacity).toBe(0.9)
    expect(store().config.typography.pill.radius).toBe(DEFAULT_CONFIG.typography.pill.radius)
  })

  it('setStyleParams / setCanvas / setExportOptions 各写各的子树', () => {
    store().setStyleParams({ intensity: 0.8 })
    store().setCanvas({ shape: 'circle' })
    store().setExportOptions({ format: 'png' })
    const { config } = store()
    expect(config.styleParams.intensity).toBe(0.8)
    expect(config.styleParams.softness).toBe(DEFAULT_CONFIG.styleParams.softness)
    expect(config.canvas.shape).toBe('circle')
    expect(config.canvas.radius).toBe(DEFAULT_CONFIG.canvas.radius)
    expect(config.exportOptions.format).toBe('png')
    expect(config.exportOptions.bgColor).toBe(DEFAULT_CONFIG.exportOptions.bgColor)
  })

  it('config 引用变化，方便订阅方做浅比较', () => {
    const before = store().config
    store().setConfig({ text: '新文字' })
    expect(store().config).not.toBe(before)
  })
})

describe('randomize', () => {
  it('换一个新种子并保留其余字段', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, text: '猪猪家族', seed: 'old' } })
    store().randomize()
    const { config } = store()
    expect(config.seed).not.toBe('old')
    expect(config.seed).toMatch(/^[0-9a-z]{12}$/)
    expect(config.text).toBe('猪猪家族')
    expect(config.styleParams).toEqual(DEFAULT_CONFIG.styleParams)
  })

  it('两次随机得到不同种子', () => {
    store().randomize()
    const first = store().config.seed
    store().randomize()
    expect(store().config.seed).not.toBe(first)
  })

  it('只换种子不换配色', () => {
    store().randomize()
    expect(store().config.palette).toBe(DEFAULT_CONFIG.palette)
  })

  it('randomize 不碰自定义配色', () => {
    useAvatarStore.setState({
      config: { ...DEFAULT_CONFIG, palette: 'custom', customColors: ['#112233', '#445566'] },
    })
    store().randomize()
    expect(store().config.palette).toBe('custom')
    expect(store().config.customColors).toEqual(['#112233', '#445566'])
  })

  it('randomize 不碰不认识的配色 id', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, palette: '不存在' } })
    store().randomize()
    expect(store().config.palette).toBe('不存在')
  })
})

describe('randomizeAll', () => {
  it('把内置配色换成同 tone 的另一套并换质感', () => {
    store().randomizeAll()
    expect(store().config.palette).toBe('frost')
    expect(store().config.style).not.toBe(DEFAULT_CONFIG.style)
  })

  it('自定义配色下也真的换一套内置配色，自定义色留在配置里', () => {
    useAvatarStore.setState({
      config: { ...DEFAULT_CONFIG, palette: 'custom', customColors: ['#112233', '#445566'] },
    })
    store().randomizeAll()
    const { config } = store()
    expect(['clear-sky', 'frost', 'midnight']).toContain(config.palette)
    expect(config.customColors).toEqual(['#112233', '#445566'])
  })

  it('配色 id 不认识时换成内置配色', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, palette: '不存在' } })
    store().randomizeAll()
    expect(['clear-sky', 'frost', 'midnight']).toContain(store().config.palette)
  })

  it('同 tone 只剩当前这一套时跨 tone 换，不会原地不动', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, palette: 'midnight' } })
    store().randomizeAll()
    expect(['clear-sky', 'frost']).toContain(store().config.palette)
  })

  it('连续点十次，每次都换掉当前配色', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, palette: 'custom' } })
    for (let i = 0; i < 10; i += 1) {
      const before = store().config.palette
      store().randomizeAll()
      expect(store().config.palette).not.toBe(before)
    }
  })
})

describe('history 动作', () => {
  it('pushHistory 把当前配置放到表首', () => {
    store().setConfig({ text: '一' })
    store().pushHistory()
    store().setConfig({ text: '二' })
    store().pushHistory()
    expect(store().history.map((item) => item.config.text)).toEqual(['二', '一'])
  })

  it('重复 push 同一配置只留一条', () => {
    store().pushHistory()
    store().pushHistory()
    expect(store().history).toHaveLength(1)
  })

  it('最多留 8 条', () => {
    for (let i = 0; i < 11; i += 1) {
      store().setConfig({ text: `第${i}` })
      store().pushHistory()
    }
    expect(store().history).toHaveLength(8)
    expect(store().history[0]?.config.text).toBe('第10')
  })

  it('restore 回到指定历史，越界索引不动', () => {
    store().setConfig({ text: '一' })
    store().pushHistory()
    store().setConfig({ text: '二' })
    store().restore(0)
    expect(store().config.text).toBe('一')
    store().restore(9)
    expect(store().config.text).toBe('一')
    store().restore(-1)
    expect(store().config.text).toBe('一')
  })

  it('reset 回到默认配置，且是 DEFAULT_CONFIG 本身', () => {
    store().setConfig({ text: '改过的' })
    store().reset()
    expect(store().config).toEqual(DEFAULT_CONFIG)
    // 引用相等是对外契约：App 的 LocaleDefaults 据此认出“回到默认档”，重新按语言下发文字与字体
    expect(store().config).toBe(DEFAULT_CONFIG)
  })
})

describe('撤销与重做', () => {
  it('配置动作入栈，undo 回到上一份，redo 再回到下一份', () => {
    const before = store().config
    store().setConfig({ text: '第一次' })
    store().setConfig({ text: '第二次' })
    expect(store().past.map((item) => item.text)).toEqual([
      DEFAULT_CONFIG.text,
      '第一次',
    ])

    store().undo()
    expect(store().config.text).toBe('第一次')
    store().undo()
    expect(store().config).toBe(before)
    expect(store().future.map((item) => item.text)).toEqual(['第一次', '第二次'])

    store().redo()
    expect(store().config.text).toBe('第一次')
    store().redo()
    expect(store().config.text).toBe('第二次')
  })

  it('无变化的 setConfig 不占撤销栈', () => {
    store().setConfig({ text: DEFAULT_CONFIG.text })
    expect(store().past).toHaveLength(0)
  })

  it('新的配置动作清空重做栈', () => {
    store().setConfig({ text: '第一次' })
    store().undo()
    expect(store().future).toHaveLength(1)
    store().setConfig({ text: '另一条路' })
    expect(store().future).toHaveLength(0)
  })

  it('撤销栈最多 50 份', () => {
    for (let i = 0; i < 55; i += 1) store().setConfig({ text: `第${i}` })
    expect(store().past).toHaveLength(50)
    expect(store().past[0]?.text).toBe('第4')
  })

  it('随机、恢复历史与重置都能撤销', () => {
    store().randomize()
    const randomized = store().config
    store().setConfig({ text: '历史前' })
    store().pushHistory()
    store().setConfig({ text: '历史后' })
    store().restore(0)
    expect(store().config.text).toBe('历史前')
    store().undo()
    expect(store().config.text).toBe('历史后')
    store().undo()
    expect(store().config.text).toBe('历史前')
    store().undo()
    expect(store().config).toBe(randomized)

    store().reset()
    store().undo()
    expect(store().config).toBe(randomized)
  })
})

describe('ui 状态', () => {
  it('setUi 局部更新，其余字段保持', () => {
    store().setUi({ activePanel: 'palette' })
    store().setUi({ fontStatus: 'loading' })
    expect(store().ui).toEqual({ ...DEFAULT_UI, activePanel: 'palette', fontStatus: 'loading' })
  })
})

describe('初始化优先级', () => {
  it('URL hash 优先于 localStorage', () => {
    savePersisted({ ...DEFAULT_CONFIG, text: '存档' })
    window.history.replaceState(null, '', encodeConfigToHash({ ...DEFAULT_CONFIG, text: '链接' }))
    expect(readInitialConfig().text).toBe('链接')
  })

  it('hash 解不出来时用 localStorage', () => {
    savePersisted({ ...DEFAULT_CONFIG, text: '存档' })
    window.history.replaceState(null, '', '#c=坏数据')
    expect(readInitialConfig().text).toBe('存档')
  })

  it('两者都没有时用默认配置', () => {
    expect(readInitialConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('默认档给的是 DEFAULT_CONFIG 本身', () => {
    // App 的 LocaleDefaults 靠这份引用判断“配置还是默认档”，决定要不要按语言下发字体
    expect(readInitialConfig()).toBe(DEFAULT_CONFIG)
  })

  it('新建的 store 实例按同一优先级取初值与历史', async () => {
    savePersisted({ ...DEFAULT_CONFIG, text: '存档' }, [
      { config: { ...DEFAULT_CONFIG, text: '历史' } },
    ])
    window.history.replaceState(null, '', encodeConfigToHash({ ...DEFAULT_CONFIG, text: '链接' }))
    vi.resetModules()
    const fresh = await import('@/state/store')
    fresh.stopConfigSync()
    expect(fresh.useAvatarStore.getState().config.text).toBe('链接')
    expect(fresh.useAvatarStore.getState().history.map((item) => item.config.text)).toEqual(['历史'])
  })
})

describe('防抖同步', () => {
  function persisted(): AvatarConfig | null {
    const raw = storage.getItem(PERSIST_KEY)
    return raw ? ((JSON.parse(raw) as { config: AvatarConfig }).config ?? null) : null
  }

  it('300 ms 后才写 localStorage 与 URL hash', () => {
    vi.useFakeTimers()
    startConfigSync()
    store().setConfig({ text: '慢慢写' })

    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS - 1)
    expect(persisted()).toBeNull()
    expect(window.location.hash).toBe('')

    vi.advanceTimersByTime(1)
    expect(persisted()?.text).toBe('慢慢写')
    expect(decodeConfigFromHash(window.location.hash)?.text).toBe('慢慢写')
  })

  it('连续改动只落一次盘', () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(storage, 'setItem')
    startConfigSync()
    store().setConfig({ text: '一' })
    store().setConfig({ text: '二' })
    store().setConfig({ text: '三' })
    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(persisted()?.text).toBe('三')
  })

  it('只写 hash 不留浏览器历史', () => {
    vi.useFakeTimers()
    const pushState = vi.spyOn(window.history, 'pushState')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    startConfigSync()
    store().setConfig({ text: '不留痕' })
    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS)
    expect(replaceState).toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })

  it('历史条变化同样触发同步', () => {
    vi.useFakeTimers()
    startConfigSync()
    store().pushHistory()
    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS)
    const raw = storage.getItem(PERSIST_KEY)
    expect(raw ? (JSON.parse(raw) as { history: unknown[] }).history : []).toHaveLength(1)
  })

  it('flushConfigSync 立刻写盘', () => {
    vi.useFakeTimers()
    startConfigSync()
    store().setConfig({ text: '马上导出' })
    flushConfigSync()
    expect(persisted()?.text).toBe('马上导出')
  })

  it('stopConfigSync 之后不再写', () => {
    vi.useFakeTimers()
    startConfigSync()
    stopConfigSync()
    store().setConfig({ text: '停了' })
    vi.advanceTimersByTime(SYNC_DEBOUNCE_MS * 2)
    expect(persisted()).toBeNull()
  })
})

describe('导出抽屉的挂载闩', () => {
  it('打开过一次之后 exportMounted 就不再回落', () => {
    expect(store().ui.exportMounted).toBe(false)
    store().setUi({ exportOpen: true })
    expect(store().ui.exportMounted).toBe(true)
    store().setUi({ exportOpen: false })
    expect(store().ui.exportOpen).toBe(false)
    expect(store().ui.exportMounted).toBe(true)
  })
})
