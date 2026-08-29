import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
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
    const history = [withText('一'), withText('二')]
    savePersisted(DEFAULT_CONFIG, history)
    expect(loadPersistedState()).toEqual({ config: DEFAULT_CONFIG, history })
  })

  it('省略历史参数时保留已存的历史', () => {
    savePersisted(DEFAULT_CONFIG, [withText('旧')])
    savePersisted(withText('新'))
    const state = loadPersistedState()
    expect(state?.config.text).toBe('新')
    expect(state?.history.map((item) => item.text)).toEqual(['旧'])
  })

  it('历史超过上限时只留前 8 条', () => {
    const history = Array.from({ length: 12 }, (_, i) => withText(`第${i}`))
    savePersisted(DEFAULT_CONFIG, history)
    expect(loadPersistedState()?.history).toHaveLength(8)
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
        history: [{ text: '半份历史' }, '不是对象'],
      }),
    )
    const state = loadPersistedState()
    expect(state?.config.text).toBe('半份配置')
    expect(state?.config.canvas.width).toBe(8192)
    expect(state?.config.typography).toEqual(DEFAULT_CONFIG.typography)
    expect(state?.history).toHaveLength(1)
    expect(state?.history[0]?.text).toBe('半份历史')
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
