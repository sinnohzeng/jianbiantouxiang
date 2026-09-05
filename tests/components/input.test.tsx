/**
 * 输入框字号：手机单栏布局一直延续到 lg（1024 px），在此之前字号不能掉到 16 px 以下，
 * 否则 iOS Safari 聚焦时会把整页放大，sticky 预览与固定底栏跟着错位。
 *
 * jsdom 没有布局也没有 Tailwind，量不到 computed font-size，断言只能落在类名上：
 * 只要出现无前缀或 sm/md 前缀的 text-xs、text-sm，就是把字号收在了手机档。
 * 真实字号的实测归 e2e。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

  it('滑杆的数值框在手机档保持 16 px', () => {
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
    // v5 起数值框常驻，不必再点开
    expect(shrinkOnMobile(screen.getByLabelText('编辑字号').className)).toEqual([])
  })

  it('检查器带那一行的数值框同样不收缩字号', () => {
    render(
      <SliderField
        layout="row"
        label="行高"
        editLabel="编辑行高"
        value={1.03}
        min={0.85}
        max={2}
        onChange={() => {}}
      />,
    )
    expect(shrinkOnMobile(screen.getByLabelText('编辑行高').className)).toEqual([])
  })
})
