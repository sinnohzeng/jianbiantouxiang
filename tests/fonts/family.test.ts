import { describe, expect, it } from 'vitest'
import { SYSTEM_FALLBACK, fontFamilyStack, fontString, quoteFamily } from '@/fonts/family'
import { cssPx } from '@/lib/canvas'

describe('quoteFamily', () => {
  it.each([
    ['Inter', '"Inter"'],
    ['Noto Sans SC', '"Noto Sans SC"'],
    ['Sample-upload', '"Sample-upload"'],
    ['  站酷快乐体  ', '"站酷快乐体"'],
    ['Bad"Name\\', '"BadName"'],
    ['', ''],
    ['   ', ''],
  ])('%j -> %j', (input, output) => {
    expect(quoteFamily(input)).toBe(output)
  })
})

describe('fontFamilyStack', () => {
  it('目标字体在前，系统字体链兜底', () => {
    expect(fontFamilyStack('思源黑体')).toBe(`"思源黑体", ${SYSTEM_FALLBACK}`)
    expect(fontFamilyStack('思源黑体')).toContain('sans-serif')
  })

  it('空家族名只留系统字体链', () => {
    expect(fontFamilyStack('  ')).toBe(SYSTEM_FALLBACK)
    expect(fontFamilyStack('  ')).not.toContain('""')
  })
})

describe('fontString', () => {
  it('字重、字号与家族链', () => {
    const font = fontString({ family: 'Noto Sans SC', weight: 700 }, 42)
    expect(font).toBe(`700 42px "Noto Sans SC", ${SYSTEM_FALLBACK}`)
  })

  it('极小字号不写成科学计数法', () => {
    expect(fontString({ family: 'Inter', weight: 400 }, 0.0000001).startsWith('400 0px ')).toBe(
      true,
    )
    expect(cssPx(Number.NaN)).toBe('0px')
    expect(cssPx(12.3456)).toBe('12.346px')
  })
})
