import { beforeEach, describe, expect, it } from 'vitest'

class FakePath2D {
  added: unknown[] = []
  addPath(path: unknown): void {
    this.added.push(path)
  }
  rect(): void {}
  moveTo(): void {}
  lineTo(): void {}
  arc(): void {}
  ellipse(): void {}
  closePath(): void {}
}

describe('loadLucideGraphic', () => {
  beforeEach(() => {
    ;(globalThis as { Path2D?: unknown }).Path2D = FakePath2D
  })

  it('精选图标走小索引并转成 Path2D', async () => {
    const { loadLucideGraphic } = await import('@/graphics/lucide')
    const graphic = await loadLucideGraphic('tree-palm')
    expect(graphic?.kind).toBe('lucide')
    if (graphic?.kind === 'lucide') {
      expect(graphic.width).toBe(24)
      expect(graphic.height).toBe(24)
      expect(graphic.path).toBeInstanceOf(FakePath2D)
    }
  })

  it('未知图标返回 null 并缓存失败结果', async () => {
    const { loadLucideGraphic } = await import('@/graphics/lucide')
    expect(await loadLucideGraphic('not-an-icon')).toBeNull()
  })
})
