/**
 * 五份字典的 key 对齐，以及界面里真正用到的 key 都在字典里。
 *
 * `useT` 的 key 类型放宽成了 `I18nKey | (string & {})`，引擎给的 labelKey 这类
 * 动态 key 编译期查不出来，所以这一层靠扫源码补上。
 */

import { describe, expect, it } from 'vitest'
import en from '@/i18n/en.json'
import ja from '@/i18n/ja.json'
import ko from '@/i18n/ko.json'
import zhCN from '@/i18n/zh-CN.json'
import zhHK from '@/i18n/zh-HK.json'
import { LOCALES, translate, type Locale } from '@/i18n'
import { STYLE_LIST } from '@/engine/styles'

const DICTS: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'zh-HK': zhHK,
  en,
  ja,
  ko,
}

// 走 Vite 的 glob 而不是 node:fs，测试环境是 jsdom，tsconfig 也没开 node 类型
const SOURCES: Record<string, string> = import.meta.glob('../../src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** 只收 `t('...')` 这种字面量 key；模板串里的动态 key 由下面按族单独断言。 */
function literalKeys(): Set<string> {
  const keys = new Set<string>()
  for (const code of Object.values(SOURCES)) {
    for (const match of code.matchAll(/\bt\(\s*'([^']+)'/g)) {
      if (match[1]) keys.add(match[1])
    }
  }
  return keys
}

describe('字典对齐', () => {
  it('五份字典的 key 集合完全一致', () => {
    const base = Object.keys(zhCN).sort()
    for (const locale of LOCALES) {
      expect(Object.keys(DICTS[locale]).sort(), locale).toEqual(base)
    }
  })

  it('没有空文案', () => {
    for (const locale of LOCALES) {
      const blank = Object.entries(DICTS[locale])
        .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
        .map(([key]) => key)
      expect(blank, locale).toEqual([])
    }
  })

  it('带占位符的文案在五种语言里占位符一致', () => {
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()
    for (const [key, value] of Object.entries(zhCN)) {
      const expected = placeholders(value)
      for (const locale of LOCALES) {
        expect(placeholders(DICTS[locale][key] ?? ''), `${locale} ${key}`).toEqual(expected)
      }
    }
  })
})

describe('用到的 key 都在字典里', () => {
  it('源码里的字面量 key 都能查到', () => {
    const missing = [...literalKeys()].filter((key) => !(key in zhCN)).sort()
    expect(missing).toEqual([])
  })

  it('质感与滑杆的动态 key 都能查到', () => {
    const dynamic = STYLE_LIST.flatMap((style) => [
      `style.${style.id}.name`,
      `style.${style.id}.desc`,
      ...style.params.map((param) => param.labelKey),
    ])
    expect(dynamic.filter((key) => !(key in zhCN))).toEqual([])
  })

  it('字典里没有的 key 原样返回，不抛错', () => {
    expect(translate('zh-CN', 'not.a.real.key')).toBe('not.a.real.key')
  })
})
