/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import { BRAND_CATEGORIES, BRAND_INDEX } from '@/graphics/generated/brand-index'
import { isClientPreset, isExactBrand } from '@/graphics/client-presets'
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
  expect(manifest).toHaveLength(25)
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

it('稳定ID指向版本化文件，public/brand 与索引一一对应', () => {
  expect(BRAND_INDEX.find((x) => x.id === 'doubao-work')).toMatchObject({
    asset: 'doubao-work-avatar',
    ext: 'png',
  })
  expect(BRAND_INDEX.find((x) => x.id === 'lark')).toMatchObject({
    asset: 'feishu-symbol-202611',
    ext: 'svg',
  })
  const expected = BRAND_INDEX.flatMap((x) => [
    `${x.asset ?? x.id}.${x.ext}`,
    ...(x.white ? [`${x.white}.svg`] : []),
  ])
  expect(readdirSync('public/brand').sort()).toEqual(expected.sort())
  const config = normalizeConfig({
    text: '已保存客户\n协作群',
    layout: {
      icon: { source: 'brand', id: 'doubao-work', mono: true },
      graphic: 0.37,
      offsetY: 0.04,
    },
  })
  expect(config.text).toBe('已保存客户\n协作群')
  expect(config.layout.icon).toMatchObject({ id: 'doubao-work', mono: true })
  expect(config.layout.graphic).toBe(0.37)
})

it('精确原稿判定与索引分类一致：字节、ISV 与客户素材', () => {
  for (const entry of BRAND_INDEX)
    expect(isExactBrand(entry.id), entry.id).toBe(
      entry.category === 'bytedance' || entry.category === 'isv' || isClientPreset(entry.id),
    )
})

it('ISV 分组紧跟字节分组，源文件与哈希清单一致', () => {
  expect(BRAND_CATEGORIES.slice(0, 2)).toEqual(['bytedance', 'isv'])
  const dir = 'assets/brand/isv/'
  const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')) as {
    id: string
    file: string
    source: string
    sha256: string
  }[]
  const entries = BRAND_INDEX.filter((x) => x.category === 'isv')
  expect(entries.map((x) => x.id)).toEqual(manifest.map((x) => x.id))
  for (const x of manifest) {
    const bytes = readFileSync(dir + x.file)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(x.sha256)
    // PNG 签名与 RGBA 色彩类型：透明底素材才能叠在渐变上
    expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
    expect(bytes[25]).toBe(6)
  }
  expect(readdirSync(dir).sort()).toEqual(
    [...manifest.map((x) => x.file), 'manifest.json', 'README.md'].sort(),
  )
})
