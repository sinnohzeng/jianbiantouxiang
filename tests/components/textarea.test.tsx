/**
 * 多行输入框的字号：与 Input 同一条约束，手机单栏一直到 lg（1024 px），
 * 这之前不能收到 16 px 以下，否则 iOS 聚焦会放大整页。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Textarea } from '@/components/ui/textarea'
import { shrinkOnMobile } from './helpers'

afterEach(() => {
  cleanup()
})

describe('Textarea 字号', () => {
  it('基类在 lg 之前不收缩字号', () => {
    render(<Textarea aria-label="文字内容" />)
    const textarea = screen.getByLabelText('文字内容')
    expect(shrinkOnMobile(textarea.className)).toEqual([])
    expect(textarea.className).toContain('lg:text-sm')
  })

  it('调用点不用再补 md:text-base 也不会掉字号', () => {
    // 面板里原先靠 text-base md:text-base 兜这条，基类改对之后这行可以不写
    render(<Textarea aria-label="裸多行框" className="min-h-24" />)
    expect(shrinkOnMobile(screen.getByLabelText('裸多行框').className)).toEqual([])
  })
})
