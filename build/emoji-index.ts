export interface RawEmojiEntry {
  hexcode: string
  emoji: string
  group?: number
  order?: number
  label?: string
  tags?: string[]
}

export type EmojiBaseEntry = readonly [id: string, emoji: string, group: number, order: number]
export type EmojiLabelEntry = readonly [label: string, tags?: readonly string[]]

/** emojibase 的 hexcode 转 Noto 文件名 id：去 FE0F/FE0E，用下划线连接。 */
export function emojiIdOf(hexcode: string): string | null {
  const normalized = hexcode.trim().toLowerCase()
  if (!/^[0-9a-f]+(?:-[0-9a-f]+)*$/.test(normalized)) return null
  const parts = normalized
    .split('-')
    .filter((part) => part !== 'fe0f' && part !== 'fe0e')
  return parts.length > 0 ? parts.join('_') : null
}

function isUsable(entry: RawEmojiEntry): boolean {
  return (
    typeof entry.hexcode === 'string' &&
    typeof entry.emoji === 'string' &&
    entry.emoji.length > 0 &&
    Number.isFinite(entry.group) &&
    Number.isFinite(entry.order) &&
    typeof entry.label === 'string' &&
    entry.label.trim().length > 0
  )
}

/** 只收有官方分组与本地名称的条目，保证选择器能分栏且能搜索。 */
export function buildEmojiIndex(
  raw: readonly RawEmojiEntry[],
): { base: EmojiBaseEntry[]; labels: EmojiLabelEntry[] } {
  const usable = raw.filter(isUsable).map((entry) => ({
    ...entry,
    id: emojiIdOf(entry.hexcode),
  }))
  const seen = new Set<string>()
  const entries = usable.filter((entry) => {
    if (entry.id === null || seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
  entries.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return {
    base: entries.map((entry) => [
      entry.id as string,
      entry.emoji,
      entry.group as number,
      entry.order as number,
    ]),
    labels: entries.map((entry) => [
      (entry.label as string).trim(),
      entry.tags && entry.tags.length > 0 ? entry.tags : undefined,
    ]),
  }
}

function serializeTuples(values: readonly unknown[]): string {
  return values.map((value) => `  ${JSON.stringify(value)},`).join('\n')
}

export function serializeEmojiBase(base: readonly EmojiBaseEntry[], generator: string): string {
  return `/**\n * 由 ${generator} 生成，不要手改。\n * emojibase-data 15.0.0，MIT。\n */\nexport type EmojiBaseEntry = readonly [id: string, emoji: string, group: number, order: number]\nexport type EmojiLabelEntry = readonly [label: string, tags?: readonly string[]]\n\nexport const EMOJI_BASE: readonly EmojiBaseEntry[] = [\n${serializeTuples(base)}\n]\n`
}

export function serializeEmojiLabels(
  labels: readonly EmojiLabelEntry[],
  generator: string,
): string {
  return `/**\n * 由 ${generator} 生成，不要手改。\n * emojibase-data 15.0.0，MIT。\n */\nimport type { EmojiLabelEntry } from './emoji-base'\n\nexport const EMOJI_LABELS: readonly EmojiLabelEntry[] = [\n${serializeTuples(labels)}\n]\n`
}
