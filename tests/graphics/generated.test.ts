import { describe, expect, it } from 'vitest'
import { EMOJI_BASE } from '@/graphics/generated/emoji-base'
import { EMOJI_LABELS } from '@/graphics/generated/emoji-labels.zh-CN'
import { LUCIDE_CURATED } from '@/graphics/generated/lucide-curated'
import { LUCIDE_ICONS } from '@/graphics/generated/lucide-full'

describe('生成索引', () => {
  it('lucide 收 1790 个主图标，别名不重复进索引', () => {
    expect(Object.keys(LUCIDE_ICONS)).toHaveLength(1790)
    expect(LUCIDE_ICONS['tree-palm']).toBeDefined()
    expect(LUCIDE_ICONS['palmtree']).toBeUndefined()
  })

  it('精选索引有棕榈树与 162 个图标', () => {
    expect(Object.keys(LUCIDE_CURATED)).toHaveLength(162)
    expect(LUCIDE_CURATED['tree-palm']).toBeDefined()
  })

  it('emoji 收 1879 个可分组条目，棕榈树可按 id 命中', () => {
    expect(EMOJI_BASE).toHaveLength(1879)
    const palm = EMOJI_BASE.find(([id]) => id === '1f334')
    expect(palm).toEqual(['1f334', '🌴', 3, 3334])
  })

  it('五语标签与基础索引逐条对齐，中文能搜棕榈树', () => {
    expect(EMOJI_LABELS).toHaveLength(EMOJI_BASE.length)
    const index = EMOJI_BASE.findIndex(([id]) => id === '1f334')
    expect(EMOJI_LABELS[index]?.[0]).toBe('棕榈树')
    expect(EMOJI_LABELS[index]?.[1]).toContain('棕榈树')
  })
})
