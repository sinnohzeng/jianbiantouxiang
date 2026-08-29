/**
 * 字体目录的界面侧缓存：精选清单立即可用，全库目录首次打开字体选择器时才拉。
 * 字重控件与字体加载都要按 family 查到 FontEntry，查不到就没法知道有哪些字重。
 */

import { useEffect, useState } from 'react'
import { fetchCatalog, type FontEntry } from '@/fonts/catalog'
import { CURATED_FONTS, getCuratedByFamily } from '@/fonts/curated'

/** 目录拉不到时的字重兜底，覆盖绝大多数可变字体。 */
export const FALLBACK_WEIGHTS: readonly number[] = [300, 400, 500, 600, 700, 800, 900]

let catalog: FontEntry[] = []
let pending: Promise<FontEntry[]> | null = null
const listeners = new Set<(list: FontEntry[]) => void>()

function publish(list: FontEntry[]): void {
  catalog = list
  for (const listener of listeners) listener(list)
}

/** 拉一次全库目录，重复调用共享同一个请求。 */
export function ensureCatalog(): Promise<FontEntry[]> {
  if (catalog.length > 0) return Promise.resolve(catalog)
  pending ??= fetchCatalog()
    .then((list) => {
      publish(list)
      return list
    })
    .catch(() => {
      publish(CURATED_FONTS)
      return CURATED_FONTS
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** 已经拿到的目录，没拉过就先给精选清单。 */
export function catalogSnapshot(): FontEntry[] {
  return catalog.length > 0 ? catalog : CURATED_FONTS
}

/** 按 family 查条目：先查已拉到的目录，再回精选清单。 */
export function findEntry(family: string): FontEntry | undefined {
  const target = family.trim().toLowerCase()
  const hit = catalog.find((entry) => entry.family.toLowerCase() === target)
  return hit ?? getCuratedByFamily(family)
}

/** 订阅目录，组件挂载时顺手触发一次拉取。 */
export function useFontCatalog(enabled = true): FontEntry[] {
  const [list, setList] = useState<FontEntry[]>(catalogSnapshot)

  useEffect(() => {
    if (!enabled) return
    listeners.add(setList)
    void ensureCatalog()
    return () => {
      listeners.delete(setList)
    }
  }, [enabled])

  return list
}

/** 当前字体可选的字重，查不到条目时给一份通用档位。 */
export function weightsOf(family: string): number[] {
  const entry = findEntry(family)
  const weights = entry?.weights ?? []
  return weights.length > 0 ? [...weights].sort((a, b) => a - b) : [...FALLBACK_WEIGHTS]
}
