/**
 * 字体名预览：给 Google 字体拉一份只含显示名字形的 css2 子集，以别名注册成 FontFace。
 *
 * 别名形如 `fp-<fontsource id>`，与画布用的真名互不相干：同名注册一份子集会让
 * `document.fonts.check` 对没覆盖的字返回 true，污染主加载器的就绪判断。
 * 先 `load` 再 `add`，`document.fonts.ready` 不被预览拖住。
 *
 * 每款字体整场会话只请求一次，成功记别名，任何一步失败记 null，刷新页面才重来。
 * 请求带 `priority: 'low'`，不与画布字体抢带宽。样式重算按帧合并，注册多少个 face 都不排队。
 * 只依赖 google.ts 与 catalog.ts，与主加载器隔离。
 */

import { nearestWeight } from '@/state/config'
import { displayName, type FontEntry } from './catalog'
import { buildCss2TextUrl } from './google'

/** 每款字体的结果：别名或 null（失败）。没有键表示还没出结果。 */
const results = new Map<string, string | null>()
/** 已发出请求的 id。 */
const requested = new Set<string>()
const listeners = new Set<() => void>()

/** css2 返回的第一条 src 地址。 */
const SRC_URL = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/

/** 预览字体的别名。 */
export function previewFamily(id: string): string {
  return `fp-${id}`
}

async function loadPreview(entry: FontEntry): Promise<string | null> {
  try {
    const url = buildCss2TextUrl(
      entry.family,
      nearestWeight(entry.weights, 400),
      displayName(entry.family, 'google'),
    )
    const res = await fetch(url, { priority: 'low' })
    const src = SRC_URL.exec(await res.text())?.[1]
    if (!src) return null
    const alias = previewFamily(entry.id)
    // 不写字重描述符：子集请求的就是字体自己有的一档，名字格写 normal 且关掉合成
    const face = new FontFace(alias, `url("${src}")`)
    await face.load()
    document.fonts.add(face)
    return alias
  } catch {
    return null
  }
}

/** 请求一款字体的预览，幂等：每个 id 只发一次。 */
export function requestPreview(entry: FontEntry): void {
  if (requested.has(entry.id)) return
  requested.add(entry.id)
  void loadPreview(entry).then((alias) => {
    results.set(entry.id, alias)
    for (const listener of listeners) listener()
  })
}

/** 这个 id 是否已经发过请求。 */
export function isPreviewRequested(id: string): boolean {
  return requested.has(id)
}

/** 就绪的别名；没请求、还在路上或失败时为 null。 */
export function previewFamilyOf(id: string): string | null {
  return results.get(id) ?? null
}

/** 订阅预览结果，每出一个结果通知一次。 */
export function subscribePreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 丢弃内存里的预览状态，注册过的 FontFace 不动。测试用。 */
export function resetPreviewState(): void {
  results.clear()
  requested.clear()
}
