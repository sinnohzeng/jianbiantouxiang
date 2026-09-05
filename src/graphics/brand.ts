import { BRAND_INDEX } from './generated/brand-index'
import type { Graphic } from './types'
import { sanitizeSvg } from './upload'

/**
 * 内置品牌图形。资产是同源静态文件，由 npm run gen:brand 落到 public/brand。
 *
 * SVG 仍过一遍 sanitizeSvg：生成器从上游拉的文件本仓不逐个人工审，消毒一次成本可以忽略，
 * 且与上传路径同一条口径。PNG 只有位图，直接给 Image。
 * 任何一环失败都只 console.warn 一次、返回 null，图形位留空，渐变与文字继续可用。
 */

const cache = new Map<string, Promise<Graphic | null>>()

/** 品牌文件的扩展名。原色条目查索引，纯白变体一律是 SVG。 */
function extensionOf(id: string): 'svg' | 'png' | null {
  for (const entry of BRAND_INDEX) {
    if (entry.id === id) return entry.ext
    if (entry.white === id) return 'svg'
  }
  return null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('brand image failed'))
    image.src = url
  })
}

function graphicOf(image: HTMLImageElement): Graphic {
  return {
    kind: 'image',
    image,
    width: image.naturalWidth || 512,
    height: image.naturalHeight || 512,
  }
}

async function loadSvg(url: string): Promise<Graphic> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`brand http ${response.status}`)
  const blob = new Blob([sanitizeSvg(await response.text())], { type: 'image/svg+xml' })
  const objectUrl = URL.createObjectURL(blob)
  try {
    return graphicOf(await loadImage(objectUrl))
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function load(id: string): Promise<Graphic | null> {
  const ext = extensionOf(id)
  if (!ext) {
    console.warn(`品牌图形不在索引里：${id}`)
    return null
  }
  const url = `${import.meta.env.BASE_URL}brand/${id}.${ext}`
  try {
    return ext === 'svg' ? await loadSvg(url) : graphicOf(await loadImage(url))
  } catch {
    console.warn(`品牌图形读不出来：${url}`)
    return null
  }
}

/** 按品牌文件名取图形，同一 id 只加载一次；失败的那次也记进缓存，不反复打网络。 */
export function loadBrandGraphic(id: string): Promise<Graphic | null> {
  const cached = cache.get(id)
  if (cached) return cached
  const task = load(id)
  cache.set(id, task)
  return task
}
