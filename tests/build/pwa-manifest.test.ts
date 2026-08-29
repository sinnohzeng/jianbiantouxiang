/**
 * PWA manifest 的多语言产物。
 *
 * 盯三件事：文案确实来自 `src/i18n` 的字典而不是硬编码；五份 manifest 除了语言字段以外完全一致，
 * 也就是同一个应用的五种身份；默认语言那份与多语言化之前的产物逐字段相同，装过的用户不会看到名字变。
 */

import { describe, expect, it } from 'vitest'
import en from '@/i18n/en.json'
import ja from '@/i18n/ja.json'
import ko from '@/i18n/ko.json'
import zhCN from '@/i18n/zh-CN.json'
import zhHK from '@/i18n/zh-HK.json'
import { LOCALES } from '@/i18n'
import {
  DEFAULT_MANIFEST_LOCALE,
  MANIFEST_LOCALES,
  localizedManifest,
  localizedManifestFiles,
  manifestFileName,
  resolveManifestLocale,
  type DictReader,
  type LocalizedManifest,
  type ManifestLocale,
} from '../../build/pwa-manifest'

const DICTS: Record<ManifestLocale, Record<string, string>> = {
  'zh-CN': zhCN,
  'zh-HK': zhHK,
  en,
  ja,
  ko,
}

const readDict: DictReader = (locale) => DICTS[locale]

const LANGUAGE_FIELDS: readonly string[] = ['name', 'short_name', 'description', 'lang']

/** 语言字段之外的部分，五份 manifest 应当完全相同。 */
function languageAgnostic(manifest: LocalizedManifest): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(manifest).filter(([key]) => !LANGUAGE_FIELDS.includes(key)),
  )
}

describe('语言集合', () => {
  it('与 src/i18n 的语言列表一致', () => {
    expect([...MANIFEST_LOCALES].sort()).toEqual([...LOCALES].sort())
  })

  it('默认语言是简体中文，与 index.html 的 html lang 一致', () => {
    expect(DEFAULT_MANIFEST_LOCALE).toBe('zh-CN')
  })
})

describe('文案来自字典', () => {
  it('五种语言各取各自字典里的对应文案', () => {
    for (const locale of MANIFEST_LOCALES) {
      const manifest = localizedManifest(locale, readDict)
      const dict = DICTS[locale]
      expect(manifest.name, locale).toBe(dict['app.title'])
      expect(manifest.short_name, locale).toBe(dict['app.shortName'] ?? dict['app.name'])
      expect(manifest.description, locale).toBe(dict['app.description'])
      expect(manifest.lang, locale).toBe(locale)
    }
  })

  it('字典里没有 app.shortName 时，short_name 落到 app.name', () => {
    const withoutShortName: DictReader = (locale) => {
      const dict = { ...DICTS[locale] }
      delete dict['app.shortName']
      return dict
    }
    expect(localizedManifest('ja', withoutShortName).short_name).toBe(ja['app.name'])
  })

  it('非默认语言的文案确实换掉了，不是中文兜底', () => {
    const zh = localizedManifest('zh-CN', readDict)
    for (const locale of MANIFEST_LOCALES.filter((item) => item !== 'zh-CN')) {
      const manifest = localizedManifest(locale, readDict)
      expect(manifest.name, locale).not.toBe(zh.name)
      expect(manifest.short_name, locale).not.toBe(zh.short_name)
      expect(manifest.description, locale).not.toBe(zh.description)
    }
  })

  it('字典缺 key 或文案为空就抛错，错误信息带上语言与 key', () => {
    const blank: DictReader = () => ({ ...zhCN, 'app.shortName': '   ', 'app.name': '' })
    expect(() => localizedManifest('ja', blank)).toThrow(/ja/)
    expect(() => localizedManifest('ja', blank)).toThrow(/app\.shortName/)

    const missing: DictReader = () => ({})
    expect(() => localizedManifest('en', missing)).toThrow(/app\.title/)
  })
})

describe('五份 manifest 描述同一个应用', () => {
  it('语言字段之外的部分完全一致', () => {
    const base = languageAgnostic(localizedManifest(DEFAULT_MANIFEST_LOCALE, readDict))
    for (const locale of MANIFEST_LOCALES) {
      expect(languageAgnostic(localizedManifest(locale, readDict)), locale).toEqual(base)
    }
  })

  it('id 与 start_url 一致，切语言不会多装出一个应用', () => {
    for (const locale of MANIFEST_LOCALES) {
      const manifest = localizedManifest(locale, readDict)
      expect(manifest.id, locale).toBe(manifest.start_url)
    }
  })

  it('安装必需的字段齐全，且带一张 maskable 图标', () => {
    const manifest = localizedManifest('ko', readDict)
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.dir).toBe('ltr')
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('512x512')
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })
})

describe('默认语言那份与多语言化之前的产物一致', () => {
  it('name、short_name、description 逐字未变', () => {
    const manifest = localizedManifest('zh-CN', readDict)
    expect(manifest.name).toBe('渐变头像生成器 · Gradient Avatar')
    expect(manifest.short_name).toBe('渐变头像')
    expect(manifest.description).toBe(
      '纯前端的渐变头像生成器。选配色与质感，导出可直接用作群聊、账号与部门标识的图片。',
    )
  })

  it('主题色与分类未变', () => {
    const manifest = localizedManifest('zh-CN', readDict)
    expect(manifest.theme_color).toBe('#fbf9f6')
    expect(manifest.background_color).toBe('#fbf9f6')
    expect(manifest.categories).toEqual(['graphics', 'utilities', 'productivity'])
  })
})

describe('产物文件', () => {
  it('每种语言一份，文件名按语言拼且互不重名', () => {
    const files = localizedManifestFiles(readDict)
    expect(files).toHaveLength(MANIFEST_LOCALES.length)
    const names = files.map((file) => file.fileName)
    expect(new Set(names).size).toBe(names.length)
    for (const locale of MANIFEST_LOCALES) {
      expect(names).toContain(`manifest.${locale}.webmanifest`)
      expect(manifestFileName(locale)).toBe(`manifest.${locale}.webmanifest`)
    }
  })

  it('内容是能解析回来的 JSON，且与 localizedManifest 一致', () => {
    for (const file of localizedManifestFiles(readDict)) {
      const locale = file.fileName.slice('manifest.'.length, -'.webmanifest'.length)
      expect(JSON.parse(file.source)).toEqual(localizedManifest(locale as ManifestLocale, readDict))
      expect(file.source).not.toContain('\n')
    }
  })
})

describe('构建期的语言参数', () => {
  it('认识的语言原样用', () => {
    expect(resolveManifestLocale('ja')).toBe('ja')
    expect(resolveManifestLocale(' zh-HK ')).toBe('zh-HK')
  })

  it('没设、空串或不认识的值都落到默认语言', () => {
    expect(resolveManifestLocale(undefined)).toBe(DEFAULT_MANIFEST_LOCALE)
    expect(resolveManifestLocale('')).toBe(DEFAULT_MANIFEST_LOCALE)
    expect(resolveManifestLocale('  ')).toBe(DEFAULT_MANIFEST_LOCALE)
    expect(resolveManifestLocale('fr')).toBe(DEFAULT_MANIFEST_LOCALE)
    expect(resolveManifestLocale('zh-TW')).toBe(DEFAULT_MANIFEST_LOCALE)
  })
})
