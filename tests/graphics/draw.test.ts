import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawGraphic } from '@/graphics/draw'
import type { Graphic } from '@/graphics/types'
import { normalizeConfig } from '@/state/config'
import { installFakeCanvas, opNames } from '../export/fake-canvas'

afterEach(() => {
  vi.restoreAllMocks()
})

function brandConfig(mono: boolean, id = 'lark') {
  return normalizeConfig({ layout: { icon: { source: 'brand', id, mono } } })
}

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

  it('单色档把图形压成剪影再着成文字色，主画布的合成状态不动', () => {
    // jsdom 没有真的 canvas 后端，离屏那张换成记录型上下文
    const fake = installFakeCanvas()
    const image = { width: 128, height: 128 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 128, height: 128 }
    const { ctx, calls } = context()

    const rect = { x: 10, y: 20, width: 99.2, height: 80.4 }
    drawGraphic(ctx, graphic, rect, brandConfig(true), '#8899aa')

    // 离屏那张按落位矩形向上取整开，画完图再整块填色
    const [entry] = fake.entries
    expect(opNames(entry?.ops ?? [])).toEqual([
      'drawImage',
      'set:globalCompositeOperation',
      'set:fillStyle',
      'fillRect',
    ])
    expect(entry?.ops[0]?.args).toEqual([image, 0, 0, 100, 81])
    expect(entry?.ops[1]?.args[0]).toBe('source-in')
    expect(entry?.ops[2]?.args[0]).toBe('#8899aa')
    expect(entry?.ops[3]?.args).toEqual([0, 0, 100, 81])
    // 用完立刻缩到 1×1 交还显存，导出 8192 时这张也有上千像素见方
    expect(entry?.canvas.width).toBe(1)
    expect(entry?.canvas.height).toBe(1)

    // 主画布只收到那一次贴回，原图一次都没直接画上去
    expect(calls.filter((call) => call.startsWith('drawImage:'))).toEqual([
      'drawImage:10,20,99.2,80.4',
    ])
    expect(ctx.globalCompositeOperation).toBeUndefined()
  })

  it('官方单色稿走的是同一条着色路径，跟着文字色走而不是钉死纯白', () => {
    // github 有官方单色稿，brand.ts 那一层已经把它换成 github-light 了，
    // 到这里仍要再着一次色：单色不等于单白
    const fake = installFakeCanvas()
    const image = { width: 64, height: 64 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 64, height: 64 }
    const { ctx } = context()

    const config = brandConfig(true, 'github-light')
    drawGraphic(ctx, graphic, { x: 0, y: 0, width: 64, height: 64 }, config, '#112233')

    expect(fake.opsAt(0).find((op) => op.name === 'set:fillStyle')?.args[0]).toBe('#112233')
  })

  it('单色只认品牌来源，emoji 与上传图形照旧原色', () => {
    const fake = installFakeCanvas()
    const image = { width: 64, height: 64 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 64, height: 64 }
    const { ctx, calls } = context()

    // 挑过品牌再换成 emoji 时 mono 还留在配置里，不能拿它去压平用户的图
    const config = normalizeConfig({
      layout: { icon: { source: 'emoji', id: '1f334', mono: true } },
    })
    drawGraphic(ctx, graphic, { x: 0, y: 0, width: 64, height: 64 }, config, '#112233')

    expect(fake.entries).toHaveLength(0)
    expect(calls).toContain('drawImage:0,0,64,64')
  })

  it('拿不到离屏上下文时退回原色，图形位不会空掉', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const image = { width: 64, height: 64 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 64, height: 64 }
    const { ctx, calls } = context()

    drawGraphic(ctx, graphic, { x: 0, y: 0, width: 64, height: 64 }, brandConfig(true), '#112233')

    expect(calls).toContain('drawImage:0,0,64,64')
  })

  it('零尺寸矩形不落笔', () => {
    const image = { width: 1, height: 1 } as unknown as CanvasImageSource
    const graphic: Graphic = { kind: 'image', image, width: 1, height: 1 }
    const { ctx, calls } = context()
    drawGraphic(ctx, graphic, { x: 0, y: 0, width: 0, height: 0 }, normalizeConfig({}), '#fff')
    expect(calls).toEqual([])
  })
})
