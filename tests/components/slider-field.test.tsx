/**
 * 滑杆行的两件事：常驻数字框与重置钮。
 *
 * 数字框敲进来的值要与拖滑杆得到的取值集合一致（按 step 对齐、夹在区间里），
 * 敲进来的不是数就当没改过；重置钮只在偏离默认值时出现，点一下回默认。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SliderField } from '@/components/blocks/slider-field'

afterEach(() => {
  cleanup()
})

function renderField(props: Partial<Parameters<typeof SliderField>[0]> = {}) {
  const onChange = vi.fn()
  const view = render(
    <SliderField
      label="边距"
      editLabel="编辑边距"
      value={0.15}
      min={0}
      max={0.3}
      step={0.005}
      scale={100}
      onChange={onChange}
      {...props}
    />,
  )
  return { onChange, ...view }
}

describe('数字框', () => {
  it('常驻显示，带单位后缀', () => {
    renderField({ unit: '%' })
    expect(screen.getByLabelText('编辑边距')).toHaveProperty('value', '15%')
  })

  it('回车提交，按 step 对齐', () => {
    const { onChange } = renderField()
    const input = screen.getByLabelText('编辑边距')
    // 12.3% 落在 1.2% 的步进网格外，最近的一格是 12.5%
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '12.3' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]).toBeCloseTo(0.125, 6)
  })

  it('失焦提交，超出区间夹回上限', () => {
    const { onChange } = renderField()
    const input = screen.getByLabelText('编辑边距')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.blur(input)
    expect(onChange.mock.calls[0]?.[0]).toBeCloseTo(0.3, 6)
  })

  it('负数夹回下限', () => {
    const { onChange } = renderField()
    const input = screen.getByLabelText('编辑边距')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '-40' } })
    fireEvent.blur(input)
    expect(onChange.mock.calls[0]?.[0]).toBeCloseTo(0, 6)
  })

  it('非法输入不写回，框里还原成当前值', () => {
    const { onChange } = renderField({ unit: '%' })
    const input = screen.getByLabelText('编辑边距')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '好大好大' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('编辑边距')).toHaveProperty('value', '15%')
  })

  it('Esc 放弃这次编辑', () => {
    const { onChange } = renderField({ unit: '%' })
    const input = screen.getByLabelText('编辑边距')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '25' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('编辑边距')).toHaveProperty('value', '15%')
  })
})

describe('重置钮', () => {
  it('值等于默认值时不出现', () => {
    renderField({ defaultValue: 0.15, resetLabel: '把边距重置为默认' })
    expect(document.querySelector('[data-slot="slider-reset"]')).toBeNull()
  })

  it('偏离默认值就出现，点一下回默认', () => {
    const { onChange } = renderField({
      value: 0.2,
      defaultValue: 0.15,
      resetLabel: '把边距重置为默认',
    })
    const reset = screen.getByRole('button', { name: '把边距重置为默认' })
    fireEvent.click(reset)
    expect(onChange).toHaveBeenCalledWith(0.15)
  })

  it('没给默认值就没有这颗钮', () => {
    renderField({ value: 0.2 })
    expect(document.querySelector('[data-slot="slider-reset"]')).toBeNull()
  })
})

describe('对齐', () => {
  it('重置占位与数值框各占定宽列，自动档住在标签格不挤它们', () => {
    const { container } = renderField({
      defaultValue: 0.2,
      resetLabel: '把边距重置为默认',
      auto: { active: true, label: '自动', onReset: () => {} },
    })
    const row = container.querySelector('.grid')
    expect(row?.className).toContain('lg:grid-cols-[minmax(0,1fr)_1.25rem_3.5rem]')
    const labelCell = container.querySelector('[data-slot="slider-auto"]')?.parentElement
    expect(labelCell?.children).toHaveLength(2)
    expect(labelCell?.contains(container.querySelector('[data-slot="slider-number"]'))).toBe(false)
  })

  it('数值框是第一行最右一格，重置占位排在它左边', () => {
    const { container } = renderField({ defaultValue: 0.2, resetLabel: '把边距重置为默认' })
    const row = container.querySelector('.grid')!
    const number = container.querySelector('[data-slot="slider-number"]')!
    expect(row.lastElementChild).toBe(number)
    expect(number.previousElementSibling?.getAttribute('data-slot')).toBe('slider-reset-slot')
  })

  it('没给默认值的行也留着占位格，数值框不会滑进窄列', () => {
    const { container } = renderField()
    const number = container.querySelector('[data-slot="slider-number"]')!
    expect(number.previousElementSibling?.getAttribute('data-slot')).toBe('slider-reset-slot')
    expect(container.querySelector('[data-slot="slider-reset"]')).toBeNull()
  })
})

describe('自动档', () => {
  it('手动态点一下回到自动，可访问名用带行名的全称', () => {
    const onReset = vi.fn()
    renderField({
      auto: { active: false, label: '跟随', ariaLabel: '第二行字号跟随第一行', onReset },
    })
    const button = screen.getByRole('button', { name: '第二行字号跟随第一行' })
    expect(button.getAttribute('data-slot')).toBe('slider-auto')
    fireEvent.click(button)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('自动态再点不回调', () => {
    const onReset = vi.fn()
    renderField({ auto: { active: true, label: '自动', onReset } })
    fireEvent.click(screen.getByRole('button', { name: '自动' }))
    expect(onReset).not.toHaveBeenCalled()
  })
})
