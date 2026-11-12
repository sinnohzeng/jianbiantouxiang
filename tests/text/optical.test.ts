import { describe, it, expect } from 'vitest'
import { maskStats, opticalShift, groupCenterShift, applyOpticalLayout } from '@/text/optical'
import { normalizeConfig } from '@/state/config'
import { badgeLayout } from '@/automation/layout'

describe('bounded optical diagnostics', () => {
  it('symmetric masks have zero bias, blank masks have no claimed center', () => {
    const data = new Uint8ClampedArray(8 * 8 * 4)
    expect(maskStats(data, 8, 8)).toBeNull()
    for (const x of [1, 6]) for (const y of [2, 5]) data[(y * 8 + x) * 4 + 3] = 255
    expect(maskStats(data, 8, 8)).toMatchObject({ x: 4, y: 4, mass: 4 })
  })
  it('damps mass bias instead of forcing it to zero; caps extreme shapes and ignores noise', () => {
    expect(opticalShift(0.1, 100)).toBe(0)
    expect(opticalShift(4, 100)).toBe(1)
    expect(opticalShift(149, 100)).toBe(1.5)
    expect(opticalShift(-178, 100)).toBe(-1.5)
  })
  it('off and manual controls preserve all geometric positions without accessing a canvas', () => {
    const layout = badgeLayout(512, 0.06, 0.38, ['飞书', '研发'], null, (_, s) => ({
      left: 0,
      right: s,
      ascent: s,
      descent: 0,
    }))
    for (const config of [
      normalizeConfig({ typography: { optical: false } }),
      normalizeConfig({ typography: { line1: { offsetX: 0.01 } } }),
    ]) {
      const result = applyOpticalLayout(layout, config, 512, 512, null)
      expect(result.lines).toEqual(layout.lines)
      expect(result.optical?.groupShiftY).toBe(0)
    }
  })
})

it('整组纵向修正把可见边界中心移到画布中心，亚像素不动，极端留白截断', () => {
  expect(groupCenterShift(50, 50, 100)).toBe(0)
  expect(groupCenterShift(52, 50, 100)).toBe(-2)
  expect(groupCenterShift(48.5, 50, 100)).toBe(1.5)
  expect(groupCenterShift(60, 50, 100)).toBeCloseTo(-3.5)
  expect(groupCenterShift(50.04, 50, 100)).toBe(0)
})
