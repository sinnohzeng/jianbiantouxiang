#!/usr/bin/env node
/**
 * 内置品牌图形生成器。
 *
 * 清单 scripts/brand-list.json 是唯一真源：远端条目按 `source + id + '.svg'` 从
 * homarr-labs/dashboard-icons 拉取，带 file 的条目从 assets/brand 拷贝（owner 提供的官方素材）。
 * 两类都落到 public/brand/<id>.<ext>，并生成 src/graphics/generated/brand-index.ts。
 *
 * 落盘前 SVG 过一遍 inlineClassStyles：上游不少文件把填色写在 <style> 的类规则里，
 * 而运行时的 sanitizeSvg 不放行 <style> 元素，不内联的话画出来是纯黑。
 *
 * 生成物勿手改，改完清单跑 npm run gen:brand。
 * 可选 --cache <dir>：先在该目录找 <name>.svg，找不到才走网络，断网也能重跑。
 */

import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { inlineClassStyles } from '../build/brand-svg.ts'

const root = path.resolve(import.meta.dirname, '..')
const listPath = path.join(root, 'scripts/brand-list.json')
const outputDir = path.join(root, 'public/brand')
const indexPath = path.join(root, 'src/graphics/generated/brand-index.ts')
const generator = 'npm run gen:brand'

function cacheDirOf(argv) {
  const at = argv.indexOf('--cache')
  if (at < 0) return null
  const dir = argv[at + 1]
  if (!dir) throw new Error('--cache 后面要跟目录')
  return path.resolve(process.cwd(), dir)
}

const cacheDir = cacheDirOf(process.argv.slice(2))

/** 远端 SVG：命中缓存目录就用本地那份，否则拉网络。 */
async function fetchSvg(source, name) {
  if (cacheDir) {
    try {
      return await readFile(path.join(cacheDir, `${name}.svg`), 'utf8')
    } catch {
      // 缓存里没有就落回网络，不当错误
    }
  }
  const url = `${source}${name}.svg`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} 返回 ${response.status}`)
  return await response.text()
}

/** SVG 一律内联类规则再落盘；PNG 原样拷贝。 */
async function writeSvg(target, svg) {
  await writeFile(target, inlineClassStyles(svg))
}

async function copyAsset(from, to) {
  if (from.toLowerCase().endsWith('.svg')) {
    await writeSvg(to, await readFile(from, 'utf8'))
    return
  }
  await copyFile(from, to)
}

/** 只允许清单里出现文件名安全的 id，拼路径时不会跑出 public/brand。 */
function assertSafeName(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`品牌 id 不合法：${name}`)
  return name
}

const list = JSON.parse(await readFile(listPath, 'utf8'))
const categories = list.categories
const known = new Set(categories)

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

const entries = []
let fetched = 0
let copied = 0

for (const brand of list.brands) {
  const id = assertSafeName(brand.id)
  if (!known.has(brand.category)) throw new Error(`${id} 的类别不在清单里：${brand.category}`)

  const ext = brand.file ? path.extname(brand.file).slice(1).toLowerCase() : 'svg'
  if (ext !== 'svg' && ext !== 'png') throw new Error(`${id} 的扩展名不支持：${ext}`)

  if (brand.file) {
    await copyAsset(path.join(root, brand.file), path.join(outputDir, `${id}.${ext}`))
    copied += 1
  } else {
    await writeSvg(path.join(outputDir, `${id}.svg`), await fetchSvg(list.source, id))
    fetched += 1
  }

  if (brand.white) {
    const white = assertSafeName(brand.white)
    if (brand.whiteFile) {
      await copyAsset(path.join(root, brand.whiteFile), path.join(outputDir, `${white}.svg`))
      copied += 1
    } else {
      await writeSvg(path.join(outputDir, `${white}.svg`), await fetchSvg(list.source, white))
      fetched += 1
    }
  }

  entries.push({
    id,
    zh: brand.zh,
    en: brand.en,
    aliases: brand.aliases ?? [],
    category: brand.category,
    ext,
    white: brand.white,
  })
}

// 索引按清单里的类别顺序排，选择器直接顺着渲染分组，不必再排一次
const order = new Map(categories.map((category, index) => [category, index]))
entries.sort((a, b) => (order.get(a.category) ?? 0) - (order.get(b.category) ?? 0))

function serializeEntry(entry) {
  const fields = [
    `id: ${JSON.stringify(entry.id)}`,
    `zh: ${JSON.stringify(entry.zh)}`,
    `en: ${JSON.stringify(entry.en)}`,
    `aliases: [${entry.aliases.map((alias) => JSON.stringify(alias)).join(', ')}]`,
    `category: ${JSON.stringify(entry.category)}`,
    `ext: ${JSON.stringify(entry.ext)}`,
  ]
  if (entry.white) fields.push(`white: ${JSON.stringify(entry.white)}`)
  return `  { ${fields.join(', ')} },`
}

const source = `/**
 * 由 ${generator} 生成，不要手改。
 * 远端条目来自 homarr-labs/dashboard-icons，Apache-2.0；商标归各品牌所有。
 * 带 file 的条目来自 assets/brand，是 owner 提供的官方素材。
 */

export type BrandCategory = ${categories.map((category) => JSON.stringify(category)).join(' | ')}

export interface BrandEntry {
  readonly id: string
  readonly zh: string
  readonly en: string
  readonly aliases: readonly string[]
  readonly category: BrandCategory
  readonly ext: 'svg' | 'png'
  /** 纯白单色变体的文件名。渐变底上默认用它，没有就退回原色。 */
  readonly white?: string
}

export const BRAND_CATEGORIES: readonly BrandCategory[] = [
${categories.map((category) => `  ${JSON.stringify(category)},`).join('\n')}
]

export const BRAND_INDEX: readonly BrandEntry[] = [
${entries.map(serializeEntry).join('\n')}
]
`

await writeFile(indexPath, source)

const files = entries.length + entries.filter((entry) => entry.white).length
console.log(`brand: ${entries.length} 个品牌，${files} 个文件（远端 ${fetched}，本地 ${copied}）`)
