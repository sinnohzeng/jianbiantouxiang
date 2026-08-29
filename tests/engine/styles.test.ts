import { describe, expect, it } from 'vitest'
import type { ShaderMountUniforms } from '@paper-design/shaders'
import { DEFAULT_CONFIG, STYLE_IDS, normalizeConfig } from '@/state/config'
import type { AvatarConfig, StyleId } from '@/state/config'
import { mulberry32 } from '@/engine/seed'
import { STYLES, STYLE_LIST, getStyle, planRender } from '@/engine/styles'

const COLORS = ['#dbeafe', '#c7d2fe', '#e9d5ff', '#fbcfe8', '#fde68a', '#a5f3fc']

/** 用固定种子造配置，保证这套遍历本身是可复现的。 */
function sweepConfigs(count: number): AvatarConfig[] {
  const rng = mulberry32('styles-sweep')
  const configs: AvatarConfig[] = []
  for (let i = 0; i < count; i += 1) {
    const style = STYLE_IDS[Math.floor(rng() * STYLE_IDS.length)] as StyleId
    configs.push(
      normalizeConfig({
        ...DEFAULT_CONFIG,
        seed: `sweep-${i}-${rng().toString(36).slice(2)}`,
        style,
        styleParams: {
          intensity: rng(),
          softness: rng(),
          grain: rng(),
          scale: 0.5 + rng() * 1.5,
          rotation: rng() * 360,
        },
      }),
    )
  }
  return configs
}

function num(uniforms: ShaderMountUniforms, key: string): number {
  const value = uniforms[key]
  expect(typeof value, `${key} 应为数值`).toBe('number')
  return value as number
}

function inRange(uniforms: ShaderMountUniforms, key: string, min: number, max: number): void {
  const value = num(uniforms, key)
  expect(value, `${key}=${value} 超出 [${min}, ${max}]`).toBeGreaterThanOrEqual(min)
  expect(value, `${key}=${value} 超出 [${min}, ${max}]`).toBeLessThanOrEqual(max)
}

describe('STYLES 表', () => {
  it('四种 style 齐全，各自能按需取到一段 shader 源码', async () => {
    expect(STYLE_LIST.map((style) => style.id)).toEqual(['mesh', 'flow', 'silk', 'grain'])
    for (const id of STYLE_IDS) {
      const style = getStyle(id)
      expect(style.id).toBe(id)
      // shader 源码走 import()，这里顺带守住四个动态模块确实存在且导出对得上
      await expect(style.loadFragmentShader()).resolves.toContain('#version 300 es')
      expect(style.maxColors).toBeGreaterThanOrEqual(7)
    }
  })

  it('四段 shader 各不相同，动态入口没接错', async () => {
    const sources = await Promise.all(STYLE_LIST.map((style) => style.loadFragmentShader()))
    expect(new Set(sources).size).toBe(STYLE_LIST.length)
  })

  it('每种 style 都暴露五个滑杆，区间与配置契约一致', () => {
    for (const style of STYLE_LIST) {
      expect(style.params.map((param) => param.key)).toEqual([
        'intensity',
        'softness',
        'grain',
        'scale',
        'rotation',
      ])
      for (const param of style.params) {
        expect(param.labelKey).toMatch(/^style\./)
        expect(param.min).toBeLessThan(param.max)
        expect(param.step).toBeGreaterThan(0)
      }
      const scale = style.params.find((param) => param.key === 'scale')
      expect(scale?.min).toBe(0.5)
      expect(scale?.max).toBe(2)
      const rotation = style.params.find((param) => param.key === 'rotation')
      expect(rotation?.max).toBe(360)
    }
  })

  it('只有 silk 缺 shader 颗粒，需要由 2D 阶段补', () => {
    expect(STYLES.silk.hasShaderGrain).toBe(false)
    expect(STYLES.mesh.hasShaderGrain).toBe(true)
    expect(STYLES.flow.hasShaderGrain).toBe(true)
    expect(STYLES.grain.hasShaderGrain).toBe(true)
  })

  it('用噪声贴图的只有 silk 与 grain', () => {
    expect(STYLES.silk.needsNoiseTexture).toBe(true)
    expect(STYLES.grain.needsNoiseTexture).toBe(true)
    expect(STYLES.mesh.needsNoiseTexture).toBe(false)
    expect(STYLES.flow.needsNoiseTexture).toBe(false)
  })
})

describe('planRender 的确定性', () => {
  it('同一 config 两次得到同一份 uniforms 与 frame', () => {
    for (const config of sweepConfigs(24)) {
      expect(planRender(config, COLORS)).toEqual(planRender(config, COLORS))
    }
  })

  it('换 seed 就换构图', () => {
    const base = { ...DEFAULT_CONFIG, seed: 'seed-a' }
    const other = { ...DEFAULT_CONFIG, seed: 'seed-b' }
    expect(planRender(base, COLORS).uniforms).not.toEqual(planRender(other, COLORS).uniforms)
  })

  it('seed 为空时由文字派生，改文字即改构图', () => {
    const a = planRender({ ...DEFAULT_CONFIG, seed: '', text: '产品设计部' }, COLORS)
    const b = planRender({ ...DEFAULT_CONFIG, seed: '', text: '技术中台' }, COLORS)
    expect(a.uniforms).not.toEqual(b.uniforms)
  })

  it('静态的 mesh 不用 frame，动画类 style 的 frame 落在取帧区间', () => {
    expect(planRender({ ...DEFAULT_CONFIG, style: 'mesh' }, COLORS).frame).toBe(0)
    for (const style of ['flow', 'silk', 'grain'] as const) {
      const { frame } = planRender({ ...DEFAULT_CONFIG, style, seed: `frame-${style}` }, COLORS)
      expect(frame).toBeGreaterThanOrEqual(0)
      expect(frame).toBeLessThanOrEqual(20000)
    }
  })
})

describe('uniforms 落在 shader 的合法区间', () => {
  const configs = sweepConfigs(160)

  it('共用的尺寸 uniform 合法', () => {
    for (const config of configs) {
      const { uniforms } = planRender(config, COLORS)
      expect(num(uniforms, 'u_fit')).toBe(2)
      inRange(uniforms, 'u_scale', 0.5, 2)
      inRange(uniforms, 'u_rotation', 0, 360)
      inRange(uniforms, 'u_originX', 0, 1)
      inRange(uniforms, 'u_originY', 0, 1)
      inRange(uniforms, 'u_offsetX', -1, 1)
      inRange(uniforms, 'u_offsetY', -1, 1)
      expect(num(uniforms, 'u_worldWidth')).toBe(0)
      expect(num(uniforms, 'u_worldHeight')).toBe(0)
    }
  })

  it('颜色转成 0 到 1 的 RGBA，数量不超过 shader 上限', () => {
    for (const config of configs) {
      const style = getStyle(config.style)
      const { uniforms } = planRender(config, COLORS)
      const colors = uniforms.u_colors as number[][]
      expect(Array.isArray(colors)).toBe(true)
      expect(colors.length).toBeGreaterThanOrEqual(2)
      expect(colors.length).toBeLessThanOrEqual(style.maxColors)
      expect(num(uniforms, 'u_colorsCount')).toBe(colors.length)
      for (const color of colors) {
        expect(color).toHaveLength(4)
        for (const channel of color) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('mesh 的 staticMeshGradient 参数合法', () => {
    for (const config of configs) {
      const { uniforms } = planRender({ ...config, style: 'mesh' }, COLORS)
      inRange(uniforms, 'u_positions', 0, 100)
      inRange(uniforms, 'u_waveX', 0, 1)
      inRange(uniforms, 'u_waveY', 0, 1)
      inRange(uniforms, 'u_waveXShift', 0, 1)
      inRange(uniforms, 'u_waveYShift', 0, 1)
      inRange(uniforms, 'u_mixing', 0.35, 1)
      inRange(uniforms, 'u_grainMixer', 0, 0.55)
      inRange(uniforms, 'u_grainOverlay', 0, 0.3)
    }
  })

  it('flow 的 meshGradient 参数合法，softness 与 swirl 反向', () => {
    for (const config of configs) {
      const { uniforms } = planRender({ ...config, style: 'flow' }, COLORS)
      inRange(uniforms, 'u_distortion', 0.1, 0.9)
      inRange(uniforms, 'u_swirl', 0.05, 0.8)
      inRange(uniforms, 'u_grainMixer', 0, 0.55)
      inRange(uniforms, 'u_grainOverlay', 0, 0.3)
    }
    const soft = planRender(
      {
        ...DEFAULT_CONFIG,
        style: 'flow',
        styleParams: { ...DEFAULT_CONFIG.styleParams, softness: 1 },
      },
      COLORS,
    )
    const sharp = planRender(
      {
        ...DEFAULT_CONFIG,
        style: 'flow',
        styleParams: { ...DEFAULT_CONFIG.styleParams, softness: 0 },
      },
      COLORS,
    )
    expect(num(soft.uniforms, 'u_swirl')).toBeLessThan(num(sharp.uniforms, 'u_swirl'))
  })

  it('silk 的 warp 参数合法，形状取自 WarpPatterns', () => {
    for (const config of configs) {
      const { uniforms } = planRender({ ...config, style: 'silk' }, COLORS)
      inRange(uniforms, 'u_proportion', 0.4, 0.6)
      inRange(uniforms, 'u_softness', 0.35, 1)
      // checks 0 与 stripes 1，edge 出的是平淡线性渐变，不在候选里
      expect([0, 1]).toContain(num(uniforms, 'u_shape'))
      inRange(uniforms, 'u_shapeScale', 0.12, 0.38)
      inRange(uniforms, 'u_distortion', 0.05, 0.45)
      inRange(uniforms, 'u_swirl', 0, 1)
      const iterations = num(uniforms, 'u_swirlIterations')
      expect(Number.isInteger(iterations)).toBe(true)
      expect(iterations).toBeGreaterThanOrEqual(3)
      expect(iterations).toBeLessThanOrEqual(8)
    }
  })

  it('grain 的 grainGradient 参数合法，形状取自柔和的那几种', () => {
    for (const config of configs) {
      const { uniforms } = planRender({ ...config, style: 'grain' }, COLORS)
      inRange(uniforms, 'u_softness', 0.25, 1)
      inRange(uniforms, 'u_intensity', 0.25, 1)
      inRange(uniforms, 'u_noise', 0.05, 0.6)
      // 只留 wave 1、corners 4、ripple 5
      expect([1, 4, 5]).toContain(num(uniforms, 'u_shape'))
      const back = uniforms.u_colorBack as number[]
      expect(back).toHaveLength(4)
    }
  })

  it('滑杆推到两端也不越界', () => {
    for (const style of STYLE_IDS) {
      for (const extreme of [0, 1]) {
        const config = normalizeConfig({
          ...DEFAULT_CONFIG,
          style,
          seed: `extreme-${style}-${extreme}`,
          styleParams: {
            intensity: extreme,
            softness: extreme,
            grain: extreme,
            scale: extreme === 0 ? 0.5 : 2,
            rotation: extreme === 0 ? 0 : 360,
          },
        })
        const { uniforms } = planRender(config, COLORS)
        for (const [key, value] of Object.entries(uniforms)) {
          if (typeof value !== 'number') continue
          expect(Number.isFinite(value), `${key} 非有限数`).toBe(true)
        }
      }
    }
  })

  it('只给两个色也能出参数', () => {
    const { uniforms } = planRender(DEFAULT_CONFIG, ['#ffffff', '#000000'])
    expect(num(uniforms, 'u_colorsCount')).toBe(2)
  })

  it('色板为空时退到内置兜底色而不是零色', () => {
    const { uniforms } = planRender(DEFAULT_CONFIG, [])
    expect(num(uniforms, 'u_colorsCount')).toBeGreaterThanOrEqual(2)
  })
})
