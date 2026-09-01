import type { Graphic } from './types'

export const MAX_GRAPHIC_UPLOAD_BYTES = 5 * 1024 * 1024
const SVG_NS = 'http://www.w3.org/2000/svg'

const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
])

const ATTRS = new Set([
  'id',
  'class',
  'viewBox',
  'preserveAspectRatio',
  'width',
  'height',
  'transform',
  'transform-origin',
  'd',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'points',
  'dx',
  'dy',
  'rotate',
  'text-anchor',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'word-spacing',
  'textLength',
  'lengthAdjust',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'paint-order',
  'clip-rule',
  'clip-path',
  'gradientUnits',
  'gradientTransform',
  'offset',
  'stop-color',
  'stop-opacity',
])

const DRAWINGS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
])

export type GraphicUploadErrorCode =
  | 'too-large'
  | 'unsupported-extension'
  | 'invalid-svg'
  | 'empty-graphic'
  | 'failed'

export class GraphicUploadError extends Error {
  readonly code: GraphicUploadErrorCode

  constructor(message: string, code: GraphicUploadErrorCode) {
    super(message)
    this.name = 'GraphicUploadError'
    this.code = code
  }
}

function isInternalReference(value: string): boolean {
  const url = /url\(([^)]*)\)/i.exec(value.trim())
  if (!url) return true
  const target = (url[1] ?? '').trim().replace(/^['"]|['"]$/g, '')
  return target.startsWith('#')
}

function cloneSafe(
  element: Element,
  document: XMLDocument,
  root: boolean,
): { node: Element; drawing: boolean } {
  const tag = element.localName
  if (!ELEMENTS.has(tag)) return { node: document.createElementNS(SVG_NS, 'g'), drawing: false }

  const clean = document.createElementNS(SVG_NS, tag)
  let drawing = DRAWINGS.has(tag)
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name
    if (name === 'xmlns' && root) {
      clean.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', SVG_NS)
      continue
    }
    if (!ATTRS.has(name) || /^on/i.test(name) || !isInternalReference(attr.value)) continue
    clean.setAttribute(name, attr.value)
  }

  let childDrawing = false
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) {
      if (tag === 'text' || tag === 'tspan' || tag === 'title' || tag === 'desc') {
        clean.appendChild(document.createTextNode(child.nodeValue ?? ''))
      }
      continue
    }
    if (child.nodeType !== 1) continue
    const result = cloneSafe(child as Element, document, false)
    childDrawing ||= result.drawing
    if (result.drawing || result.node.childElementCount > 0 || result.node.textContent !== '') {
      clean.appendChild(result.node)
    }
  }
  drawing ||= childDrawing
  return { node: clean, drawing }
}

function viewBoxSize(root: Element): { width: number; height: number } {
  const raw = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (raw?.length === 4 && raw.slice(1).every((value) => Number.isFinite(value) && value > 0)) {
    return { width: raw[1] ?? 512, height: raw[3] ?? 512 }
  }
  const width = Number(root.getAttribute('width'))
  const height = Number(root.getAttribute('height'))
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height }
  }
  return { width: 512, height: 512 }
}

/** 白名单重建 SVG。未知元素整支丢弃，未知属性删除，外部引用不保留。 */
export function sanitizeSvg(source: string): string {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const parserError = document.getElementsByTagName('parsererror')[0]
  const root = document.documentElement
  if (parserError || root.localName !== 'svg' || root.namespaceURI !== SVG_NS) {
    throw new GraphicUploadError('SVG 解析失败', 'invalid-svg')
  }

  const cloned = cloneSafe(root, document, true)
  if (!cloned.drawing) throw new GraphicUploadError('SVG 里没有安全绘图元素', 'empty-graphic')
  const clean = cloned.node
  if (!clean.getAttribute('viewBox') && !clean.getAttribute('width')) {
    const size = viewBoxSize(root)
    clean.setAttribute('width', String(size.width))
    clean.setAttribute('height', String(size.height))
  }
  if (!clean.getAttribute('xmlns')) {
    clean.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', SVG_NS)
  }
  return new XMLSerializer().serializeToString(clean)
}

function randomId(): string {
  const buf = new Uint16Array(2)
  globalThis.crypto?.getRandomValues(buf)
  return `upload-${Date.now().toString(36)}-${(buf[0] ?? 0).toString(16)}${(buf[1] ?? 0).toString(16)}`
}

const registry = new Map<string, Graphic>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new GraphicUploadError('图形读不出来', 'failed'))
    image.src = url
  })
}

async function graphicOfUrl(url: string): Promise<Graphic> {
  const image = await loadImage(url)
  const width = image.naturalWidth || 512
  const height = image.naturalHeight || 512
  return { kind: 'image', image, width, height }
}

/** 注册本次会话的上传图形，不进 URL、存档或历史。 */
export async function registerUploadedGraphic(file: File): Promise<{ id: string; name: string }> {
  if (file.size > MAX_GRAPHIC_UPLOAD_BYTES) {
    throw new GraphicUploadError('图形文件太大', 'too-large')
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()
  if (extension === 'svg' || type === 'image/svg+xml') {
    const raw = await file.text()
    const safe = sanitizeSvg(raw)
    const blob = new Blob([safe], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    try {
      const graphic = await graphicOfUrl(url)
      const id = randomId()
      registry.set(id, graphic)
      return { id, name: file.name }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  if (['png', 'webp'].includes(extension) || ['image/png', 'image/webp'].includes(type)) {
    const url = URL.createObjectURL(file)
    try {
      const graphic = await graphicOfUrl(url)
      const id = randomId()
      registry.set(id, graphic)
      return { id, name: file.name }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  throw new GraphicUploadError('不支持这种图形格式', 'unsupported-extension')
}

export function getUploadedGraphic(id: string): Graphic | null {
  return registry.get(id) ?? null
}

export function clearUploadedGraphics(): void {
  registry.clear()
}
