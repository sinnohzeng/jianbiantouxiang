import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  INK_DARK,
  INK_LIGHT,
  contrastRatio,
  isLightColor,
  resolveInk,
  relativeLuminance,
} from '@/text/auto-color'
import type { AvatarConfig } from '@/state/config'
import { layoutText, type TextLayout } from '@/text/layout'
import {
  createPixelContext,
  createSolidContext,
  createStubMeasure,
  installSampleCanvas,
  makeConfig,
  type SampleRecorder,
} from './helpers'

const measure = createStubMeasure()
const config = makeConfig({
  text: '猪猪',
  typography: { sizeMode: 'manual', fontSize: 0.2, padding: 0.1, anchor: 'c' },
})
const layout = layoutText(config, 1000, 1000, measure)

/** 自动取色新建的采样画布在 jsdom 里拿不到 2D 上下文，全部用例都换成假画布。 */
let sampler: SampleRecorder

beforeEach(() => {
  sampler = installSampleCanvas()
})

afterEach(() => {
  sampler.restore()
})

/** 两个断言口径各取结论的一半，用例读起来仍是「这张画面该用什么色 / 要不要底板」。 */
function inkColor(ctx: CanvasRenderingContext2D, l: TextLayout, c: AvatarConfig): string {
  return resolveInk(ctx, l, c).color
}

function inkPlate(ctx: CanvasRenderingContext2D, l: TextLayout, c: AvatarConfig): boolean {
  return resolveInk(ctx, l, c).plate
}

describe('色彩计算', () => {
  it('相对亮度覆盖黑白两端', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1)
    expect(relativeLuminance('#000000')).toBeCloseTo(0)
  })

  it('对比度上限 21', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1)
  })

  it('三位 hex 与省略井号都能解析', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1)
    expect(relativeLuminance('ffffff')).toBeCloseTo(1)
  })

  it('明暗判定用白黑等对比度的分界点', () => {
    expect(isLightColor('#FFFFFF')).toBe(true)
    expect(isLightColor('#141413')).toBe(false)
  })
})

describe('pickTextColor', () => {
  it('内置浅配色一律用配色表里的深字，底再暗也不翻面', () => {
    expect(inkColor(createSolidContext(16, 16, 16), layout, config)).toBe(INK_DARK)
    expect(inkColor(createSolidContext(240, 240, 240), layout, config)).toBe(INK_DARK)
  })

  it('内置深配色一律用白字', () => {
    const dark = makeConfig({ ...config, palette: 'aurora-violet' })
    expect(inkColor(createSolidContext(16, 16, 16), layout, dark)).toBe(INK_LIGHT)
    expect(inkColor(createSolidContext(200, 200, 200), layout, dark)).toBe(INK_LIGHT)
  })

  it('同一配色下亮度差很多的两块文字取到同一个颜色', () => {
    const bright = inkColor(createSolidContext(250, 250, 250), layout, config)
    const dim = inkColor(createSolidContext(30, 30, 30), layout, config)
    expect(bright).toBe(dim)
  })

  it('custom 配色按区域相对亮度取白字或深字', () => {
    const custom = makeConfig({
      ...config,
      palette: 'custom',
      customColors: ['#112233', '#445566'],
    })
    expect(inkColor(createSolidContext(160, 160, 160), layout, custom)).toBe(INK_LIGHT)
    expect(inkColor(createSolidContext(220, 220, 220), layout, custom)).toBe(INK_DARK)
  })

  it('自定义模式直接返回用户选的颜色', () => {
    const custom = makeConfig({
      ...config,
      typography: { ...config.typography, colorMode: 'custom', color: '#ff0066' },
    })
    expect(inkColor(createSolidContext(16, 16, 16), layout, custom)).toBe('#ff0066')
  })

  it('半透明像素按导出底色合成', () => {
    const onWhite = makeConfig({
      ...config,
      palette: 'custom',
      customColors: ['#112233', '#445566'],
      exportOptions: { bgColor: '#ffffff' },
    })
    expect(inkColor(createSolidContext(0, 0, 0, 0), layout, onWhite)).toBe(INK_DARK)
  })

  it('画布读不出像素时不抛错', () => {
    sampler.restore()
    sampler = installSampleCanvas({ failRead: true })
    expect([INK_LIGHT, INK_DARK]).toContain(
      inkColor(createSolidContext(16, 16, 16), layout, config),
    )
  })

  it('拿不到采样上下文时退回中性灰而不是抛错', () => {
    sampler.restore()
    sampler = installSampleCanvas({ failContext: true })
    const custom = makeConfig({
      ...config,
      palette: 'custom',
      customColors: ['#112233', '#445566'],
    })
    expect([INK_LIGHT, INK_DARK]).toContain(inkColor(createSolidContext(0, 0, 0), layout, custom))
  })
})

describe('采样回读', () => {
  it('一次取色只缩一张 64×64 的画布并回读一次', () => {
    inkColor(createSolidContext(120, 120, 120), layout, config)
    expect(sampler.records).toHaveLength(1)
    const record = sampler.records[0]!
    expect(record.reads).toBe(1)
    expect(record.width).toBe(64)
    expect(record.height).toBe(64)
    expect(record.options?.willReadFrequently).toBe(true)
    expect(record.smoothingQuality).toBe('high')
  })

  it('缩进采样画布的就是文字包围盒那一块', () => {
    inkColor(createSolidContext(120, 120, 120), layout, config)
    const draw = sampler.records[0]!.draws[0]!
    const box = layout.box
    expect(draw.sx).toBe(Math.floor(box.x))
    expect(draw.sy).toBe(Math.floor(box.y))
    // 上下左右各允许一个像素的取整外扩
    expect(draw.sw).toBeGreaterThanOrEqual(box.width)
    expect(draw.sw).toBeLessThanOrEqual(box.width + 2)
    expect(draw.sh).toBeGreaterThanOrEqual(box.height)
    expect(draw.sh).toBeLessThanOrEqual(box.height + 2)
    expect(draw.dw).toBe(64)
    expect(draw.dh).toBe(64)
  })

  it('包围盒比采样画布还小时按原尺寸读，不放大', () => {
    const small = layoutText(config, 40, 40, measure)
    inkColor(
      createPixelContext(() => [120, 120, 120, 255], 40),
      small,
      config,
    )
    const record = sampler.records[0]!
    const draw = record.draws[0]!
    expect(draw.dw).toBe(Math.min(draw.sw, 64))
    expect(draw.dh).toBe(Math.min(draw.sh, 64))
    expect(record.width).toBe(draw.dw)
    expect(record.height).toBe(draw.dh)
  })

  it('区域内明暗不均时按整块平均判定，不看某一个采样点', () => {
    const custom = makeConfig({
      ...config,
      palette: 'custom',
      customColors: ['#112233', '#445566'],
    })
    const split = layout.box.x + layout.box.width * 0.75
    const mostlyLight = createPixelContext((x) =>
      x < split ? [255, 255, 255, 255] : [0, 0, 0, 255],
    )
    const mostlyDark = createPixelContext((x) =>
      x < split ? [0, 0, 0, 255] : [255, 255, 255, 255],
    )
    expect(inkColor(mostlyLight, layout, custom)).toBe(INK_DARK)
    expect(inkColor(mostlyDark, layout, custom)).toBe(INK_LIGHT)
  })
})

describe('needsPlate', () => {
  it('浅配色的深字压在深底上时建议底板', () => {
    expect(inkPlate(createSolidContext(255, 255, 255), layout, config)).toBe(false)
    expect(inkPlate(createSolidContext(0, 0, 0), layout, config)).toBe(true)
  })

  it('深配色的白字压在亮底上时建议底板', () => {
    const dark = makeConfig({ ...config, palette: 'aurora-violet' })
    expect(inkPlate(createSolidContext(0, 0, 0), layout, dark)).toBe(false)
    expect(inkPlate(createSolidContext(230, 230, 230), layout, dark)).toBe(true)
  })

  it('对比度刚好过 3 就不建议底板', () => {
    expect(inkPlate(createSolidContext(122, 122, 122), layout, config)).toBe(false)
  })

  it('自定义颜色由用户负责，不给建议', () => {
    const custom = makeConfig({
      ...config,
      typography: { ...config.typography, colorMode: 'custom' },
    })
    expect(inkPlate(createSolidContext(122, 122, 122), layout, custom)).toBe(false)
  })
})
