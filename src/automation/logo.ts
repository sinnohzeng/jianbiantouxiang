import { sanitizeSvg } from '@/graphics/upload'
import { inlineSafeClassStyles } from '@/graphics/svg-style'
import { createCanvas, get2d, releaseCanvas } from '@/lib/canvas'
import type { Graphic } from '@/graphics/types'
import type { LogoInput } from './schema'

/** Bounded safe subset: reject active/expensive elements instead of silently losing a logo. */
export function safeLogoSvg(raw: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(raw))
    throw new Error('SVG document types and entities are not supported')
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const nodes = doc.querySelectorAll('*')
  if (nodes.length > 2000) throw new Error('SVG exceeds 2000 elements')
  for (const node of nodes) {
    let depth = 0
    for (let p: Element | null = node; p; p = p.parentElement)
      if (++depth > 32) throw new Error('SVG nesting exceeds 32')
    if (
      /^(script|foreignObject|image|use|filter|mask|animate.*|set|text|tspan)$/i.test(
        node.localName,
      )
    )
      throw new Error(
        'SVG must contain outlined shapes only; scripts, text, references, filters and masks are unsupported',
      )
    for (const attr of node.attributes) {
      if (attr.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue
      if (/^on|href/i.test(attr.localName) || /(?:https?:|file:|data:|\\)/i.test(attr.value))
        throw new Error('SVG external references and event attributes are not allowed')
      for (const ref of attr.value.matchAll(/url\(([^)]*)\)/gi))
        if (!/^['"]?#[\w.:-]+['"]?$/.test((ref[1] ?? '').trim()))
          throw new Error('SVG external paint reference')
    }
  }
  inlineSafeClassStyles(doc)
  const safe = new DOMParser().parseFromString(
    sanitizeSvg(new XMLSerializer().serializeToString(doc)),
    'image/svg+xml',
  )
  const root = safe.documentElement
  let box = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (!box) box = [0, 0, Number(root.getAttribute('width')), Number(root.getAttribute('height'))]
  if (
    box.length !== 4 ||
    !box.every(Number.isFinite) ||
    (box[2] ?? 0) <= 0 ||
    (box[3] ?? 0) <= 0 ||
    box.some((v) => Math.abs(v) > 1e6)
  )
    throw new Error('SVG needs a finite positive viewBox or numeric width and height')
  const w = box[2] ?? 1,
    h = box[3] ?? 1
  if (Math.max(w / h, h / w) > 50) throw new Error('Logo aspect ratio exceeds 50:1')
  root.setAttribute('viewBox', box.join(' '))
  root.setAttribute('width', String(Math.max(1, Math.round((1024 * w) / Math.max(w, h)))))
  root.setAttribute('height', String(Math.max(1, Math.round((1024 * h) / Math.max(w, h)))))
  return new XMLSerializer().serializeToString(root)
}

/** Converts monochrome opaque backgrounds to alpha, then crops visible pixels. */
export function trimLogoPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: LogoInput['background'],
) {
  let transparent = false,
    mono = true
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 250) transparent = true
    if (
      Math.max(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) -
        Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) >
      12
    )
      mono = false
  }
  let removed: 'white' | 'black' | null =
    background === 'white' || background === 'black' ? background : null
  if (background === 'auto' && !transparent && mono) {
    let white = true,
      black = true
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue
        const c = data[(y * width + x) * 4] ?? 0
        white &&= c >= 245
        black &&= c <= 10
      }
    if (white || black) removed = white ? 'white' : 'black'
  }
  let left = width,
    top = height,
    right = -1,
    bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (removed) {
        const luminance = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3
        data[i + 3] = Math.round(
          ((data[i + 3] ?? 0) * (removed === 'white' ? 255 - luminance : luminance)) / 255,
        )
        const foreground = removed === 'white' ? 0 : 255
        data[i] = foreground
        data[i + 1] = foreground
        data[i + 2] = foreground
      }
      if ((data[i + 3] ?? 0) > 8) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  if (right < left) throw new Error('Logo has no visible foreground')
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    removed,
    mono,
    uncertainBackground: background === 'auto' && !transparent && !removed,
  }
}

export async function prepareLogo(
  input: LogoInput,
  color: string,
): Promise<{
  graphic: Graphic
  warnings: string[]
  release: () => void
  recolor: (color: string) => void
}> {
  const bytes = Uint8Array.from(atob(input.data), (c) => c.charCodeAt(0))
  if (bytes.length > 512 * 1024) throw new Error('Logo exceeds 512 KiB')
  let blob: Blob
  let strippedMetadata = false
  if (input.mimeType === 'image/svg+xml') {
    blob = new Blob([safeLogoSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes))], {
      type: input.mimeType,
    })
  } else {
    if (
      bytes.length < 24 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) ||
      new TextDecoder().decode(bytes.slice(12, 16)) !== 'IHDR'
    )
      throw new Error('Invalid PNG header')
    const view = new DataView(bytes.buffer),
      w = view.getUint32(16),
      h = view.getUint32(20)
    if (!w || !h || w > 4096 || h > 4096 || w * h > 16_000_000)
      throw new Error('PNG dimensions exceed limit')
    const chunks: Uint8Array<ArrayBuffer>[] = [bytes.slice(0, 8)]
    let at = 8,
      ended = false
    while (at + 12 <= bytes.length) {
      const length = view.getUint32(at),
        name = new TextDecoder().decode(bytes.slice(at + 4, at + 8))
      if (length > bytes.length - at - 12) throw new Error('Invalid PNG chunk length')
      if (['acTL', 'fcTL', 'fdAT'].includes(name))
        throw new Error('Animated PNG is unsupported; re-export a static PNG')
      // 不解压色彩配置/文字元数据；删除这些非像素块后再交给浏览器解码。
      if (['zTXt', 'iTXt', 'iCCP'].includes(name)) strippedMetadata = true
      else chunks.push(bytes.slice(at, at + length + 12))
      at += length + 12
      if (name === 'IEND') {
        ended = true
        break
      }
    }
    if (!ended || at !== bytes.length) throw new Error('Invalid PNG chunk stream')
    blob = new Blob(chunks, { type: input.mimeType })
  }
  const url = URL.createObjectURL(blob)
  const canvas = createCanvas(1, 1)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = get2d(canvas),
      pixels = (() => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        return ctx.getImageData(0, 0, canvas.width, canvas.height)
      })()
    const crop = trimLogoPixels(pixels.data, canvas.width, canvas.height, input.background)
    if (input.preservePadding)
      Object.assign(crop, { x: 0, y: 0, width: canvas.width, height: canvas.height })
    ctx.putImageData(pixels, 0, 0)
    const output = createCanvas(crop.width, crop.height),
      out = get2d(output)
    out.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
    if (input.color === 'auto') {
      out.globalCompositeOperation = 'source-in'
      out.fillStyle = color
      out.fillRect(0, 0, output.width, output.height)
      out.globalCompositeOperation = 'source-over'
    }
    return {
      graphic: { kind: 'image', image: output, width: output.width, height: output.height },
      warnings: [
        ...(strippedMetadata ? ['png-compressed-metadata-removed'] : []),
        ...(crop.removed ? [`logo-background-removed:${crop.removed}`] : []),
        ...(crop.uncertainBackground
          ? ['opaque-logo-background-preserved:specify-background-if-needed']
          : []),
        ...(!crop.mono && input.color === 'auto' ? ['logo-converted-to-monochrome'] : []),
      ],
      release: () => releaseCanvas(output),
      recolor: (color: string) => {
        if (input.color !== 'auto') return
        out.globalCompositeOperation = 'source-in'
        out.fillStyle = color
        out.fillRect(0, 0, output.width, output.height)
        out.globalCompositeOperation = 'source-over'
      },
    }
  } finally {
    URL.revokeObjectURL(url)
    releaseCanvas(canvas)
  }
}
