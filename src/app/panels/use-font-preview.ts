/**
 * 字体名预览的订阅：卡片上的字体按钮与选择器的行都经这里读预览别名。
 *
 * 就绪态走 useSyncExternalStore 订阅预览模块，已加载过的字体第一帧就用别名渲染，
 * 选择器重开、搜索后行重新挂载都不会先闪一下界面字体。
 * 按可见性请求的那一段只在选择器面板的懒加载 chunk 里，见 font-item.tsx。
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { FontEntry } from '@/fonts/catalog'
import { previewFamilyOf, requestPreview, subscribePreview } from '@/fonts/preview'

/**
 * 名字按字体自身渲染时共用的类。字重写 normal 并关掉合成：子集取的是字体自己有的一档，
 * 浏览器不再合成假粗体。左右各多留 4 px 裁切框，手写体伸出前进宽度的笔画不被切掉。
 * 预览就绪后淡入，偏好减少动效时直接换。
 */
export const FONT_NAME_CLASS =
  '-mx-1 truncate px-1 font-normal [font-synthesis:none] motion-safe:data-[preview=ready]:animate-in data-[preview=ready]:fade-in-0 data-[preview=ready]:duration-150'

/** 这款字体的预览别名，没就绪时为 null。 */
export function usePreviewFamily(entry: FontEntry | undefined): string | null {
  const id = entry?.id
  const snapshot = () => (id === undefined ? null : previewFamilyOf(id))
  return useSyncExternalStore(subscribePreview, snapshot, snapshot)
}

/** 挂载即请求预览，不看可见性。卡片上的字体按钮一直可见，用它。 */
export function useEagerPreview(entry: FontEntry | undefined): string | null {
  useEffect(() => {
    if (entry) requestPreview(entry)
  }, [entry])
  return usePreviewFamily(entry)
}
