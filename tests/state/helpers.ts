/**
 * Node 24 在 globalThis 上自带一个未启用的 localStorage 取值器，把 jsdom 注入的那份挡住了，
 * 测试里直接读会拿到 undefined；jsdom 的 Storage 又包了一层 Proxy，spy 挂不上去。
 * 这里换成一份内存实现，行为够用，方法可以被 spy 拦截。
 */
export function installLocalStorage(): Storage {
  const map = new Map<string, string>()
  const fake = {
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

  Object.defineProperty(globalThis, 'localStorage', {
    value: fake,
    configurable: true,
    writable: true,
  })
  return fake
}
