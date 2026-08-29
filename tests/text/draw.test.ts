import { describe, expect, it } from 'vitest'
import type { PartialConfig } from '@/state/config'
import { drawText } from '@/text/draw'
import { layoutText } from '@/text/layout'
import { createStubContext, createStubMeasure, makeConfig } from './helpers'

const measure = createStubMeasure()

function render(overrides: PartialConfig, color = '#FFFFFF') {
  const config = makeConfig(overrides)
  const layout = layoutText(config, 1000, 1000, measure)
  const { ctx, calls } = createStubContext()
  drawText(ctx, layout, config, color)
  return { ctx, calls, layout }
}

const BASE: PartialConfig = {
  text: '猪猪',
  typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1 },
}

describe('drawText 基本行为', () => {
  it('整行一次画完，并成对 save / restore', () => {
    const { calls } = render(BASE)
    expect(calls.filter((call) => call.startsWith('fillText'))).toEqual(['fillText:猪猪'])
    expect(calls[0]).toBe('save')
    expect(calls[calls.length - 1]).toBe('restore')
  })

  it('设置 font 与左对齐基线，坐标由 layout 决定', () => {
    const { ctx, layout } = render(BASE)
    expect(ctx.font).toBe(layout.font)
    expect(ctx.textAlign).toBe('left')
    expect(ctx.textBaseline).toBe('alphabetic')
  })

  it('空文本不画任何东西', () => {
    const { calls } = render({ ...BASE, text: '   ' })
    expect(calls).toEqual([])
  })
})

describe('文字样式', () => {
  it('outline 先描边后填充，线宽按字号比例', () => {
    const { ctx, calls } = render({
      ...BASE,
      typography: { ...BASE.typography, effect: 'outline', effectStrength: 0.5 },
    })
    expect(calls.indexOf('strokeText:猪猪')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('strokeText:猪猪')).toBeLessThan(calls.indexOf('fillText:猪猪'))
    expect(ctx.lineWidth).toBeCloseTo(200 * 0.06 * 0.5)
  })

  it('pill 先画底板再画字', () => {
    const { calls } = render({
      ...BASE,
      typography: { ...BASE.typography, effect: 'pill' },
    })
    expect(calls.indexOf('fill')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('fill')).toBeLessThan(calls.indexOf('fillText:猪猪'))
    expect(calls).toContain('roundRect')
  })

  it('glow 画三遍字，最后一遍不带阴影', () => {
    const { ctx, calls } = render({
      ...BASE,
      typography: { ...BASE.typography, effect: 'glow', effectStrength: 1 },
    })
    expect(calls.filter((call) => call === 'fillText:猪猪')).toHaveLength(3)
    expect(ctx.shadowBlur).toBe(0)
  })

  it('shadow 留下模糊与偏移', () => {
    const { calls } = render({
      ...BASE,
      typography: { ...BASE.typography, effect: 'shadow', effectStrength: 1 },
    })
    expect(calls.filter((call) => call === 'fillText:猪猪')).toHaveLength(1)
  })
})

describe('字距与竖排', () => {
  it('原生 letterSpacing 可用时整行绘制', () => {
    const { ctx, calls } = render({
      ...BASE,
      typography: { ...BASE.typography, letterSpacing: 0.1 },
    })
    expect(ctx.letterSpacing).toBe('20px')
    expect(calls.filter((call) => call.startsWith('fillText'))).toHaveLength(1)
  })

  it('引擎没有 letterSpacing 时逐字补偿', () => {
    const config = makeConfig({
      ...BASE,
      typography: { ...BASE.typography, letterSpacing: 0.1 },
    })
    const layout = layoutText(config, 1000, 1000, measure)
    const { ctx, calls } = createStubContext()
    Reflect.deleteProperty(ctx, 'letterSpacing')
    drawText(ctx, layout, config, '#FFFFFF')
    expect(calls.filter((call) => call.startsWith('fillText'))).toEqual([
      'fillText:猪',
      'fillText:猪',
    ])
  })

  it('竖排逐字绘制', () => {
    const { calls } = render({
      text: '一二三四五六',
      typography: {
        sizeMode: 'manual',
        fontSize: 0.2,
        padding: 0.1,
        vertical: true,
      },
    })
    expect(calls.filter((call) => call.startsWith('fillText'))).toHaveLength(6)
  })
})
