/**
 * 微调面板开合状态：默认收起、落盘、订阅通知。
 *
 * 它不属于 AvatarConfig，不进存档也不进撤销栈，所以单独一份模块级状态。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INSPECTOR_OPEN_STORAGE_KEY,
  getInspectorOpen,
  setInspectorOpen,
  subscribeInspectorOpen,
} from '@/app/inspector-open'

beforeEach(() => {
  localStorage.clear()
  setInspectorOpen(false)
})

describe('inspector-open', () => {
  it('默认收起：常用的是改文字与换配色，宽度先让给它们', () => {
    expect(getInspectorOpen()).toBe(false)
  })

  it('打开会落盘，关掉写回 0', () => {
    setInspectorOpen(true)
    expect(getInspectorOpen()).toBe(true)
    expect(localStorage.getItem(INSPECTOR_OPEN_STORAGE_KEY)).toBe('1')

    setInspectorOpen(false)
    expect(localStorage.getItem(INSPECTOR_OPEN_STORAGE_KEY)).toBe('0')
  })

  it('值没变就不通知，退订之后不再收到', () => {
    const listener = vi.fn()
    const off = subscribeInspectorOpen(listener)

    setInspectorOpen(true)
    expect(listener).toHaveBeenCalledTimes(1)
    setInspectorOpen(true)
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    setInspectorOpen(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
