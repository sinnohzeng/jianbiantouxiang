/**
 * 五份字典的 key 对齐，字典与源码双向对得上，keys.md 与源语言字典同步。
 *
 * `useT` 的 key 类型放宽成了 `I18nKey | (string & {})`，引擎给的 labelKey 这类
 * 动态 key 编译期查不出来，所以这一层靠扫源码补上。
 * 反向那条断言管的是另一头：字典里躺着没人用的文案，五种语言乘下来就是几百条翻译白做。
 */

import { describe, expect, it } from 'vitest'
import en from '@/i18n/en.json'
import ja from '@/i18n/ja.json'
import ko from '@/i18n/ko.json'
import zhCN from '@/i18n/zh-CN.json'
import zhHK from '@/i18n/zh-HK.json'
import { LOCALES, dictOf, loadDict, translate, type Locale } from '@/i18n'
import { STYLE_LIST } from '@/engine/styles'
import { CURATED_ICON_CATEGORIES } from '@/graphics/curated'
import { EMOJI_GROUPS } from '@/graphics/emoji-index'
import { ANCHORS, SIZE_TARGETS, TEXT_EFFECTS } from '@/state/config'

const DICTS: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'zh-HK': zhHK,
  en,
  ja,
  ko,
}

// 走 Vite 的 glob 而不是 node:fs，测试环境是 jsdom，tsconfig 也没开 node 类型
const SOURCES: Record<string, string> = {
  ...import.meta.glob<string>('../../src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  // 构建期也在读字典：manifest 的名称与描述取自 app.* 那几条
  ...import.meta.glob<string>('../../build/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
}

// keys.md 是手写维护的 key 清单，靠下面这条断言盯着它别跟字典漂开
const DOCS: Record<string, string> = import.meta.glob('../../src/i18n/*.md', {
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

/**
 * 源码里以整串形式出现过的 key。除了 `t('...')`，还有 TopBar 的 `'theme.dark'`、
 * FontPicker 的 `'font.curated.sc'`、ExportDrawer 的 `setNotice('export.downloaded')`
 * 这类先存进常量或变量、再交给 `t` 的写法。
 */
function referencedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const code of Object.values(SOURCES)) {
    for (const match of code.matchAll(/['"`]([A-Za-z][\w.-]*)['"`]/g)) {
      if (match[1]) keys.add(match[1])
    }
  }
  return keys
}

/**
 * 模板拼出来的 key，扫源码扫不到，按取值域在这里逐族展开。
 * 新增这类拼接时一并补进来，不然反向断言会把整族当成死文案。
 */
function dynamicKeys(): string[] {
  return [
    // StylePanel 的 style.<id>.name / .desc 与滑杆 labelKey
    ...STYLE_LIST.flatMap((style) => [
      `style.${style.id}.name`,
      `style.${style.id}.desc`,
      ...style.params.map((param) => param.labelKey),
    ]),
    ...TEXT_EFFECTS.map((effect) => `panel.text.effect.${effect}`),
    ...ANCHORS.map((anchor) => `panel.text.anchor.${anchor}`),
    ...SIZE_TARGETS.map((target) => `export.size.${target}`),
    ...CURATED_ICON_CATEGORIES.map((category) => `icon.category.${category}`),
    ...EMOJI_GROUPS.map((group) => `icon.emoji.group.${group}`),
    // ExportDrawer 的 setNotice(`export.${result}`)，取值来自 shareBlob 的返回
    'export.shared',
    'export.cancelled',
    'export.downloaded',
  ]
}

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

describe('字典按需加载', () => {
  it('未加载的语言先落到英文，loadDict 之后才是本语言', async () => {
    // zh-CN 与 en 静态打包，其余三份是独立 chunk，本用例走的就是那条路径
    expect(dictOf('ko')).toBeNull()
    expect(translate('ko', 'app.name')).toBe(en['app.name'])

    await loadDict('ko')

    expect(dictOf('ko')).not.toBeNull()
    expect(translate('ko', 'app.name')).toBe(ko['app.name'])
  })

  it('静态那两份一开始就在手上', () => {
    expect(dictOf('zh-CN')).not.toBeNull()
    expect(dictOf('en')).not.toBeNull()
  })
})

describe('字典里没有没人用的 key', () => {
  it('每条文案都能在源码里找到出处', () => {
    const used = new Set([...referencedKeys(), ...dynamicKeys()])
    const orphan = Object.keys(zhCN)
      .filter((key) => !used.has(key))
      .sort()
    expect(orphan).toEqual([])
  })
})

describe('keys.md 与源语言字典同步', () => {
  const doc = Object.entries(DOCS).find(([path]) => path.endsWith('keys.md'))?.[1] ?? ''

  /** 解析清单表格：一行一条 `| \`key\` | zh-CN 取值 |`。 */
  const rows = new Map<string, string>(
    [...doc.matchAll(/^\| `([^`]+)` +\| +(.*?) +\|$/gm)].map((match) => [
      match[1] ?? '',
      (match[2] ?? '').trim().replace(/\\n/g, '\n'),
    ]),
  )

  it('清单不为空，格式没被改坏', () => {
    expect(rows.size).toBeGreaterThan(0)
  })

  it('key 名双向一致', () => {
    expect([...rows.keys()].sort()).toEqual(Object.keys(zhCN).sort())
  })

  it('每一行的取值与 zh-CN.json 一致', () => {
    const drifted = [...rows.entries()]
      .filter(([key, value]) => key in zhCN && zhCN[key as keyof typeof zhCN] !== value)
      .map(([key]) => key)
    expect(drifted).toEqual([])
  })
})
