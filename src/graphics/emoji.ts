import type { Graphic } from './types'

export const NOTO_EMOJI_VERSION = 'v2.047'
const CDN = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji'
const cache = new Map<string, Graphic | null>()

/** Noto Emoji 文件名：小写 hexcode 用下划线连接，FE0F/FE0E 变体选择符去掉。 */
export function emojiFileName(id: string): string | null {
  const normalized = id.trim().toLowerCase()
  if (!/^[0-9a-f]+(?:[-_][0-9a-f]+)*$/.test(normalized)) return null
  const parts = normalized
    .split(/[-_]/)
    .filter((part) => part !== '' && part !== 'fe0f' && part !== 'fe0e')
  if (parts.length === 0) return null
  return `emoji_u${parts.join('_')}.svg`
}

export function emojiUrl(id: string): string | null {
  const file = emojiFileName(id)
  return file ? `${CDN}@${NOTO_EMOJI_VERSION}/svg/${file}` : null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('emoji image failed'))
    image.src = url
  })
}

/** 按码点取单个 Noto Emoji SVG。fetch 转 Blob 再画，避免导出回读时画布被跨源污染。 */
export async function loadEmojiGraphic(id: string): Promise<Graphic | null> {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const url = emojiUrl(id)
  if (!url) {
    cache.set(id, null)
    return null
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`emoji http ${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = await loadImage(objectUrl)
      const width = image.naturalWidth || 128
      const height = image.naturalHeight || 128
      const graphic: Graphic = { kind: 'image', image, width, height }
      cache.set(id, graphic)
      return graphic
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    cache.set(id, null)
    return null
  }
}
