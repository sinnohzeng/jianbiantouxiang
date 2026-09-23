/**
 * “自动”与“跟随”共用的开关钮：按下态再点不做事，可访问名带行名全称。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AutoToggle } from '@/components/blocks/auto-toggle'

afterEach(() => {
  cleanup()
})

function renderToggle(active: boolean) {
  const onClick = vi.fn()
  render(
    <AutoToggle
      slot="font-follow"
      active={active}
      label="跟随"
      ariaLabel="第二行字体跟随第一行"
      hint="与第一行同一款字体与字重"
      onClick={onClick}
    />,
  )
  return { onClick, button: screen.getByRole('button', { name: '第二行字体跟随第一行' }) }
}

describe('AutoToggle', () => {
  it('松开态点一下回调，可见文字仍是短名', () => {
    const { onClick, button } = renderToggle(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-disabled')).toBeNull()
    expect(button.textContent).toBe('跟随')
    expect(button.getAttribute('title')).toBe('与第一行同一款字体与字重')
    expect(button.getAttribute('data-slot')).toBe('font-follow')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('按下态带 aria-disabled，点击不回调', () => {
    const { onClick, button } = renderToggle(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
