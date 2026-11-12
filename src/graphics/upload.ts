import type { Graphic } from './types'
import { visibleImageRect } from './trim'
import { inlineSafeClassStyles } from './svg-style'

export const MAX_GRAPHIC_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_GRAPHIC_PIXELS = 16 * 1024 * 1024
export const MAX_SESSION_GRAPHIC_PIXELS = 64 * 1024 * 1024
export const MAX_SESSION_GRAPHICS = 24
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
  'style',
  'gradientUnits',
  'gradientTransform',
  'offset',
  'stop-color',
  'stop-opacity',
])

/**
 * `style` 属性里放行的声明。
 *
 * 上游素材大量把填色写在 `style="fill:#133c9a"` 里，Figma 导出的 SVG 也是这个写法，
 * 整条属性丢掉就等于丢掉原色。只收这一批与上色直接相关的属性，`behavior`、`expression`
 * 这类能引出行为的声明连名字都不在表里。
 */
const STYLE_PROPS = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'stop-color',
  'stop-opacity',
  'color',
  'clip-rule',
  'paint-order',
])

/**
 * 取值：一个或多个取值词，逗号与空格分隔。
 * 词形只认 hex、颜色关键字、带不带单位的数值、百分比、`rgb()` / `rgba()`、指向文档内 id 的 `url()`。
 */
const STYLE_VALUE =
  /^(?:(?:#[0-9a-f]{3,8}|[a-z][a-z-]*|[+-]?(?:\d+\.?\d*|\.\d+)(?:px|pt|em|rem|%)?|rgba?\([\d\s.,%/]*\)|url\(#[\w.:-]+\))[\s,]*)+$/i

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
  | 'resource-limit'
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

/**
 * 按属性与取值双重白名单重建 `style`。留不下任何声明就返回空串，调用方据此不写这个属性。
 * `url()` 沿用 `isInternalReference`，只认指向文档内 id 的引用。
 */
function sanitizeStyle(value: string): string {
  const kept: string[] = []
  for (const declaration of value.split(';')) {
    const at = declaration.indexOf(':')
    if (at < 0) continue
    const name = declaration.slice(0, at).trim().toLowerCase()
    const raw = declaration.slice(at + 1).trim()
    if (!STYLE_PROPS.has(name) || raw === '') continue
    if (!isInternalReference(raw) || !STYLE_VALUE.test(raw)) continue
    kept.push(`${name}:${raw}`)
  }
  return kept.join(';')
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
    if (!ATTRS.has(name) || /^on/i.test(name)) continue
    if (name === 'style') {
      const style = sanitizeStyle(attr.value)
      if (style !== '') clean.setAttribute('style', style)
      continue
    }
    if (!isInternalReference(attr.value)) continue
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
    if (ELEMENTS.has((child as Element).localName)) {
      clean.appendChild(result.node)
    }
  }
  drawing ||= childDrawing
  return { node: clean, drawing }
}

function viewBoxSize(root: Element): { width: number; height: number } {
  const raw = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (raw?.length === 4 && raw.every(Number.isFinite) && (raw[2] ?? 0) > 0 && (raw[3] ?? 0) > 0) {
    return { width: raw[2] ?? 512, height: raw[3] ?? 512 }
  }
  const width = Number(root.getAttribute('width'))
  const height = Number(root.getAttribute('height'))
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height }
  }
  return { width: 512, height: 512 }
}

/** 白名单重建 SVG。未知元素整支丢弃，未知属性删除，外部引用不保留，`style` 按声明再过一层。 */
export function sanitizeSvg(source: string): string {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const parserError = document.getElementsByTagName('parsererror')[0]
  const root = document.documentElement
  if (parserError || root.localName !== 'svg' || root.namespaceURI !== SVG_NS) {
    throw new GraphicUploadError('SVG 解析失败', 'invalid-svg')
  }

  inlineSafeClassStyles(document)
  const cloned = cloneSafe(root, document, true)
  if (!cloned.drawing) throw new GraphicUploadError('SVG 里没有安全绘图元素', 'empty-graphic')
  const clean = cloned.node
  // Canvas 的九参数 drawImage 使用固有尺寸作为裁切坐标；viewBox 本身只提供比例。
  // 明确尺寸使同一 SVG 在预览和大尺寸导出中使用同一坐标系。
  // 百分比宽高同样没有固有尺寸，九参数裁切会对错坐标（微博的 SVG 就写着 100%）
  const absolute = (name: string) =>
    /^(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(clean.getAttribute(name)?.trim() ?? '')
  if (!absolute('width') || !absolute('height')) {
    const size = viewBoxSize(root)
    const scale = Math.min(1, 2048 / Math.max(size.width, size.height))
    clean.setAttribute('width', String(size.width * scale))
    clean.setAttribute('height', String(size.height * scale))
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
const names = new Map<string, string>()

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
  if (width * height > MAX_GRAPHIC_PIXELS)
    throw new GraphicUploadError('图形像素过多', 'resource-limit')
  const sourceRect = visibleImageRect(image, width, height)
  if (!sourceRect) throw new GraphicUploadError('图形没有可见像素', 'empty-graphic')
  return { kind: 'image', image, width: sourceRect.width, height: sourceRect.height, sourceRect }
}

function retainGraphic(id: string, graphic: Graphic): void {
  let pixels = 0
  for (const item of [...registry.values(), graphic]) {
    if (item.kind === 'image') {
      const image = item.image as HTMLImageElement
      pixels += (image.naturalWidth || item.width) * (image.naturalHeight || item.height)
    }
  }
  if (registry.size >= MAX_SESSION_GRAPHICS || pixels > MAX_SESSION_GRAPHIC_PIXELS) {
    throw new GraphicUploadError('本次会话的图形资源已达上限', 'resource-limit')
  }
  registry.set(id, graphic)
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
      retainGraphic(id, graphic)
      names.set(id, file.name)
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
      retainGraphic(id, graphic)
      names.set(id, file.name)
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

/** 上传图形的原文件名，供界面显示；刷新后注册表已空，返回 null。 */
export function getUploadedGraphicName(id: string): string | null {
  return names.get(id) ?? null
}

export function clearUploadedGraphics(): void {
  registry.clear()
  names.clear()
}
