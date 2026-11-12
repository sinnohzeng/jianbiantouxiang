import { visibleImageRect } from './trim'
import { isExactBrand, keepsClearspace } from './client-presets'
import { BRAND_INDEX } from './generated/brand-index'
import type { Rect } from '@/text/layout'
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

interface BrandFile {
  /** 品牌条目 id，决定原色与裁边口径。 */
  brand: string
  /** public/brand 下的文件名。 */
  id: string
  ext: 'svg' | 'png'
}

/**
 * 当前档该取哪个文件。
 *
 * 单色档优先用登记的上游白稿，保留源文件的镂空与留白；
 * 具有 white 字段时取该源文件，其余取原稿；兼容染色在 draw.ts 按 alpha 处理。
 * 登记的上游白稿均为 SVG，存档里直接落着它的文件名时按原样取。
 */
function fileOf(id: string, mono: boolean): BrandFile | null {
  const legacy: Record<string, string> = {
    'claude-ai-light': 'claude-ai',
    'tiktok-light': 'tiktok',
    'anthropic-dark': 'anthropic',
  }
  id = legacy[id] ?? id
  for (const entry of BRAND_INDEX) {
    if (entry.id === id) {
      return mono && entry.white
        ? { brand: entry.id, id: entry.white, ext: 'svg' }
        : { brand: entry.id, id: entry.asset ?? entry.id, ext: entry.ext }
    }
    if (entry.white === id) return { brand: entry.id, id, ext: 'svg' }
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

/** 量不了（拿不到 2D 画布）就按整张图排，Logo 照常画出来。 */
function measureVisible(graphic: Graphic & { kind: 'image' }): Rect | null {
  try {
    return visibleImageRect(graphic.image, graphic.width, graphic.height)
  } catch {
    return null
  }
}

/**
 * 素材文件里的透明边不算 Logo 的大小：版面按可见像素的外接框排，留白由版式自己给。
 * 东黎的留白是品牌规范的一部分，原样保留。
 */
async function load(file: BrandFile): Promise<Graphic | null> {
  const url = `${import.meta.env.BASE_URL}brand/${file.id}.${file.ext}`
  try {
    const graphic = file.ext === 'svg' ? await loadSvg(url) : graphicOf(await loadImage(url))
    if (graphic.kind !== 'image') return graphic
    const sourceRect = keepsClearspace(file.brand) ? null : measureVisible(graphic)
    const trimmed = sourceRect
      ? { ...graphic, width: sourceRect.width, height: sourceRect.height, sourceRect }
      : graphic
    return isExactBrand(file.brand) ? { ...trimmed, preserveColor: true } : trimmed
  } catch {
    console.warn(`品牌图形读不出来：${url}`)
    return null
  }
}

/**
 * 按品牌 id 与单色档取图形。缓存键是真正取到的文件名，
 * 同一品牌的原色稿与上游单色稿各缓存一份；失败的那次也记进缓存，不反复打网络。
 */
export function loadBrandGraphic(id: string, mono = false): Promise<Graphic | null> {
  const file = fileOf(id, mono)
  if (!file) {
    console.warn(`品牌图形不在索引里：${id}`)
    return Promise.resolve(null)
  }
  const cached = cache.get(file.id)
  if (cached) return cached
  const task = load(file)
  cache.set(file.id, task)
  return task
}
