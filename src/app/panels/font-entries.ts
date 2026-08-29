/**
 * 字体目录的界面侧缓存：精选清单立即可用，全库目录首次打开字体选择器时才拉。
 * 字重控件与字体加载都要按 family 查到 FontEntry，查不到就没法知道有哪些字重。
 *
 * fetchCatalog 拉不到时不抛错，原样返回 CURATED_FONTS 那个引用。
 * 把它当真目录写进模块变量，整个会话就被钉死在这几十个精选字体上，网络恢复也不会再拉一次。
 * 所以这里按引用认出兜底：不写目录、不留 pending，下次打开选择器自然重试一遍。
 */

import { useCallback, useSyncExternalStore } from 'react'
import { fetchCatalog, type FontEntry } from '@/fonts/catalog'
import { CURATED_FONTS, getCuratedByFamily } from '@/fonts/curated'

/** 目录拉不到时的字重兜底，覆盖绝大多数可变字体。 */
export const FALLBACK_WEIGHTS: readonly number[] = [300, 400, 500, 600, 700, 800, 900]

let catalog: FontEntry[] = []
let pending: Promise<FontEntry[]> | null = null
const listeners = new Set<() => void>()

/** 收下一趟目录。引用等于精选清单就是 fetchCatalog 的兜底分支，不当成真目录记住。 */
function settle(list: FontEntry[]): FontEntry[] {
  if (list === CURATED_FONTS) return list
  catalog = list
  for (const listener of listeners) listener()
  return list
}

/** 拉一次全库目录，重复调用共享同一个请求；上一次没拉到的话这次会重试。 */
export function ensureCatalog(): Promise<FontEntry[]> {
  if (catalog.length > 0) return Promise.resolve(catalog)
  pending ??= fetchCatalog()
    .then(settle)
    .catch(() => CURATED_FONTS)
    .finally(() => {
      pending = null
    })
  return pending
}

/** 已经拿到的目录，没拉到过就先给精选清单。 */
export function catalogSnapshot(): FontEntry[] {
  return catalog.length > 0 ? catalog : CURATED_FONTS
}

/** 按 family 查条目：先查已拉到的目录，再回精选清单。 */
export function findEntry(family: string): FontEntry | undefined {
  const target = family.trim().toLowerCase()
  const hit = catalog.find((entry) => entry.family.toLowerCase() === target)
  return hit ?? getCuratedByFamily(family)
}

/**
 * 订阅目录，组件挂载时顺手触发一次拉取。
 *
 * 走 useSyncExternalStore 而不是 useState 加 useEffect：目录可能在 render 与 effect 之间到货，
 * 用后者就得在 effect 里同步 setState 补一次，那会引发级联渲染。
 * catalogSnapshot 返回的两个引用都是模块级常量，快照稳定。
 */
export function useFontCatalog(enabled = true): FontEntry[] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) return () => {}
      listeners.add(onChange)
      void ensureCatalog()
      return () => {
        listeners.delete(onChange)
      }
    },
    [enabled],
  )

  return useSyncExternalStore(subscribe, catalogSnapshot, catalogSnapshot)
}

/** 当前字体可选的字重，查不到条目时给一份通用档位。 */
export function weightsOf(family: string): number[] {
  const entry = findEntry(family)
  const weights = entry?.weights ?? []
  return weights.length > 0 ? [...weights].sort((a, b) => a - b) : [...FALLBACK_WEIGHTS]
}
