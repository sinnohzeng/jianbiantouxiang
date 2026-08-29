/** 最近使用的字体，只存 family 名，最多 8 条。localStorage 不可用时退化成内存表。 */

const KEY = 'ga3.fonts.recent.v1'
const MAX = 8

let memory: string[] = []

function readStorage(): string[] | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX)
  } catch {
    return null
  }
}

export function loadRecentFonts(): string[] {
  const stored = readStorage()
  if (stored) memory = stored
  return [...memory]
}

/** 置顶一条并去重，返回写入后的完整列表。 */
export function pushRecentFont(family: string): string[] {
  const name = family.trim()
  if (!name) return [...memory]
  memory = [name, ...memory.filter((item) => item !== name)].slice(0, MAX)
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(memory))
  } catch {
    // 隐私模式下写不进去，留在内存里够本次会话用
  }
  return [...memory]
}
