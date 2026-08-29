import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
import { HISTORY_MAX, pushHistory } from '@/state/history'

function withText(text: string): AvatarConfig {
  return { ...DEFAULT_CONFIG, text }
}

describe('pushHistory', () => {
  it('新配置进表首，其余顺序不变', () => {
    const list = [withText('一'), withText('二')]
    const next = pushHistory(list, withText('三'))
    expect(next.map((item) => item.text)).toEqual(['三', '一', '二'])
  })

  it('相同配置去重后提到最前', () => {
    const list = [withText('一'), withText('二'), withText('三')]
    const next = pushHistory(list, withText('三'))
    expect(next.map((item) => item.text)).toEqual(['三', '一', '二'])
    expect(next).toHaveLength(3)
  })

  it('只有嵌套字段不同时不算重复', () => {
    const base = withText('一')
    const tweaked: AvatarConfig = { ...base, typography: { ...base.typography, fontSize: 0.5 } }
    expect(pushHistory([base], tweaked)).toHaveLength(2)
  })

  it('超过上限时裁掉最旧的一条', () => {
    let list: AvatarConfig[] = []
    for (let i = 0; i < HISTORY_MAX + 3; i += 1) list = pushHistory(list, withText(`第${i}`))
    expect(list).toHaveLength(HISTORY_MAX)
    expect(list[0]?.text).toBe(`第${HISTORY_MAX + 2}`)
    expect(list.at(-1)?.text).toBe('第3')
  })

  it('自定义上限生效，上限为 0 时返回空表', () => {
    const list = [withText('一'), withText('二'), withText('三')]
    expect(pushHistory(list, withText('四'), 2).map((item) => item.text)).toEqual(['四', '一'])
    expect(pushHistory(list, withText('四'), 0)).toEqual([])
  })

  it('不改动传入的数组', () => {
    const list = [withText('一')]
    const snapshot = [...list]
    pushHistory(list, withText('二'))
    expect(list).toEqual(snapshot)
  })
})
