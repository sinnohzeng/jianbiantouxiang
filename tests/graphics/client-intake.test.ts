import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { BRAND_INDEX, BRAND_CATEGORIES } from '@/graphics/generated/brand-index'
import { isClientPreset, isExactBrand, keepsClearspace } from '@/graphics/client-presets'

const manifest = JSON.parse(readFileSync('assets/brand/clients-202611/manifest.json', 'utf8')) as {
  id: string
  file: string
  sha256: string
}[]

it('新增客户每种形态都指向三份可追溯原稿，生成文件没有丢失或变色', () => {
  expect(manifest).toHaveLength(45)
  for (const item of manifest) {
    const entry = BRAND_INDEX.find((e) => e.id === item.id)
    expect(entry, item.id).toBeDefined()
    expect(isClientPreset(item.id)).toBe(true)
    expect(isExactBrand(item.id)).toBe(true)
    expect(keepsClearspace(item.id)).toBe(item.id.startsWith('dongli-'))
    const source = readFileSync(`assets/brand/clients-202611/${item.file}`)
    expect(createHash('sha256').update(source).digest('hex')).toBe(item.sha256)
    expect(readFileSync(`public/brand/${item.file}`)).toEqual(source)
    for (const variant of ['primary', 'black', 'white'])
      expect(
        manifest.some((m) => m.id === item.id.replace(/-(primary|black|white)$/, `-${variant}`)),
      ).toBe(true)
  }
})

it('新矢量只含静态路径，客户原顺序和字节前置不变', () => {
  for (const item of manifest.filter((m) => m.file.endsWith('.svg'))) {
    const xml = new DOMParser().parseFromString(
      readFileSync(`public/brand/${item.file}`, 'utf8'),
      'image/svg+xml',
    )
    expect(xml.querySelector('parsererror')).toBeNull()
    for (const el of xml.querySelectorAll('*')) {
      expect(['svg', 'g', 'path']).toContain(el.localName)
      for (const attr of el.attributes) {
        expect(attr.name).not.toMatch(/^on|href|style/)
        expect(attr.value).not.toContain('url(')
      }
    }
  }
  expect(BRAND_CATEGORIES.slice(0, 2)).toEqual(['bytedance', 'isv'])
  expect(
    BRAND_INDEX.filter((e) => isClientPreset(e.id) && e.id.endsWith('-white'))
      .slice(0, 4)
      .map((e) => e.id),
  ).toEqual([
    'dongli-symbol-white',
    'dongli-lockup-full-white',
    'dongli-wordmark-bilingual-inline-white',
    'harmay-wordmark-white',
  ])
})
