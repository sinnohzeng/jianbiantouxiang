import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildEmojiIndex,
  serializeEmojiBase,
  serializeEmojiLabels,
  type RawEmojiEntry,
} from '../build/emoji-index.ts'

const version = '15.0.0'
const outputDir = path.resolve(import.meta.dirname, '../src/graphics/generated')
const generator = 'npm run gen:emoji'
const locales = {
  'zh-CN': 'zh',
  'zh-HK': 'zh-hant',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
} as const

type Locale = keyof typeof locales
const canonicalLocale: Locale = 'zh-CN'

async function fetchEntries(locale: string): Promise<RawEmojiEntry[]> {
  const url = `https://cdn.jsdelivr.net/npm/emojibase-data@${version}/${locale}/data.json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} 返回 ${response.status}`)
  return (await response.json()) as RawEmojiEntry[]
}

await mkdir(outputDir, { recursive: true })
const canonical = buildEmojiIndex(await fetchEntries(locales[canonicalLocale]))
await writeFile(
  path.join(outputDir, 'emoji-base.ts'),
  serializeEmojiBase(canonical.base, generator),
)
await writeFile(
  path.join(outputDir, 'emoji-labels.zh-CN.ts'),
  serializeEmojiLabels(canonical.labels, generator),
)

for (const locale of Object.keys(locales).filter((key) => key !== canonicalLocale) as Locale[]) {
  const next = buildEmojiIndex(await fetchEntries(locales[locale]))
  const same =
    next.base.length === canonical.base.length &&
    next.base.every((entry, index) => entry[0] === canonical.base[index]?.[0])
  if (!same) throw new Error(`${locale} 的 emoji 集合与 zh-CN 不一致`)
  await writeFile(
    path.join(outputDir, `emoji-labels.${locale}.ts`),
    serializeEmojiLabels(next.labels, generator),
  )
}

console.log(`emoji: ${canonical.base.length} entries, ${Object.keys(locales).length} locales`)
