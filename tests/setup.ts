/**
 * vitest 全局前置，由 vite.config.ts 的 test.setupFiles 加载。
 *
 * Node 24 在 globalThis 上挂了一个未启用的 localStorage 取值器，把 jsdom 注入的那份挡住，
 * 测试里直接读只会拿到 undefined；jsdom 自己那份又包了一层 Proxy，spy 挂不上去。
 * 这里统一换成一份内存实现，三处各写一遍的 stub 收敛到这一份。
 *
 * 全程只装一个实例，用例之间只清空内容，测试文件因此可以在模块顶层引用它并 spy 方法。
 * 要验“宿主根本没有 localStorage”的分支，在用例里 `vi.stubGlobal('localStorage', undefined)`。
 *
 * jsdom 没有 IntersectionObserver。这里装一个惰性替身，observe 之后从不回调，
 * 字体选择器的行因此不会发预览请求；要验预览链路的用例自己 `vi.stubGlobal` 一个会回调的。
 */

import { beforeEach } from 'vitest'

export function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => {
      map.clear()
    },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value))
    },
  } as Storage
}

/** 装在 globalThis 上的那一份。断言写入内容或 spy 方法时直接引用它。 */
export const memoryStorage: Storage = createMemoryStorage()

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
})

class InertIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly scrollMargin = '0px'
  readonly thresholds = [0]
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: InertIntersectionObserver,
  configurable: true,
  writable: true,
})

beforeEach(() => {
  memoryStorage.clear()
})
