/**
 * 「模块级状态加 localStorage」这一类的统一实现。
 *
 * 微调开合、手机预览高度、参考层开关都是「怎么看」而不是「出什么图」：
 * 不属于 AvatarConfig，不进存档与历史，但要跨会话记住。三者同构，
 * 各自手写一份订阅、落盘与 try/catch 是重复，收在这里。
 *
 * 主题不在这份工厂里：它要往 documentElement 写 class 与 meta、
 * 监听系统主题让变化不经写入直接生效，容纳它得给工厂开三个口子，
 * 那是把工厂做成第二个 store。
 */

import { useSyncExternalStore } from 'react'

export interface PersistedAtomOptions<T> {
  key: string
  fallback: T
  /** 返回 null 表示存的内容非法，落 fallback。 */
  parse: (raw: string) => T | null
  serialize: (value: T) => string
  equals: (a: T, b: T) => boolean
}

export interface PersistedAtom<T> {
  /** 返回模块级引用本身，不做拷贝：对象值的快照一旦每次新建，useSyncExternalStore 会无限重渲。 */
  get(): T
  set(next: T): void
  subscribe(listener: () => void): () => void
  useValue(): T
}

export function createPersistedAtom<T>(options: PersistedAtomOptions<T>): PersistedAtom<T> {
  const { key, fallback, parse, serialize, equals } = options
  const listeners = new Set<() => void>()

  const read = (): T => {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      if (raw == null) return fallback
      return parse(raw) ?? fallback
    } catch {
      return fallback
    }
  }

  let value = read()

  const get = (): T => value

  const set = (next: T): void => {
    if (equals(next, value)) return
    value = next
    try {
      globalThis.localStorage?.setItem(key, serialize(next))
    } catch {
      // 存不下就只在本次会话生效
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const useValue = (): T => useSyncExternalStore(subscribe, get, () => fallback)

  return { get, set, subscribe, useValue }
}
