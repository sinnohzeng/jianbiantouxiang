import { describe, expect, it } from 'vitest'
import { DISPLAY_PALETTES, PALETTE_DISPLAY_ORDER } from '@/palettes/display-order'
import { PALETTES, PLATE_HINT_IDS } from '@/palettes/palettes'

describe('仅选择器的配色显示顺序', () => {
  it('57 套各出现一次，使用原对象且不改变随机池的旧顺序', () => {
    expect(PALETTE_DISPLAY_ORDER).toHaveLength(57)
    expect(new Set(PALETTE_DISPLAY_ORDER).size).toBe(57)
    expect([...PALETTE_DISPLAY_ORDER].sort()).toEqual(PALETTES.map((p) => p.id).sort())
    expect(PALETTES[0]!.id).toBe('glacier')
    expect(DISPLAY_PALETTES[0]!.id).toBe('steel-slate')
    expect(DISPLAY_PALETTES.every((p) => PALETTES.includes(p))).toBe(true)
  })
  it('前排都是白字深色且排除既有低对比提示配色', () => {
    expect(
      DISPLAY_PALETTES.slice(0, 13).every(
        (p) =>
          p.tone === 'dark' && p.text.toUpperCase() === '#FFFFFF' && !PLATE_HINT_IDS.includes(p.id),
      ),
    ).toBe(true)
  })
  it('高饱和实验色在全部列表末尾，明暗属性不妨碍用途排序', () => {
    expect(DISPLAY_PALETTES.slice(-3).map((p) => p.id)).toEqual([
      'electric-blue',
      'aurora-violet',
      'neon-tide',
    ])
  })
})
