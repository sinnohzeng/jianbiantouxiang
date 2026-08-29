import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRenderCaps, hasWebGL2, resetRenderCaps } from '@/engine/caps'

const CACHE_KEY = 'gradient-avatar:caps:v1'

/** 这套 jsdom 不带 localStorage，缓存分支要自己搭一个内存实现来验。 */
function createMemoryStorage() {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  }
}

let localStorage: ReturnType<typeof createMemoryStorage>

describe('getRenderCaps', () => {
  beforeEach(() => {
    localStorage = createMemoryStorage()
    vi.stubGlobal('localStorage', localStorage)
    resetRenderCaps()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetRenderCaps()
  })

  it('jsdom 下没有 WebGL 也没有可用画布，返回保守值且不抛错', () => {
    const caps = getRenderCaps()
    expect(caps.webgl2).toBe(false)
    expect(caps.maxSize).toBe(2048)
    expect(hasWebGL2()).toBe(false)
  })

  it('探测结果进内存缓存，重复调用不重探', () => {
    const first = getRenderCaps()
    expect(getRenderCaps()).toBe(first)
  })

  it('探测结果写进 localStorage 并带时间戳', () => {
    getRenderCaps()
    const raw = localStorage.getItem(CACHE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? '{}') as { webgl2: boolean; maxSize: number; t: number }
    expect(parsed.maxSize).toBe(2048)
    expect(parsed.webgl2).toBe(false)
    expect(Date.now() - parsed.t).toBeLessThan(5000)
  })

  it('7 天内的缓存直接用，不重新探测', () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ webgl2: true, maxSize: 4096, t: Date.now() - 1000 }),
    )
    const caps = getRenderCaps()
    expect(caps).toEqual({ webgl2: true, maxSize: 4096 })
  })

  it('过期缓存被忽略，回到探测结果', () => {
    const eightDays = 8 * 24 * 60 * 60 * 1000
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ webgl2: true, maxSize: 8192, t: Date.now() - eightDays }),
    )
    expect(getRenderCaps()).toEqual({ webgl2: false, maxSize: 2048 })
  })

  it('缓存内容损坏时当作没有缓存', () => {
    localStorage.setItem(CACHE_KEY, '{"webgl2":"yes"}')
    expect(getRenderCaps()).toEqual({ webgl2: false, maxSize: 2048 })

    resetRenderCaps()
    localStorage.setItem(CACHE_KEY, 'not json at all')
    expect(getRenderCaps()).toEqual({ webgl2: false, maxSize: 2048 })
  })

  it('尺寸小得离谱的缓存不采信', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ webgl2: true, maxSize: 16, t: Date.now() }))
    expect(getRenderCaps().maxSize).toBe(2048)
  })

  it('resetRenderCaps 同时清掉内存与 localStorage', () => {
    getRenderCaps()
    expect(localStorage.getItem(CACHE_KEY)).toBeTruthy()
    resetRenderCaps()
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
  })

  it('宿主根本没有 localStorage 时照常返回结果', () => {
    vi.unstubAllGlobals()
    resetRenderCaps()
    expect(globalThis.localStorage).toBeUndefined()
    expect(getRenderCaps()).toEqual({ webgl2: false, maxSize: 2048 })
  })
})
