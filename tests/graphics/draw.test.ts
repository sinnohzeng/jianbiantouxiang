import { describe, expect, it } from 'vitest'
import { drawGraphic } from '@/graphics/draw'
import type { Graphic } from '@/graphics/types'
import { normalizeConfig } from '@/state/config'

function context() {
  const calls: string[] = []
  return {
    calls,
    ctx: {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      translate: (...args: unknown[]) => calls.push(`translate:${args.join(',')}`),
      scale: (...args: unknown[]) => calls.push(`scale:${args.join(',')}`),
      drawImage: (...args: unknown[]) => calls.push(`drawImage:${args.slice(1).join(',')}`),
      stroke: (path: unknown) => calls.push(`stroke:${String(path)}`),
    } as unknown as CanvasRenderingContext2D,
  }
}

describe('drawGraphic 消费端', () => {
  it('图片类图形直接 drawImage 到排版矩形', () => {
    const image = { width: 128, height: 128 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 128, height: 128 }
    const { ctx, calls } = context()
    drawGraphic(ctx, graphic, { x: 10, y: 20, width: 100, height: 80 }, normalizeConfig({}), '#fff')
    expect(calls).toContain('drawImage:10,20,100,80')
  })

  it('内置图形必须调用 stroke 落笔，颜色与文字一致', () => {
    const path = { marker: 'path' } as unknown as Path2D
    const graphic: Graphic = { kind: 'lucide', path, width: 24, height: 24 }
    const { ctx, calls } = context()
    drawGraphic(
      ctx,
      graphic,
      { x: 0, y: 0, width: 120, height: 120 },
      normalizeConfig({ typography: { effect: 'plain' } }),
      '#123456',
    )
    expect(calls.filter((call) => call.startsWith('stroke:'))).toHaveLength(1)
    expect(ctx.strokeStyle).toBe('#123456')
  })

  it('零尺寸矩形不落笔', () => {
    const image = { width: 1, height: 1 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 1, height: 1 }
    const { ctx, calls } = context()
    drawGraphic(ctx, graphic, { x: 0, y: 0, width: 0, height: 0 }, normalizeConfig({}), '#fff')
    expect(calls).toEqual([])
  })
})
