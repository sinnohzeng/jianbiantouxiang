import { describe, expect, it } from 'vitest'
import { drawHighlight } from '@/engine/highlight'

interface StubGradient {
  cx: number
  cy: number
  radius: number
  stops: { offset: number; color: string }[]
}

interface StubFill {
  composite: string
  gradient: StubGradient | null
  rect: [number, number, number, number]
}

function createStubContext() {
  const gradients: StubGradient[] = []
  const fills: StubFill[] = []
  let saves = 0
  let restores = 0

  const ctx = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: null as unknown,
    createRadialGradient(
      _x0: number,
      _y0: number,
      _r0: number,
      x1: number,
      y1: number,
      r1: number,
    ) {
      const gradient: StubGradient = { cx: x1, cy: y1, radius: r1, stops: [] }
      gradients.push(gradient)
      return {
        ...gradient,
        addColorStop(offset: number, color: string) {
          gradient.stops.push({ offset, color })
        },
        __gradient: gradient,
      }
    },
    fillRect(x: number, y: number, w: number, h: number) {
      const style = ctx.fillStyle as { __gradient?: StubGradient } | null
      fills.push({
        composite: ctx.globalCompositeOperation,
        gradient: style?.__gradient ?? null,
        rect: [x, y, w, h],
      })
    },
    save() {
      saves += 1
    },
    restore() {
      restores += 1
    },
  }

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    gradients,
    fills,
    counts: () => ({ saves, restores }),
  }
}

function alphaOf(color: string): number {
  const match = /rgba\(255, 255, 255, ([0-9.]+)\)/.exec(color)
  return match ? Number(match[1]) : Number.NaN
}

describe('drawHighlight', () => {
  it('强度为 0 时什么都不画', () => {
    const stub = createStubContext()
    drawHighlight(stub.ctx, 512, 512, 0, 'seed')
    expect(stub.fills).toHaveLength(0)
  })

  it('画布尺寸非法时不画', () => {
    const stub = createStubContext()
    drawHighlight(stub.ctx, 0, 512, 1, 'seed')
    drawHighlight(stub.ctx, 512, -1, 1, 'seed')
    expect(stub.fills).toHaveLength(0)
  })

  it('画 1 到 2 盏灯，主光 screen，副光 soft-light', () => {
    for (let i = 0; i < 40; i += 1) {
      const stub = createStubContext()
      drawHighlight(stub.ctx, 512, 512, 0.6, `light-${i}`)
      expect(stub.fills.length).toBeGreaterThanOrEqual(1)
      expect(stub.fills.length).toBeLessThanOrEqual(2)
      expect(stub.fills[0]?.composite).toBe('screen')
      if (stub.fills[1]) expect(stub.fills[1].composite).toBe('soft-light')
    }
  })

  it('两种灯都出现过，不是恒定一盏', () => {
    const counts = new Set<number>()
    for (let i = 0; i < 40; i += 1) {
      const stub = createStubContext()
      drawHighlight(stub.ctx, 512, 512, 1, `count-${i}`)
      counts.add(stub.fills.length)
    }
    expect([...counts].sort()).toEqual([1, 2])
  })

  it('边缘完全透明，避免硬边光圈', () => {
    const stub = createStubContext()
    drawHighlight(stub.ctx, 800, 600, 1, 'edge')
    for (const gradient of stub.gradients) {
      const last = gradient.stops.at(-1)
      expect(last?.offset).toBe(1)
      expect(alphaOf(last?.color ?? '')).toBe(0)
      // 中心到边缘单调变淡
      const alphas = gradient.stops.map((stop) => alphaOf(stop.color))
      for (let i = 1; i < alphas.length; i += 1) {
        expect(alphas[i]).toBeLessThanOrEqual(alphas[i - 1] as number)
      }
    }
  })

  it('光斑落在画布内，半径取到画布量级', () => {
    for (let i = 0; i < 30; i += 1) {
      const stub = createStubContext()
      drawHighlight(stub.ctx, 400, 900, 0.8, `place-${i}`)
      for (const gradient of stub.gradients) {
        expect(gradient.cx).toBeGreaterThanOrEqual(0)
        expect(gradient.cx).toBeLessThanOrEqual(400)
        expect(gradient.cy).toBeGreaterThanOrEqual(0)
        expect(gradient.cy).toBeLessThanOrEqual(900)
        expect(gradient.radius).toBeGreaterThan(900 * 0.5)
        expect(gradient.radius).toBeLessThan(900 * 1.1)
      }
    }
  })

  it('强度线性缩放中心透明度', () => {
    const half = createStubContext()
    drawHighlight(half.ctx, 512, 512, 0.5, 'scale')
    const full = createStubContext()
    drawHighlight(full.ctx, 512, 512, 1, 'scale')
    const halfAlpha = alphaOf(half.gradients[0]?.stops[0]?.color ?? '')
    const fullAlpha = alphaOf(full.gradients[0]?.stops[0]?.color ?? '')
    expect(halfAlpha).toBeCloseTo(fullAlpha / 2, 4)
  })

  it('强度超出 0 到 1 会被夹住', () => {
    const clamped = createStubContext()
    drawHighlight(clamped.ctx, 512, 512, 5, 'clamp')
    const full = createStubContext()
    drawHighlight(full.ctx, 512, 512, 1, 'clamp')
    expect(alphaOf(clamped.gradients[0]?.stops[0]?.color ?? '')).toBe(
      alphaOf(full.gradients[0]?.stops[0]?.color ?? ''),
    )
  })

  it('同一 seed 得到同一组光，换 seed 就变', () => {
    const a = createStubContext()
    drawHighlight(a.ctx, 512, 512, 0.7, 'same')
    const b = createStubContext()
    drawHighlight(b.ctx, 512, 512, 0.7, 'same')
    expect(a.gradients).toEqual(b.gradients)

    const c = createStubContext()
    drawHighlight(c.ctx, 512, 512, 0.7, 'other')
    expect(c.gradients).not.toEqual(a.gradients)
  })

  it('画完把上下文状态还原', () => {
    const stub = createStubContext()
    drawHighlight(stub.ctx, 512, 512, 0.7, 'restore')
    const { saves, restores } = stub.counts()
    expect(saves).toBe(1)
    expect(restores).toBe(1)
  })
})
