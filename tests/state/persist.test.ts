import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
import type { HistoryEntry } from '@/state/history'
import {
  PERSIST_KEY,
  clearPersisted,
  loadPersisted,
  loadPersistedState,
  savePersisted,
} from '@/state/persist'
import { memoryStorage as store } from '../setup'

function withText(text: string): AvatarConfig {
  return { ...DEFAULT_CONFIG, text }
}

function entry(text: string, thumb?: string): HistoryEntry {
  return { config: withText(text), ...(thumb ? { thumb } : {}) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('savePersisted / loadPersisted', () => {
  it('写进去再读出来是同一份配置', () => {
    const config = withText('猪猪家族')
    savePersisted(config)
    expect(loadPersisted()).toEqual(config)
  })

  it('配置与历史一起存', () => {
    const history = [entry('一'), entry('二', 'data:image/jpeg;base64,one')]
    savePersisted(DEFAULT_CONFIG, history)
    expect(loadPersistedState()).toEqual({ config: DEFAULT_CONFIG, history })
  })

  it('缩略图 data URL 随历史一起读写', () => {
    savePersisted(DEFAULT_CONFIG, [entry('一', 'data:image/jpeg;base64,thumb')])
    expect(loadPersistedState()?.history[0]?.thumb).toBe('data:image/jpeg;base64,thumb')
  })

  it('非 data URL 的缩略图丢弃，历史配置保留', () => {
    store.setItem(
      PERSIST_KEY,
      JSON.stringify({
        v: 3,
        config: DEFAULT_CONFIG,
        history: [{ config: withText('一'), thumb: 'https://evil.example/a.jpg' }],
      }),
    )
    expect(loadPersistedState()?.history[0]).toEqual({ config: withText('一') })
  })

  it('省略历史参数时保留已存的历史', () => {
    savePersisted(DEFAULT_CONFIG, [entry('旧')])
    savePersisted(withText('新'))
    const state = loadPersistedState()
    expect(state?.config.text).toBe('新')
    expect(state?.history.map((item) => item.config.text)).toEqual(['旧'])
  })

  it('历史超过上限时只留前 8 条', () => {
    const history = Array.from({ length: 12 }, (_, i) => entry(`第${i}`))
    savePersisted(DEFAULT_CONFIG, history)
    expect(loadPersistedState()?.history).toHaveLength(8)
  })

  it('存档超过 400 KB 时从最旧一条开始丢缩略图', () => {
    const bigThumb = `data:image/jpeg;base64,${'a'.repeat(65 * 1024)}`
    const history = Array.from({ length: 8 }, (_, index) =>
      entry(`第${index}`, index === 0 ? undefined : bigThumb),
    )
    savePersisted(DEFAULT_CONFIG, history)
    const raw = store.getItem(PERSIST_KEY) ?? ''
    expect(raw.length).toBeLessThanOrEqual(400 * 1024)
    const saved = JSON.parse(raw) as { history: HistoryEntry[] }
    expect(saved.history[7]?.thumb).toBeUndefined()
    expect(saved.history.map((item) => item.config.text)).toEqual(
      history.map((item) => item.config.text),
    )
  })

  it('用固定的键名', () => {
    savePersisted(DEFAULT_CONFIG)
    expect(store.getItem(PERSIST_KEY)).toBeTruthy()
  })

  it('clearPersisted 清掉存档', () => {
    savePersisted(DEFAULT_CONFIG)
    clearPersisted()
    expect(loadPersisted()).toBeNull()
  })
})

describe('损坏数据', () => {
  it.each([
    ['没有存过', null],
    ['空串', ''],
    ['坏 JSON', '{ 不是 JSON'],
    ['载荷是数组', '[1,2,3]'],
    ['版本对不上', JSON.stringify({ v: 2, config: DEFAULT_CONFIG })],
    ['缺 config', JSON.stringify({ v: 3, history: [] })],
    ['config 不是对象', JSON.stringify({ v: 3, config: '文字' })],
  ])('%s 时返回 null', (_name, raw) => {
    if (raw !== null) store.setItem(PERSIST_KEY, raw)
    expect(loadPersisted()).toBeNull()
    expect(loadPersistedState()).toBeNull()
  })

  it('history 不是数组时按空历史处理', () => {
    store.setItem(PERSIST_KEY, JSON.stringify({ v: 3, config: DEFAULT_CONFIG, history: 7 }))
    expect(loadPersistedState()).toEqual({ config: DEFAULT_CONFIG, history: [] })
  })

  it('残缺字段被补成默认值并夹回区间', () => {
    store.setItem(
      PERSIST_KEY,
      JSON.stringify({
        v: 3,
        config: { text: '半份配置', canvas: { width: 99999 } },
        history: [{ config: { text: '半份历史' } }, '不是对象'],
      }),
    )
    const state = loadPersistedState()
    expect(state?.config.text).toBe('半份配置')
    expect(state?.config.canvas.width).toBe(8192)
    expect(state?.config.typography).toEqual(DEFAULT_CONFIG.typography)
    expect(state?.history).toHaveLength(1)
    expect(state?.history[0]?.config.text).toBe('半份历史')
  })
})

describe('存储不可用', () => {
  it('setItem 抛错时不冒泡', () => {
    const setItem = vi.spyOn(store, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => savePersisted(DEFAULT_CONFIG)).not.toThrow()
    expect(setItem).toHaveBeenCalled()
  })

  it('getItem 抛错时返回 null', () => {
    savePersisted(DEFAULT_CONFIG)
    vi.spyOn(store, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadPersisted()).toBeNull()
  })

  it('removeItem 抛错时不冒泡', () => {
    vi.spyOn(store, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => clearPersisted()).not.toThrow()
  })
})
