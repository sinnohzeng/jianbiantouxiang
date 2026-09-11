/**
 * 颜色格的两种形态。inline 是文字色那一行：行内标签、预设、取色器，没有 hex 框；
 * 默认形态是自定义配色与种子色那两处，hex 框仍在。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ColorField } from '@/components/blocks/color-field'

afterEach(() => {
  cleanup()
})

const PRESETS = [
  { hex: '#FFFFFF', label: '纯白' },
  { hex: '#000000', label: '纯黑' },
]

describe('ColorField', () => {
  it('inline 形态是一行：行内标签、预设、取色器，没有 hex 框', () => {
    const { container } = render(
      <ColorField
        inline
        rowLabel="文字颜色"
        label="文字颜色"
        value="#ffffff"
        presets={PRESETS}
        onChange={() => {}}
      />,
    )

    expect(container.querySelector('input[type="color"]')).not.toBeNull()
    expect(container.querySelectorAll('button[role="radio"]')).toHaveLength(2)
    // hex 框是 text input，inline 形态下一个都不该有
    expect(container.querySelectorAll('input[type="text"], input:not([type])')).toHaveLength(0)
    expect(container.textContent).toContain('文字颜色')
  })

  it('inline 形态点预设照样写回', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ColorField
        inline
        rowLabel="文字颜色"
        label="文字颜色"
        value="#ffffff"
        presets={PRESETS}
        onChange={onChange}
      />,
    )
    fireEvent.click(container.querySelectorAll('button[role="radio"]')[1]!)
    expect(onChange).toHaveBeenCalledWith('#000000')
  })

  it('默认形态仍是两行，hex 框在', () => {
    const { container } = render(
      <ColorField label="主色" hexLabel="十六进制色值" value="#5fb4f5" onChange={() => {}} />,
    )
    expect(container.querySelector('input[type="color"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="十六进制色值"]')).not.toBeNull()
  })
})
