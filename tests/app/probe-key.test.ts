/**
 * 取色探针的依赖投影：只有真正影响取色的字段才该让探针重跑一遍。
 * 探针要起一次离屏 WebGL 加上百次 getImageData，改导出格式不该付这个钱。
 */

import { describe, expect, it } from 'vitest'
import { probeKey } from '@/app/probe-key'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'

const base: AvatarConfig = DEFAULT_CONFIG

describe('probeKey', () => {
  it('导出格式、体积档、形状与圆角都不进 key', () => {
    const before = probeKey(base)
    expect(probeKey({ ...base, exportOptions: { ...base.exportOptions, format: 'png' } })).toBe(
      before,
    )
    expect(
      probeKey({ ...base, exportOptions: { ...base.exportOptions, sizeTarget: 'none' } }),
    ).toBe(before)
    expect(probeKey({ ...base, canvas: { ...base.canvas, shape: 'circle' } })).toBe(before)
    expect(probeKey({ ...base, canvas: { ...base.canvas, radius: 0.42 } })).toBe(before)
  })

  it('取色真正依赖的字段变了，key 就变', () => {
    const before = probeKey(base)
    expect(probeKey({ ...base, seed: 'abc' })).not.toBe(before)
    expect(probeKey({ ...base, text: '猪猪老公' })).not.toBe(before)
    expect(probeKey({ ...base, palette: 'coral-dawn' })).not.toBe(before)
    expect(probeKey({ ...base, highlight: 0.9 })).not.toBe(before)
    expect(probeKey({ ...base, canvas: { ...base.canvas, width: 2048 } })).not.toBe(before)
    expect(
      probeKey({ ...base, exportOptions: { ...base.exportOptions, bgColor: '#000000' } }),
    ).not.toBe(before)
    expect(probeKey({ ...base, typography: { ...base.typography, padding: 0.15 } })).not.toBe(
      before,
    )
  })

  it('同一份配置换个对象引用，key 不变', () => {
    expect(probeKey({ ...base, canvas: { ...base.canvas } })).toBe(probeKey(base))
  })
})
