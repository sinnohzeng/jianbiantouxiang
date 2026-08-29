/**
 * 输入框字号：手机单栏布局一直延续到 lg（1024 px），在此之前字号不能掉到 16 px 以下，
 * 否则 iOS Safari 聚焦时会把整页放大，sticky 预览与固定底栏跟着错位。
 *
 * jsdom 没有布局也没有 Tailwind，量不到 computed font-size，断言只能落在类名上：
 * 只要出现无前缀或 sm/md 前缀的 text-xs、text-sm，就是把字号收在了手机档。
 * 真实字号的实测归 e2e。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ColorField } from '@/components/blocks/color-field'
import { SliderField } from '@/components/blocks/slider-field'
import { Input } from '@/components/ui/input'
import { shrinkOnMobile } from './helpers'

afterEach(() => {
  cleanup()
})

describe('Input 字号', () => {
  it('基类在 lg 之前不收缩字号', () => {
    render(<Input aria-label="裸输入框" />)
    const input = screen.getByLabelText('裸输入框')
    expect(shrinkOnMobile(input.className)).toEqual([])
    // 收缩点必须跟布局断点对齐
    expect(input.className).toContain('lg:text-sm')
  })

  it('hex 色值框在手机档保持 16 px', () => {
    render(<ColorField label="种子色" hexLabel="色值" value="#ff8844" onChange={() => {}} />)
    expect(shrinkOnMobile(screen.getByLabelText('色值').className)).toEqual([])
  })

  it('滑杆的数值编辑框在手机档保持 16 px', () => {
    render(
      <SliderField
        label="字号"
        editLabel="编辑字号"
        value={0.5}
        min={0}
        max={1}
        onChange={() => {}}
      />,
    )
    // 数值先是按钮，点开才换成输入框
    fireEvent.click(screen.getByRole('button', { name: '编辑字号' }))
    expect(shrinkOnMobile(screen.getByLabelText('编辑字号').className)).toEqual([])
  })
})
