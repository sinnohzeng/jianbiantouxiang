import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, configHash, type AvatarConfig } from '@/state/config'
import { HISTORY_MAX, attachHistoryThumb, pushHistory } from '@/state/history'

function withText(text: string): AvatarConfig {
  return { ...DEFAULT_CONFIG, text }
}

function entry(text: string, thumb?: string) {
  return { config: withText(text), ...(thumb ? { thumb } : {}) }
}

describe('pushHistory', () => {
  it('新配置进表首，其余顺序不变', () => {
    const list = [entry('一'), entry('二')]
    const next = pushHistory(list, withText('三'))
    expect(next.map((item) => item.config.text)).toEqual(['三', '一', '二'])
  })

  it('相同配置去重后提到最前', () => {
    const list = [entry('一'), entry('二'), entry('三')]
    const next = pushHistory(list, withText('三'))
    expect(next.map((item) => item.config.text)).toEqual(['三', '一', '二'])
    expect(next).toHaveLength(3)
  })

  it('只有嵌套字段不同时不算重复', () => {
    const base = withText('一')
    const tweaked: AvatarConfig = { ...base, typography: { ...base.typography, fontSize: 0.5 } }
    expect(pushHistory([entry('一')], tweaked)).toHaveLength(2)
  })

  it('超过上限时裁掉最旧的一条', () => {
    let list: ReturnType<typeof entry>[] = []
    for (let i = 0; i < HISTORY_MAX + 3; i += 1) {
      list = pushHistory(list, withText(`第${i}`))
    }
    expect(list).toHaveLength(HISTORY_MAX)
    expect(list[0]?.config.text).toBe(`第${HISTORY_MAX + 2}`)
    expect(list.at(-1)?.config.text).toBe('第3')
  })

  it('自定义上限生效，上限为 0 时返回空表', () => {
    const list = [entry('一'), entry('二'), entry('三')]
    expect(pushHistory(list, withText('四'), 2).map((item) => item.config.text)).toEqual([
      '四',
      '一',
    ])
    expect(pushHistory(list, withText('四'), 0)).toEqual([])
  })

  it('不改动传入的数组', () => {
    const list = [entry('一')]
    const snapshot = [...list]
    pushHistory(list, withText('二'))
    expect(list).toEqual(snapshot)
  })
})

describe('attachHistoryThumb', () => {
  it('按配置哈希补写缩略图，不影响其他条目', () => {
    const list = [entry('一'), entry('二')]
    const hash = configHash(withText('二'))
    const next = attachHistoryThumb(list, hash, 'data:image/jpeg;base64,thumb')
    expect(next[0]?.thumb).toBeUndefined()
    expect(next[1]?.thumb).toBe('data:image/jpeg;base64,thumb')
    expect(list[1]?.thumb).toBeUndefined()
  })
})
