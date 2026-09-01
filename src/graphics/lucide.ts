import { CURATED_ICONS } from './curated'
import type { Graphic, LucideIconNode } from './types'

const cache = new Map<string, Graphic | null>()

function pathOf(nodes: readonly LucideIconNode[]): Path2D | null {
  if (typeof Path2D !== 'function') return null
  const path = new Path2D()
  for (const [tag, attrs] of nodes) {
    if (tag === 'path') {
      path.addPath(new Path2D(attrs.d ?? ''))
      continue
    }
    if (tag === 'rect') {
      const x = Number(attrs.x ?? 0)
      const y = Number(attrs.y ?? 0)
      const width = Number(attrs.width ?? 0)
      const height = Number(attrs.height ?? 0)
      path.rect(x, y, width, height)
      continue
    }
    if (tag === 'circle') {
      const cx = Number(attrs.cx ?? 0)
      const cy = Number(attrs.cy ?? 0)
      const r = Number(attrs.r ?? 0)
      path.moveTo(cx + r, cy)
      path.arc(cx, cy, r, 0, Math.PI * 2)
      continue
    }
    if (tag === 'ellipse') {
      const cx = Number(attrs.cx ?? 0)
      const cy = Number(attrs.cy ?? 0)
      const rx = Number(attrs.rx ?? 0)
      const ry = Number(attrs.ry ?? 0)
      path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      continue
    }
    if (tag === 'line') {
      path.moveTo(Number(attrs.x1 ?? 0), Number(attrs.y1 ?? 0))
      path.lineTo(Number(attrs.x2 ?? 0), Number(attrs.y2 ?? 0))
      continue
    }
    if (tag === 'polyline' || tag === 'polygon') {
      const points = (attrs.points ?? '')
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
      if (points.length >= 4) {
        path.moveTo(points[0] ?? 0, points[1] ?? 0)
        for (let i = 2; i + 1 < points.length; i += 2) path.lineTo(points[i] ?? 0, points[i + 1] ?? 0)
        if (tag === 'polygon') path.closePath()
      }
    }
  }
  return path
}

function graphicOf(id: string, nodes: readonly LucideIconNode[] | undefined): Graphic | null {
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  const path = pathOf(nodes)
  if (!path) return null
  return { kind: 'lucide', path, width: 24, height: 24 }
}

/** 按名字加载 lucide 图形。精选先拉小索引，其余才拉全库 chunk。 */
export async function loadLucideGraphic(id: string): Promise<Graphic | null> {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const curated = CURATED_ICONS.some((icon) => icon.name === id)
  const nodes = curated
    ? (await import('./generated/lucide-curated')).LUCIDE_CURATED[id]
    : (await import('./generated/lucide-full')).LUCIDE_ICONS[id]
  const graphic = graphicOf(id, nodes)
  cache.set(id, graphic)
  return graphic
}
