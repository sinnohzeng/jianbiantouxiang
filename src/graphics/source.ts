import type { Graphic, GraphicIcon } from './types'

/**
 * 图形来源的分派入口。四个实现都按需 import，主界面只带这一份小模块，
 * 不会因为引用 source.ts 就把图标索引、emoji 标签或品牌索引拖进首屏 chunk。
 */
export async function loadGraphic(icon: GraphicIcon): Promise<Graphic | null> {
  const { source, id, mono } = icon
  if (source === 'none' || id === '') return null
  try {
    if (source === 'builtin') {
      const { loadLucideGraphic } = await import('./lucide')
      return await loadLucideGraphic(id)
    }
    if (source === 'emoji') {
      const { loadEmojiGraphic } = await import('./emoji')
      return await loadEmojiGraphic(id)
    }
    if (source === 'brand') {
      const { loadBrandGraphic } = await import('./brand')
      return await loadBrandGraphic(id, mono)
    }
    if (source === 'upload') {
      const { getUploadedGraphic } = await import('./upload')
      return getUploadedGraphic(id)
    }
  } catch {
    // 断网、坏 id、会话过期都不该让整张头像导不出来；图形位留空即可
    return null
  }
  // 四个分支穷尽了 none 以外的全部来源，走到这里只可能是类型说谎
  const exhausted: never = source
  return exhausted
}
