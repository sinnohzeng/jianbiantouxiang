import { describe, expect, it } from 'vitest'
import { applyFilmGrain } from '@/engine/film-grain'

function createStubContext() {
  const fills: string[] = []
  const ctx = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: null as unknown,
    createPattern() {
      return null
    },
    fillRect() {
      fills.push(ctx.globalCompositeOperation)
    },
    save() {},
    restore() {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills }
}

/** jsdom 拿不到真实 2D 上下文，这里守的是各处降级分支不炸。 */
describe('applyFilmGrain 的降级分支', () => {
  it('强度为 0 时不动画布', () => {
    const stub = createStubContext()
    applyFilmGrain(stub.ctx, 512, 512, 0, 'seed')
    expect(stub.fills).toHaveLength(0)
  })

  it('尺寸非法时不动画布', () => {
    const stub = createStubContext()
    applyFilmGrain(stub.ctx, 0, 512, 0.5, 'seed')
    applyFilmGrain(stub.ctx, 512, 0, 0.5, 'seed')
    expect(stub.fills).toHaveLength(0)
  })

  it('造不出噪声图时安静退出', () => {
    const stub = createStubContext()
    expect(() => applyFilmGrain(stub.ctx, 512, 512, 0.5, 'seed')).not.toThrow()
    expect(stub.fills).toHaveLength(0)
  })
})
