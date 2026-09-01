import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { lucideIconEntries, serializeLucideIcons, type LucideIconSource } from '../build/icon-index.ts'
import { CURATED_ICONS } from '../src/graphics/curated.ts'

const iconsDir = path.resolve(import.meta.dirname, '../node_modules/lucide-react/dist/esm/icons')
const outputDir = path.resolve(import.meta.dirname, '../src/graphics/generated')
const generator = 'npm run gen:icons'

interface IconModule {
  __iconNode?: unknown
}

function isNode(value: unknown): value is readonly (readonly [string, Record<string, string>])[] {
  return Array.isArray(value) && value.length > 0 && value.every(Array.isArray)
}

const files = (await readdir(iconsDir)).filter((file) => file.endsWith('.mjs'))
const sources: LucideIconSource[] = []
for (const file of files) {
  const source = await readFile(path.join(iconsDir, file), 'utf8')
  // 别名文件只有 re-export，主文件才有 __iconNode；只收主图标，避免同一图形重复出现
  if (!source.includes('__iconNode')) continue
  const name = file.slice(0, -'.mjs'.length)
  const module = (await import(pathToFileURL(path.join(iconsDir, file)).href)) as IconModule
  if (!isNode(module.__iconNode)) throw new Error(`${file} 的 __iconNode 不认识`)
  sources.push({ name, node: module.__iconNode })
}

const entries = lucideIconEntries(sources)
const entryNames = new Set(entries.map((entry) => entry.name))
const missing = CURATED_ICONS.filter((icon) => !entryNames.has(icon.name))
const curatedNames = new Set(CURATED_ICONS.map((icon) => icon.name))
if (missing.length > 0) throw new Error(`精选图标不存在：${missing.map((icon) => icon.name).join(', ')}`)
const curated = entries.filter((entry) => curatedNames.has(entry.name))

await mkdir(outputDir, { recursive: true })
await writeFile(
  path.join(outputDir, 'lucide-full.ts'),
  serializeLucideIcons(entries, 'LUCIDE_ICONS', generator),
)
await writeFile(
  path.join(outputDir, 'lucide-curated.ts'),
  serializeLucideIcons(curated, 'LUCIDE_CURATED', generator),
)
console.log(`lucide: full ${entries.length}, curated ${curated.length}`)
