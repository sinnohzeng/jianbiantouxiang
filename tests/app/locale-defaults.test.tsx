/**
 * 示例文字与默认字体跟随界面语言的接管边界。
 *
 * 三条回归都在这里：用户输入不能被示例文字顶掉、默认字体要按语言选、
 * 懒加载语言到货前不许先写一遍英文。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { I18nProvider, LOCALE_STORAGE_KEY, useLocale, type Locale } from '@/i18n'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
import { stopConfigSync, useAvatarStore } from '@/state/store'
import { LocaleDefaults } from '@/App'

/** 让用例能改初始配置来自哪一档，store 本体仍是真的。 */
const source = vi.hoisted(() => ({ value: 'default' as 'storage' | 'default' }))

vi.mock('@/state/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/state/store')>()
  return { ...actual, initialConfigSource: () => source.value }
})

let switchLocale: ((next: Locale) => void) | null = null

/** 把切换语言的入口递出来，用例里直接调，不必再找顶栏那个按钮。 */
function LocaleHandle() {
  const { setLocale } = useLocale()
  useEffect(() => {
    switchLocale = setLocale
  }, [setLocale])
  return null
}

function mount() {
  return render(
    <I18nProvider>
      <LocaleDefaults />
      <LocaleHandle />
    </I18nProvider>,
  )
}

function config(): AvatarConfig {
  return useAvatarStore.getState().config
}

function setText(text: string): void {
  act(() => {
    useAvatarStore.getState().setConfig({ text })
  })
}

beforeEach(() => {
  // 落盘与 URL 同步是 300 ms 防抖，用例里只会留下没人接的定时器
  stopConfigSync()
  source.value = 'default'
  switchLocale = null
  useAvatarStore.setState({ config: DEFAULT_CONFIG, history: [] })
})

afterEach(() => {
  cleanup()
})

describe('默认字体跟随界面语言', () => {
  it('英文界面同时换掉示例文字与字体', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    mount()

    expect(config().text).toBe('Hello')
    expect(config().typography.fontFamily).toBe('Inter')
    // Inter 提供 100 到 900，700 原样保留
    expect(config().typography.fontWeight).toBe(700)
  })

  it('简体中文界面维持默认的 Noto Sans SC，一次都不写 store', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    const writes: AvatarConfig[] = []
    const stop = useAvatarStore.subscribe((state, prev) => {
      if (state.config !== prev.config) writes.push(state.config)
    })

    mount()
    stop()

    expect(config().text).toBe(DEFAULT_CONFIG.text)
    expect(config().typography.fontFamily).toBe('Noto Sans SC')
    expect(writes).toHaveLength(0)
  })

  it('切到韩语时换成 Noto Sans KR，谚文不再落在简体字体上', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    mount()

    act(() => {
      switchLocale?.('ko')
    })

    await waitFor(() => {
      expect(config().typography.fontFamily).toBe('Noto Sans KR')
    })
    expect(config().text).toBe('안녕')
  })

  it('用户自己选过字体后不再跟随语言', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    act(() => {
      useAvatarStore.getState().setTypography({ fontFamily: 'ZCOOL KuaiLe' })
    })
    mount()

    act(() => {
      switchLocale?.('en')
    })

    expect(config().typography.fontFamily).toBe('ZCOOL KuaiLe')
    // 文字没被动过，仍跟着语言走
    expect(config().text).toBe('Hello')
  })

  it('配置来自本机存档时文字与字体一个都不改', () => {
    source.value = 'storage'
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    mount()

    expect(config().text).toBe(DEFAULT_CONFIG.text)
    expect(config().typography.fontFamily).toBe('Noto Sans SC')
  })
})

describe('用户输入不被示例文字顶掉', () => {
  it('简体中文界面下输入 Hello 能留住', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    mount()

    setText('Hello')

    expect(config().text).toBe('Hello')
  })

  it('英文界面下输入“猪猪家族”能留住', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    mount()
    expect(config().text).toBe('Hello')

    setText('猪猪家族')

    expect(config().text).toBe('猪猪家族')
  })

  it('打过字之后再切语言也不会被顶掉', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    mount()

    setText('猪猪老公')
    act(() => {
      switchLocale?.('ko')
    })
    await waitFor(() => {
      expect(config().typography.fontFamily).toBe('Noto Sans KR')
    })

    expect(config().text).toBe('猪猪老公')
  })

  it('reset 回到默认档后重新跟随语言', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    mount()

    setText('猪猪老公')
    expect(config().text).toBe('猪猪老公')

    act(() => {
      useAvatarStore.getState().reset()
    })

    expect(config().text).toBe('Hello')
    expect(config().typography.fontFamily).toBe('Inter')
  })
})

describe('懒加载语言的字典到货前不写', () => {
  it('日语首屏不闪英文，文字与字体一次写完', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ja')
    const writes: AvatarConfig[] = []
    const stop = useAvatarStore.subscribe((state, prev) => {
      if (state.config !== prev.config) writes.push(state.config)
    })

    mount()

    // 字典是独立 chunk，这一刻还没到货，什么都不该写
    expect(writes).toHaveLength(0)
    expect(config().text).toBe(DEFAULT_CONFIG.text)

    await waitFor(() => {
      expect(config().text).toBe('こんにちは')
    })
    stop()

    expect(config().typography.fontFamily).toBe('Noto Sans JP')
    expect(writes.map((item) => item.text)).toEqual(['こんにちは'])
  })
})
