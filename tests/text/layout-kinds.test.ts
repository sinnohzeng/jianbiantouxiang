/**
 * 两种版式用途的落位。用 manual 字号把求解那一步固定住，
 * 剩下的全是可以手算的几何：安全框 100..900，单行块高恰好等于字号。
 */

import { describe, expect, it } from 'vitest'
import type { PartialConfig } from '@/state/config'
import { layoutText } from '@/text/layout'
import { createStubMeasure, fontSizeOf, makeConfig } from './helpers'

const measure = createStubMeasure()

function layout(overrides: PartialConfig, width = 1000, height = 1000) {
  return layoutText(makeConfig(overrides), width, height, measure)
}

/** 1000 × 1000、边距 10 %、圆角 20 %：安全框是 (100, 100, 800, 800)，不被圆角收缩。 */
const SAFE = { x: 100, y: 100, width: 800, height: 800 }

describe('纯文字用途', () => {
  it('安全框按边距与圆角算，圆角 20 % 下不收缩', () => {
    const result = layout({ text: '中', typography: { sizeMode: 'manual', fontSize: 0.2 } })
    expect(result.safeBox).toEqual(SAFE)
  })

  it('行级字号与水平补偿分别落到每一行', () => {
    const result = layout({
      text: '飞书\n效率',
      typography: {
        sizeMode: 'manual',
        fontSize: 0.2,
        padding: 0.1,
        lineSizeScales: [1, 0.5],
        lineOffsetsX: [0, 0.02],
      },
    })

    expect(result.lines[0]?.x).toBeCloseTo(300)
    expect(result.lines[1]?.x).toBeCloseTo(420)
    expect(fontSizeOf(result.lines[0]?.font ?? '')).toBeCloseTo(200)
    expect(fontSizeOf(result.lines[1]?.font ?? '')).toBeCloseTo(100)
  })
})

describe('状态徽章', () => {
  /** 首行 200 px，次行 200 × 0.62 = 124 px，行距 200 × 0.18 = 36 px。 */
  const STATUS: PartialConfig = {
    text: '请假中\n09-01',
    typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1 },
    layout: { kind: 'status' },
  }

  it('两块各自成行，次行带自己的字号', () => {
    const result = layout(STATUS)
    expect(result.lines.map((line) => line.text)).toEqual(['请假中', '09-01'])
    expect(result.fontSizePx).toBeCloseTo(200)
    expect(result.lines[0]?.font).toContain('200px')
    expect(fontSizeOf(result.lines[1]?.font ?? '')).toBeCloseTo(124)
  })

  it('整体在安全框里居中，块尺寸等于两块加行距', () => {
    const result = layout(STATUS)
    // 宽取两块较宽的那个：600 与 372
    expect(result.box.width).toBeCloseTo(600)
    // 高是 200 + 36 + 124
    expect(result.box.height).toBeCloseTo(360)
    expect(result.box.x).toBeCloseTo(200)
    expect(result.box.y).toBeCloseTo(320)
  })

  it('次行短的时候在整体宽度里居中，不靠左', () => {
    const result = layout(STATUS)
    expect(result.lines[0]?.x).toBeCloseTo(200)
    // 200 + (600 - 372) / 2
    expect(result.lines[1]?.x).toBeCloseTo(314)
  })

  it('行距按首行字号算，次行压在首行下面', () => {
    const result = layout(STATUS)
    // 首行基线 340 + 160，次行基线 340 + 200 + 36 + 99.2
    expect(result.lines[0]?.y).toBeCloseTo(480)
    expect(result.lines[1]?.y).toBeCloseTo(655.2)
  })

  it('只有一段时退化成一块，没有行距', () => {
    const result = layout({ ...STATUS, text: '请假中' })
    expect(result.lines).toHaveLength(1)
    expect(result.box.height).toBeCloseTo(200)
    expect(result.box.y).toBeCloseTo(400)
  })

  it('第二行字号比例直接改次行字号', () => {
    const result = layout({
      ...STATUS,
      typography: { ...STATUS.typography, lineSizeScales: [1, 0.6] },
    })
    expect(fontSizeOf(result.lines[1]?.font ?? '')).toBeCloseTo(120)
  })

  it('锚点与偏移在这个用途下不生效', () => {
    const moved = layout({
      ...STATUS,
      typography: { ...STATUS.typography, anchor: 'tl', offsetX: 0.2, offsetY: -0.2 },
    })
    const centered = layout(STATUS)
    expect(moved.box.x).toBeCloseTo(centered.box.x)
    expect(moved.box.y).toBeCloseTo(centered.box.y)
  })

  it('竖排在这个用途下不生效', () => {
    const result = layout({ ...STATUS, typography: { ...STATUS.typography, vertical: true } })
    expect(result.vertical).toBe(false)
    expect(result.lines[0]?.glyphs).toHaveLength(0)
  })

  it('自动字号把整体撑到安全框以内', () => {
    const result = layout({
      text: '休假中\n2026-09-01 至 09-07',
      typography: { padding: 0.1 },
      layout: { kind: 'status' },
    })
    expect(result.overflow).toBe(false)
    expect(result.box.width).toBeLessThanOrEqual(SAFE.width + 1e-6)
    expect(result.box.height).toBeLessThanOrEqual(SAFE.height + 1e-6)
    expect(result.box.x).toBeGreaterThanOrEqual(SAFE.x - 1e-6)
    expect(result.box.y).toBeGreaterThanOrEqual(SAFE.y - 1e-6)
  })
})

describe('圆形画布下的两种用途', () => {
  const ROUND: PartialConfig = {
    canvas: { shape: 'circle' },
    typography: { padding: 0.1 },
  }

  /** 圆形安全框按几何收缩：内接矩形半对角线不超过 r。 */
  function insideCircle(x: number, y: number, size = 1000): boolean {
    const dx = x - size / 2
    const dy = y - size / 2
    return dx * dx + dy * dy <= (size / 2) ** 2 + 1e-6
  }

  for (const kind of ['text', 'status'] as const) {
    it(`${kind} 的块四角都在圆内`, () => {
      const result = layout({ ...ROUND, text: '请假中\n09-01', layout: { kind } })
      const box = result.box
      expect(insideCircle(box.x, box.y)).toBe(true)
      expect(insideCircle(box.x + box.width, box.y)).toBe(true)
      expect(insideCircle(box.x, box.y + box.height)).toBe(true)
      expect(insideCircle(box.x + box.width, box.y + box.height)).toBe(true)
    })
  }
})
