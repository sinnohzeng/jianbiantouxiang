import type { Graphic, GraphicIcon } from './types'

/**
 * 图形来源的分派入口。四个实现都按需 import，主界面只带这一份小模块，
 * 不会因为引用 source.ts 就把图标索引、emoji 标签或品牌索引拖进首屏 chunk。
 */
export async function loadGraphic(icon: GraphicIcon): Promise<Graphic | null> {
  if (icon.source === 'none' || icon.id === '') return null
  try {
    if (icon.source === 'builtin') {
      const { loadLucideGraphic } = await import('./lucide')
      return await loadLucideGraphic(icon.id)
    }
    if (icon.source === 'emoji') {
      const { loadEmojiGraphic } = await import('./emoji')
      return await loadEmojiGraphic(icon.id)
    }
    if (icon.source === 'brand') {
      const { loadBrandGraphic } = await import('./brand')
      return await loadBrandGraphic(icon.id)
    }
    if (icon.source === 'upload') {
      const { getUploadedGraphic } = await import('./upload')
      return getUploadedGraphic(icon.id)
    }
  } catch {
    // 断网、坏 id、会话过期都不该让整张头像导不出来；图形位留空即可
    return null
  }
  return null
}
