import { describe, expect, it } from 'vitest'
import { automaticLayoutPatch } from '@/app/workspace/shared'
import { normalizeConfig } from '@/state/config'

describe('恢复自动排版', () => {
  it('只恢复字号、图文位置和对应品牌比例，保留客户内容与字体', () => {
    const config = normalizeConfig({
      text: '大讲堂内部\n东黎羊绒',
      palette: 'steel-slate',
      typography: {
        line1: { size: 0.2, offsetY: 0.04 },
        line2: { size: 0.12, offsetX: -0.02, font: null },
      },
      layout: {
        icon: { source: 'brand', id: 'dongli-symbol-white', mono: false },
        graphic: 0.7,
        graphicOffsetY: 0.1,
      },
    })
    const patch = automaticLayoutPatch(config)
    expect(patch).toEqual({
      typography: {
        line1: { size: null, offsetX: 0, offsetY: 0 },
        line2: { size: null, offsetX: 0, offsetY: 0 },
      },
      layout: { graphic: 0.49, graphicOffsetX: 0, graphicOffsetY: 0 },
    })
    expect(patch.typography?.line1?.font).toBeUndefined()
    expect(patch.typography?.line2?.font).toBeUndefined()
    expect(patch.text).toBeUndefined()
    expect(patch.layout?.icon).toBeUndefined()
  })
})
