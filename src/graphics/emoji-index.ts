import type { Locale } from '@/i18n'
import type { EmojiLabelEntry } from './generated/emoji-base'

export interface EmojiEntry {
  id: string
  emoji: string
  group: number
  order: number
  label: string
  tags: readonly string[]
}

export const EMOJI_GROUPS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const LABEL_LOADERS: Record<Locale, () => Promise<{ EMOJI_LABELS: readonly EmojiLabelEntry[] }>> = {
  'zh-CN': () => import('./generated/emoji-labels.zh-CN'),
  'zh-HK': () => import('./generated/emoji-labels.zh-HK'),
  en: () => import('./generated/emoji-labels.en'),
  ja: () => import('./generated/emoji-labels.ja'),
  ko: () => import('./generated/emoji-labels.ko'),
}

const cache = new Map<Locale, EmojiEntry[]>()

/** 基础索引共用，标签按界面语言取那份；两份都按同一顺序生成，直接按下标合并。 */
export async function loadEmojiEntries(locale: Locale): Promise<EmojiEntry[]> {
  const cached = cache.get(locale)
  if (cached) return cached

  const [{ EMOJI_BASE }, labelsModule] = await Promise.all([
    import('./generated/emoji-base'),
    LABEL_LOADERS[locale](),
  ])
  const entries = EMOJI_BASE.map(([id, emoji, group, order], index) => {
    const label = labelsModule.EMOJI_LABELS[index]
    return {
      id,
      emoji,
      group,
      order,
      label: label?.[0] ?? id,
      tags: label?.[1] ?? [],
    }
  })
  cache.set(locale, entries)
  return entries
}
