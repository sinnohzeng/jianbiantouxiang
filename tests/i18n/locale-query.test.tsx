/**
 * URL 上的 ?lang= 只当一次性入口：首屏认下之后写进 localStorage 并从地址栏摘掉。
 *
 * 盯的是：用户在顶栏切过语言，刷新不会被链接里的旧值顶回去；地址栏上其余参数与锚点原样保留。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  I18nProvider,
  LOCALE_STORAGE_KEY,
  consumeLocaleQuery,
  detectLocale,
  useLocale,
} from '@/i18n'
import { memoryStorage } from '../setup'

/** 直接摆好地址栏，jsdom 里改 location 只能走 history。 */
function setUrl(url: string): void {
  window.history.replaceState(null, '', url)
}

function LocaleProbe() {
  const { locale, setLocale } = useLocale()
  return (
    <button type="button" onClick={() => setLocale('en')}>
      {locale}
    </button>
  )
}

beforeEach(() => {
  setUrl('/')
})

afterEach(() => {
  cleanup()
})

describe('consumeLocaleQuery', () => {
  it('认下 lang 带的语言并写进 localStorage', () => {
    setUrl('/?lang=ja')
    expect(consumeLocaleQuery()).toBe('ja')
    expect(memoryStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ja')
  })

  it('摘掉 lang，其余查询串与锚点原样保留', () => {
    setUrl('/?probe=1&lang=ja&x=2#about')
    consumeLocaleQuery()
    expect(window.location.search).toBe('?probe=1&x=2')
    expect(window.location.hash).toBe('#about')
  })

  it('只有 lang 一个参数时问号一并去掉', () => {
    setUrl('/?lang=ko#about')
    consumeLocaleQuery()
    expect(window.location.search).toBe('')
    expect(window.location.href).toContain('#about')
  })

  it('认不出的取值照样摘掉，但不写 localStorage', () => {
    setUrl('/?lang=de')
    expect(consumeLocaleQuery()).toBeNull()
    expect(window.location.search).toBe('')
    expect(memoryStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('地址栏本来就没有 lang 时什么都不动', () => {
    setUrl('/?probe=1')
    expect(consumeLocaleQuery()).toBeNull()
    expect(window.location.search).toBe('?probe=1')
  })

  it('消费之后刷新走 localStorage，不再被链接里的旧值顶回去', () => {
    setUrl('/?lang=zh-HK')
    expect(detectLocale()).toBe('zh-HK')
    consumeLocaleQuery()
    memoryStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    // 再次 detectLocale 相当于刷新后重走一遍初始化
    expect(detectLocale()).toBe('en')
  })

  it('消费之后地址栏不再带 lang', () => {
    setUrl('/?lang=zh-CN')
    expect(window.location.search).toContain('lang=zh-CN')
    consumeLocaleQuery()
    expect(window.location.search).not.toContain('lang=')
  })
})

describe('I18nProvider 与 setLocale', () => {
  it('挂载时按 lang 起语言，随后把参数从地址栏摘掉', async () => {
    setUrl('/?lang=ja&probe=1')
    await act(async () => {
      render(
        <I18nProvider>
          <LocaleProbe />
        </I18nProvider>,
      )
    })
    expect(screen.getByRole('button').textContent).toBe('ja')
    expect(window.location.search).toBe('?probe=1')
  })

  it('顶栏切过语言之后，刷新跟着新语言走，地址栏不再带 lang', async () => {
    setUrl('/?lang=zh-CN#about')
    await act(async () => {
      render(
        <I18nProvider>
          <LocaleProbe />
        </I18nProvider>,
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(screen.getByRole('button').textContent).toBe('en')
    expect(memoryStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(window.location.search).toBe('')
    // 刷新
    expect(detectLocale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
