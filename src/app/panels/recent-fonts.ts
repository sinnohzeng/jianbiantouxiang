/**
 * 最近使用的字体，只存 Google 字体的 family 名，最多 8 条。
 * 系统字体与上传字体不进这张表：它们在“最近使用”一组里显示不出来，还占名额。
 */

import { createPersistedAtom } from '@/app/persisted-atom'

const MAX = 8

function parse(raw: string): string[] | null {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return null
  return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX)
}

function equals(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

export const recentFonts = createPersistedAtom<string[]>({
  key: 'gradient-avatar:recent-fonts',
  fallback: [],
  parse,
  serialize: JSON.stringify,
  equals,
})

/** 置顶一条并去重。 */
export function pushRecentFont(family: string): void {
  const name = family.trim()
  if (!name) return
  recentFonts.set([name, ...recentFonts.get().filter((item) => item !== name)].slice(0, MAX))
}
