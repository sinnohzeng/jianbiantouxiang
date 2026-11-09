/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import { BRAND_CATEGORIES, BRAND_INDEX } from '@/graphics/generated/brand-index'
import { normalizeConfig } from '@/state/config'

it('字节分组优先豆包工作、飞书、豆包，所有旧ID继续有效', () => {
  expect(BRAND_CATEGORIES[0]).toBe('bytedance')
  const entries = BRAND_INDEX.filter((x) => x.category === 'bytedance')
  expect(entries.map((x) => x.id).slice(0, 8)).toEqual([
    'doubao-work',
    'bd-doubao-work-black',
    'bd-doubao-work-white',
    'lark',
    'bd-feishu-color',
    'bd-feishu-black',
    'bd-feishu-white',
    'bd-doubao-color',
  ])
  expect(new Set(BRAND_INDEX.map((x) => x.id)).size).toBe(BRAND_INDEX.length)
  for (const id of [
    'doubao-work',
    'lark',
    'tiktok',
    'harmay-wordmark-white',
    'dongli-symbol-white',
  ]) {
    expect(BRAND_INDEX.some((x) => x.id === id)).toBe(true)
    expect(
      normalizeConfig({ layout: { icon: { source: 'brand', id, mono: false } } }).layout.icon.id,
    ).toBe(id)
  }
})

it('精选源文件与哈希清单一致，仅包含网页Logo及说明', () => {
  const dir = 'assets/brand/bytedance/'
  const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')) as {
    id: string
    file: string
    sha256: string
  }[]
  expect(manifest).toHaveLength(23)
  for (const x of manifest) {
    expect(
      createHash('sha256')
        .update(readFileSync(dir + x.file))
        .digest('hex'),
    ).toBe(x.sha256)
    expect(BRAND_INDEX.find((e) => e.id === x.id)?.category).toBe('bytedance')
  }
  expect(readdirSync(dir).sort()).toEqual(
    [...manifest.map((x) => x.file), 'manifest.json', 'README.md'].sort(),
  )
})
