/**
 * 新版本的发现与应用。
 *
 * 盯四件事：开发模式不注册；拿到 registration 之后按 UPDATE_POLL_MS 定时复查，
 * 回到前台与窗口聚焦时各补一次；发现新版本只弹提示不自己重载，点了才 skipWaiting；
 * 卸载时定时器与两个监听都摘干净。
 *
 * `virtual:pwa-register`、`sonner` 与 `@/i18n` 都换成假件：这一层要验的是轮询与分支，
 * 不是 workbox 真去拉 sw.js，也不是字典里那几句文案。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { UPDATE_POLL_MS, useServiceWorkerUpdate } from '@/app/sw-update'

const { registerSW, toast, dict } = vi.hoisted(() => ({
  registerSW: vi.fn(),
  toast: vi.fn(),
  // 换语言时把 fn 换掉再 rerender，模拟 useT 给出一个新函数
  dict: { fn: (key: string) => `zh:${key}` },
}))

vi.mock('virtual:pwa-register', () => ({ registerSW }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/i18n', () => ({ useT: () => dict.fn }))

interface RegisterOptions {
  onNeedRefresh?: () => void
  onRegisteredSW?: (url: string, registration?: ServiceWorkerRegistration) => void
}

interface ToastOptions {
  description: string
  duration: number
  action: { label: string; onClick: () => void }
}

/** 只有 update 一个方法的假 registration，轮询打在它身上。 */
function fakeRegistration(): { update: ReturnType<typeof vi.fn> } {
  return { update: vi.fn(() => Promise.resolve()) }
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
}

const updateSW = vi.fn(() => Promise.resolve())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  registerSW.mockReset().mockReturnValue(updateSW)
  toast.mockReset()
  updateSW.mockClear()
  dict.fn = (key: string) => `zh:${key}`
  setHidden(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

/** 挂上 hook 并把 registerSW 收到的回调交出来。默认走生产模式，也就是真会注册那一支。 */
function mount(): {
  options: RegisterOptions
  rerender: () => void
  unmount: () => void
} {
  vi.stubEnv('DEV', false)
  const { rerender, unmount } = renderHook(() => {
    useServiceWorkerUpdate()
  })
  const call = registerSW.mock.calls[0] as [RegisterOptions] | undefined
  return { options: call?.[0] ?? {}, rerender: () => rerender(), unmount }
}

describe('注册时机', () => {
  it('开发模式下不注册，控制台不留 SW 噪音', () => {
    vi.stubEnv('DEV', true)
    renderHook(() => {
      useServiceWorkerUpdate()
    })
    expect(registerSW).not.toHaveBeenCalled()
  })

  it('生产模式下注册一次，两个回调都给上', () => {
    const { options } = mount()
    expect(registerSW).toHaveBeenCalledTimes(1)
    expect(typeof options.onNeedRefresh).toBe('function')
    expect(typeof options.onRegisteredSW).toBe('function')
  })

  it('语言换了也不重新注册，提示文案用的是最新那份字典', () => {
    const { options, rerender } = mount()

    dict.fn = (key: string) => `en:${key}`
    rerender()
    expect(registerSW).toHaveBeenCalledTimes(1)

    options.onNeedRefresh!()
    expect(toast).toHaveBeenCalledWith('en:update.title', expect.anything())
  })
})

describe('复查新版本', () => {
  it('拿不到 registration 就不装定时器，也不装监听', () => {
    const { options } = mount()
    options.onRegisteredSW!('/sw.js', undefined)

    expect(vi.getTimerCount()).toBe(0)
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    // 没有 registration 可查，走到这里不抛就是对的
    expect(vi.getTimerCount()).toBe(0)
  })

  it('按 UPDATE_POLL_MS 定时问一次，不到点不问', () => {
    const { options } = mount()
    const registration = fakeRegistration()
    options.onRegisteredSW!('/sw.js', registration as unknown as ServiceWorkerRegistration)

    vi.advanceTimersByTime(UPDATE_POLL_MS - 1)
    expect(registration.update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(UPDATE_POLL_MS * 2)
    expect(registration.update).toHaveBeenCalledTimes(3)
  })

  it('回到前台补查一次，页面还藏着的时候不查', () => {
    const { options } = mount()
    const registration = fakeRegistration()
    options.onRegisteredSW!('/sw.js', registration as unknown as ServiceWorkerRegistration)

    setHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('窗口重新聚焦也补查一次', () => {
    const { options } = mount()
    const registration = fakeRegistration()
    options.onRegisteredSW!('/sw.js', registration as unknown as ServiceWorkerRegistration)

    window.dispatchEvent(new Event('focus'))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('断网那一次问失败不冒泡，下一轮照问', async () => {
    const { options } = mount()
    const registration = fakeRegistration()
    registration.update.mockRejectedValueOnce(new Error('offline'))
    options.onRegisteredSW!('/sw.js', registration as unknown as ServiceWorkerRegistration)

    vi.advanceTimersByTime(UPDATE_POLL_MS)
    await Promise.resolve()
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(UPDATE_POLL_MS)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })
})

describe('发现新版本', () => {
  it('弹一条不自动消失的提示，不当场重载', () => {
    const { options } = mount()
    options.onNeedRefresh!()

    expect(toast).toHaveBeenCalledTimes(1)
    const [title, extra] = toast.mock.calls[0] as [string, ToastOptions]
    expect(title).toBe('zh:update.title')
    expect(extra.description).toBe('zh:update.body')
    expect(extra.duration).toBe(Number.POSITIVE_INFINITY)
    expect(extra.action.label).toBe('zh:update.action')
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('点了刷新才 skipWaiting 并重载', () => {
    const { options } = mount()
    options.onNeedRefresh!()

    const [, extra] = toast.mock.calls[0] as [string, ToastOptions]
    extra.action.onClick()
    expect(updateSW).toHaveBeenCalledWith(true)
  })
})

describe('卸载', () => {
  it('定时器与两个监听一并摘掉', () => {
    const { options, unmount } = mount()
    const registration = fakeRegistration()
    options.onRegisteredSW!('/sw.js', registration as unknown as ServiceWorkerRegistration)
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(UPDATE_POLL_MS * 3)
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
  })
})
