import { describe, expect, it } from 'vitest'
import type { PartialConfig } from '@/state/config'
import { drawText } from '@/text/draw'
import { layoutText } from '@/text/layout'
import { createStubContext, createStubMeasure, fontSizeOf, makeConfig } from './helpers'

const measure = createStubMeasure()

function render(overrides: PartialConfig, color = '#FFFFFF') {
  const config = makeConfig(overrides)
  const layout = layoutText(config, 1000, 1000, measure)
  const { ctx, calls, paints } = createStubContext()
  drawText(ctx, layout, config, color)
  return { ctx, calls, paints, layout }
}

// 这一组用例验的是绘制机制，effect 显式钉成 plain：默认的 glow 要画三遍，笔数对不上
const BASE: PartialConfig = {
  text: '猪猪',
  typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, effect: 'plain' },
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

  it('pill 底板取文字色的反色，白字配深底板、深字配白底板', () => {
    const onWhiteInk = render(
      { ...BASE, typography: { ...BASE.typography, effect: 'pill' } },
      '#FFFFFF',
    )
    expect(onWhiteInk.paints[0]?.op).toBe('fill')
    expect(onWhiteInk.paints[0]?.fillStyle).toBe('#141413')

    const onDarkInk = render(
      { ...BASE, typography: { ...BASE.typography, effect: 'pill' } },
      '#141413',
    )
    expect(onDarkInk.paints[0]?.fillStyle).toBe('#FFFFFF')
  })

  it('glow 画三遍字，最后一遍不带阴影', () => {
    const { ctx, calls } = render({
      ...BASE,
      typography: { ...BASE.typography, effect: 'glow', effectStrength: 1 },
    })
    expect(calls.filter((call) => call === 'fillText:猪猪')).toHaveLength(3)
    expect(ctx.shadowBlur).toBe(0)
  })

  it('glow 的光晕：浅色字用自己的颜色，深色字改用白光', () => {
    const light = render(
      { ...BASE, typography: { ...BASE.typography, effect: 'glow', effectStrength: 1 } },
      '#7DD3FC',
    )
    expect(light.paints[0]?.shadowColor).toBe('#7DD3FC')

    const dark = render(
      { ...BASE, typography: { ...BASE.typography, effect: 'glow', effectStrength: 1 } },
      '#141413',
    )
    expect(dark.paints[0]?.shadowColor).toBe('#FFFFFF')
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
        effect: 'plain',
      },
    })
    expect(calls.filter((call) => call.startsWith('fillText'))).toHaveLength(6)
  })
})

describe('逐行字号', () => {
  /** 状态徽章首行 200 px、次行 84 px。这一组盯的是「字段有没有真的被用来落笔」。 */
  const STATUS: PartialConfig = {
    text: '请假中\n09-01',
    typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, effect: 'plain' },
    layout: { kind: 'status' },
  }

  it('次行按自己的字号落笔，不跟着首行走', () => {
    const { paints } = render(STATUS)
    expect(fontSizeOf(paints[0]?.font ?? '')).toBeCloseTo(200)
    expect(fontSizeOf(paints.at(-1)?.font ?? '')).toBeCloseTo(84)
  })

  it('纯文字用途全篇一个字号，行为与原来一致', () => {
    const { paints } = render({
      text: '飞书\n效率',
      typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, effect: 'plain' },
    })
    expect([...new Set(paints.map((paint) => fontSizeOf(paint.font)))]).toEqual([200])
  })

  it('发光按各段自己的字号算模糊半径，次行不被首行的光圈糊掉', () => {
    const { paints } = render({
      ...STATUS,
      typography: {
        sizeMode: 'manual',
        fontSize: 0.2,
        padding: 0.1,
        effect: 'glow',
        effectStrength: 1,
      },
    })
    // 两段各画三遍，每段头一遍的模糊半径是自己字号的 0.45 倍
    expect(paints).toHaveLength(6)
    expect(paints[0]?.shadowBlur).toBeCloseTo(200 * 0.45)
    expect(paints[3]?.shadowBlur).toBeCloseTo(84 * 0.45)
  })

  it('描边也按各段自己的字号算线宽', () => {
    const { paints } = render({
      ...STATUS,
      typography: {
        sizeMode: 'manual',
        fontSize: 0.2,
        padding: 0.1,
        effect: 'outline',
        effectStrength: 1,
      },
    })
    const strokes = paints.filter((paint) => paint.op === 'strokeText')
    expect(strokes).toHaveLength(2)
    expect(fontSizeOf(strokes[0]?.font ?? '')).toBeCloseTo(200)
    expect(fontSizeOf(strokes[1]?.font ?? '')).toBeCloseTo(84)
  })
})
