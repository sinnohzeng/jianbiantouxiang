import { describe, expect, it } from 'vitest'
import { layoutText } from '@/text/layout'
import type { PartialConfig } from '@/state/config'
import { createStubMeasure, makeConfig } from './helpers'

const measure = createStubMeasure()

function layout(overrides: PartialConfig, graphic?: { width: number; height: number } | null) {
  const config = makeConfig(overrides)
  return layoutText(config, 1000, 1000, measure, graphic)
}

describe('单行落位', () => {
  it('单行水平垂直都居中，坐标由度量决定', () => {
    const result = layout({
      text: '中文',
      typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, effect: 'plain' },
    })
    expect(result.lines).toHaveLength(1)
    const line = result.lines[0]!
    // 宽 2×200=400，安全框 100..900，居中后左边缘 300
    expect(line.x).toBeCloseTo(300)
    // 块高 200，安全框内垂直居中，基线 = 400 + ascent 160
    expect(line.y).toBeCloseTo(560)
  })

  it('空文本无行，盒子为空', () => {
    const result = layout({ text: '   ' })
    expect(result.lines).toHaveLength(0)
    expect(result.box.width).toBe(0)
  })
})

describe('两行栈', () => {
  const TWO: PartialConfig = {
    text: '甲甲\n乙乙乙',
    typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, effect: 'plain' },
  }

  it('主行在上，次行在下，中间留白按主行字号 0.18', () => {
    const result = layout(TWO)
    expect(result.lines).toHaveLength(2)
    const [first, second] = result.lines
    const gap = (second!.y - second!.ascent) - (first!.y + first!.descent)
    expect(gap).toBeCloseTo(first!.fontSizePx * 0.18, 5)
  })

  it('两行各自水平居中', () => {
    const result = layout(TWO)
    const [first, second] = result.lines
    expect(first!.x).toBeCloseTo(500 - first!.width / 2)
    expect(second!.x).toBeCloseTo(500 - second!.width / 2)
  })

  it('包围盒覆盖两行的墨迹并集', () => {
    const result = layout(TWO)
    const left = Math.min(...result.lines.map((line) => line.x))
    const right = Math.max(...result.lines.map((line) => line.x + line.width))
    expect(result.box.x).toBeCloseTo(left)
    expect(result.box.width).toBeCloseTo(right - left)
  })
})

describe('行级水平补偿互相独立', () => {
  const TWO: PartialConfig = {
    text: '甲甲\n乙乙乙',
    typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, effect: 'plain' },
  }

  it('往左移第一行：第一行位移，第二行像素位置不变', () => {
    // 回归用例：v3 的 minOffset 归一化在这个方向上会把第二行推走
    const before = layout(TWO)
    const after = layout({
      ...TWO,
      typography: { ...TWO.typography, lineOffsetsX: [-0.1, 0] },
    })
    expect(after.lines[0]!.x).toBeCloseTo(before.lines[0]!.x - 100)
    expect(after.lines[1]!.x).toBeCloseTo(before.lines[1]!.x)
    expect(after.lines[1]!.y).toBeCloseTo(before.lines[1]!.y)
  })

  it('往右移第一行：第二行同样不动', () => {
    const before = layout(TWO)
    const after = layout({
      ...TWO,
      typography: { ...TWO.typography, lineOffsetsX: [0.1, 0] },
    })
    expect(after.lines[0]!.x).toBeCloseTo(before.lines[0]!.x + 100)
    expect(after.lines[1]!.x).toBeCloseTo(before.lines[1]!.x)
  })

  it('移第二行不影响第一行，参数跟槽位走', () => {
    const before = layout(TWO)
    const after = layout({
      ...TWO,
      typography: { ...TWO.typography, lineOffsetsX: [0, 0.05] },
    })
    expect(after.lines[1]!.x).toBeCloseTo(before.lines[1]!.x + 50)
    expect(after.lines[0]!.x).toBeCloseTo(before.lines[0]!.x)
  })

  it('晋升场景：补偿仍只动自己那行', () => {
    const before = layout({ ...TWO, text: '\n乙乙乙' })
    const after = layout({
      ...TWO,
      text: '\n乙乙乙',
      typography: { ...TWO.typography, lineOffsetsX: [0, 0.1] },
    })
    expect(after.lines).toHaveLength(1)
    expect(after.lines[0]!.x).toBeCloseTo(before.lines[0]!.x + 100)
  })
})

describe('图标进栈', () => {
  const GRAPHIC = { width: 100, height: 100 }

  it('有文字时图标占安全框顶部，文字在剩余区域垂直居中', () => {
    const result = layout(
      {
        text: '产品设计部',
        typography: { sizeMode: 'manual', fontSize: 0.1, padding: 0.1, effect: 'plain' },
        layout: { graphic: 0.5, icon: { source: 'builtin', id: 'tree-palm' } },
      },
      GRAPHIC,
    )
    const graphic = result.graphic!
    expect(graphic.height).toBeCloseTo(400)
    expect(graphic.y).toBeCloseTo(100)
    expect(graphic.x).toBeCloseTo(300)
    // 文字全部落在图标与留白之下
    const textTop = Math.min(...result.lines.map((line) => line.y - line.ascent))
    expect(textTop).toBeGreaterThan(graphic.y + graphic.height)
  })

  it('图标存在但文字为空：图标在安全框居中', () => {
    const result = layout(
      {
        text: '',
        typography: { padding: 0.1 },
        layout: { graphic: 0.52, icon: { source: 'builtin', id: 'tree-palm' } },
      },
      GRAPHIC,
    )
    expect(result.lines).toHaveLength(0)
    const graphic = result.graphic!
    expect(graphic.width).toBeCloseTo(800 * 0.52)
    expect(graphic.x).toBeCloseTo(100 + (800 - graphic.width) / 2)
    expect(graphic.y).toBeCloseTo(graphic.x)
  })

  it('图标来源是 none 时，传了图形尺寸也不进栈', () => {
    const result = layout(
      {
        text: '文字',
        typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1 },
        layout: { icon: { source: 'none', id: '' } },
      },
      GRAPHIC,
    )
    expect(result.graphic).toBeUndefined()
  })

  it('宽图形按安全框宽度收边，不拉伸', () => {
    const result = layout(
      {
        text: '文字',
        typography: { sizeMode: 'manual', fontSize: 0.1, padding: 0.1 },
        layout: { graphic: 0.8, icon: { source: 'builtin', id: 'wide' } },
      },
      { width: 400, height: 100 },
    )
    const graphic = result.graphic!
    expect(graphic.width).toBeLessThanOrEqual(800 + 1e-6)
    expect(graphic.width / graphic.height).toBeCloseTo(4)
  })
})
