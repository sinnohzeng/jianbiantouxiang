/**
 * 字体选择器的目录订阅：精选清单立即可用，全库目录首次打开字体选择器时才拉。
 * 按 family 查条目与字重不在这里，走 catalog 的 `findFontEntry` 与 `weightsOf`。
 *
 * fetchCatalog 拉不到时不抛错，原样返回 CURATED_FONTS 那个引用。
 * 把它当真目录写进模块变量，整个会话就被钉死在这几十个精选字体上，网络恢复也不会再拉一次。
 * 所以这里按引用认出兜底：不写目录、不留 pending，下次打开选择器自然重试一遍。
 */

import { useCallback, useSyncExternalStore } from 'react'
import { fetchCatalog, type FontEntry } from '@/fonts/catalog'
import { CURATED_FONTS } from '@/fonts/curated'

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
function catalogSnapshot(): FontEntry[] {
  return catalog.length > 0 ? catalog : CURATED_FONTS
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
