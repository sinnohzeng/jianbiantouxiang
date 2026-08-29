import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '@/state/config'
import { cssFallbackBackground, fallbackLayers, rgba } from '@/engine/css-fallback'

const COLORS = ['#dbeafe', '#c7d2fe', '#e9d5ff', '#fbcfe8']

function countLayers(css: string): number {
  return css.split('radial-gradient(').length - 1
}

describe('rgba', () => {
  it('接受六位与三位 hex', () => {
    expect(rgba('#ff8800', 1)).toBe('rgba(255, 136, 0, 1)')
    expect(rgba('#f80', 1)).toBe('rgba(255, 136, 0, 1)')
  })

  it('透明度夹到 0 到 1 并限位小数', () => {
    expect(rgba('#000000', 2)).toBe('rgba(0, 0, 0, 1)')
    expect(rgba('#000000', -1)).toBe('rgba(0, 0, 0, 0)')
    expect(rgba('#000000', 0.123456)).toBe('rgba(0, 0, 0, 0.123)')
  })

  it('非法颜色退到中性灰而不是抛错', () => {
    expect(rgba('not a color', 1)).toBe('rgba(148, 163, 184, 1)')
  })
})

describe('fallbackLayers', () => {
  it('给出 4 到 6 层，参数都在合法区间', () => {
    for (let i = 0; i < 60; i += 1) {
      const config = { ...DEFAULT_CONFIG, seed: `layer-${i}` }
      const layers = fallbackLayers(config, COLORS)
      expect(layers.length).toBeGreaterThanOrEqual(4)
      expect(layers.length).toBeLessThanOrEqual(6)
      for (const layer of layers) {
        expect(layer.x).toBeGreaterThanOrEqual(5)
        expect(layer.x).toBeLessThanOrEqual(95)
        expect(layer.y).toBeGreaterThanOrEqual(5)
        expect(layer.y).toBeLessThanOrEqual(95)
        expect(layer.radiusX).toBeGreaterThanOrEqual(20)
        expect(layer.radiusX).toBeLessThanOrEqual(140)
        expect(layer.radiusY).toBeGreaterThanOrEqual(20)
        expect(layer.radiusY).toBeLessThanOrEqual(140)
        expect(layer.alpha).toBeGreaterThanOrEqual(0.55)
        expect(layer.alpha).toBeLessThanOrEqual(0.95)
        expect(COLORS).toContain(layer.color)
      }
    }
  })

  it('4 到 6 层都出现过', () => {
    const sizes = new Set<number>()
    for (let i = 0; i < 80; i += 1) {
      sizes.add(fallbackLayers({ ...DEFAULT_CONFIG, seed: `spread-${i}` }, COLORS).length)
    }
    expect([...sizes].sort()).toEqual([4, 5, 6])
  })

  it('颜色不够时循环取用', () => {
    const layers = fallbackLayers(DEFAULT_CONFIG, ['#ffffff', '#000000'])
    expect(new Set(layers.map((layer) => layer.color))).toEqual(new Set(['#ffffff', '#000000']))
  })

  it('空色板也能出层', () => {
    expect(fallbackLayers(DEFAULT_CONFIG, []).length).toBeGreaterThanOrEqual(4)
  })
})

describe('cssFallbackBackground', () => {
  it('色斑在前实色在后，层数与 fallbackLayers 一致', () => {
    const config = { ...DEFAULT_CONFIG, seed: 'css' }
    const css = cssFallbackBackground(config, COLORS)
    expect(css.startsWith('radial-gradient(')).toBe(true)
    expect(countLayers(css)).toBe(fallbackLayers(config, COLORS).length)
    expect(css.endsWith(')')).toBe(true)
    expect(css).toContain('linear-gradient(rgba(219, 234, 254, 1), rgba(219, 234, 254, 1))')
  })

  it('每层都是 ellipse 加百分比定位，且末端全透明', () => {
    const css = cssFallbackBackground({ ...DEFAULT_CONFIG, seed: 'shape' }, COLORS)
    const radialParts = css.split('radial-gradient(').slice(1)
    for (const part of radialParts) {
      expect(part).toMatch(/^ellipse [\d.]+% [\d.]+% at [\d.]+% [\d.]+%,/)
      expect(part).toMatch(/rgba\(\d+, \d+, \d+, 0\) 100%\)/)
    }
  })

  it('同一配置给同一字符串，换 seed 就变', () => {
    const a = cssFallbackBackground({ ...DEFAULT_CONFIG, seed: 'x' }, COLORS)
    expect(cssFallbackBackground({ ...DEFAULT_CONFIG, seed: 'x' }, COLORS)).toBe(a)
    expect(cssFallbackBackground({ ...DEFAULT_CONFIG, seed: 'y' }, COLORS)).not.toBe(a)
  })

  it('不传颜色时从配色表取', () => {
    const css = cssFallbackBackground(DEFAULT_CONFIG)
    expect(countLayers(css)).toBeGreaterThanOrEqual(4)
    expect(css).toContain('linear-gradient(')
  })
})
