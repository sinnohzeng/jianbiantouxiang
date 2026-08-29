/**
 * CommandDialog 的两条：
 * 1. 标题与描述要挂在 Popup 内部。挂在 Dialog.Root 下会被无条件渲染，
 *    对话框关掉之后那两个 sr-only 节点还留在面板里，屏幕阅读器按标题导航会读到多余的一级层次。
 * 2. 弹层是 fixed，页面滚不回来，所以“顶边偏移加高度上限”必须始终落在视口内。
 *
 * 第二条 jsdom 量不到，改成把类名里的偏移与上限解析成关于视口高度的表达式，
 * 在几档真实机型高度上算一遍。Tailwind 类改错了这里就会红。
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { Command, CommandDialog, CommandItem, CommandList } from '@/components/ui/command'

beforeAll(() => {
  // Base UI 的弹层要这几个浏览器 API，jsdom 里没有
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
  if (!('matchMedia' in window)) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }),
    })
  }
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.scrollIntoView ??= () => {}
})

// 弹层挂在 document.body 上，不清干净会串到下一条用例
afterEach(() => {
  cleanup()
})

function dialog(open: boolean) {
  return (
    <CommandDialog open={open} onOpenChange={() => {}} title="选字体" description="搜索字体名称">
      <Command shouldFilter={false} className="min-h-0">
        <CommandList className="max-h-[60vh]">
          <CommandItem value="a">思源黑体</CommandItem>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

/** 手机与桌面的几档视口高度，含 iPhone 横屏与最矮的一档竖屏。 */
const HEIGHTS = [430, 568, 659, 667, 844, 900, 1024]

/** 把 1rem 折成 px，与页面默认根字号一致。 */
const REM = 16

/** 解析 top-* 与 max-h-* 的值，返回“给定视口高度算出多少 px”的函数。 */
function toPx(value: string): (height: number) => number {
  const calc = /^calc\((.+)\)$/.exec(value)
  if (calc) {
    const parts = (calc[1] ?? '').split(/\s+([+-])\s+/)
    return (height) => {
      let total = toPx(parts[0] ?? '0')(height)
      for (let i = 1; i < parts.length; i += 2) {
        const term = toPx(parts[i + 1] ?? '0')(height)
        total += parts[i] === '-' ? -term : term
      }
      return total
    }
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(value)
  if (fraction) return (height) => (height * Number(fraction[1])) / Number(fraction[2])
  const viewport = /^([\d.]+)(dvh|vh|svh|lvh)$/.exec(value)
  if (viewport) return (height) => (height * Number(viewport[1])) / 100
  const rem = /^([\d.]+)rem$/.exec(value)
  if (rem) return () => Number(rem[1]) * REM
  const px = /^([\d.]+)px$/.exec(value)
  if (px) return () => Number(px[1])
  // 剩下的是 spacing 刻度，Tailwind 默认 1 = 0.25rem
  const spacing = /^[\d.]+$/.exec(value)
  if (spacing) return () => Number(value) * 0.25 * REM
  throw new Error(`解析不了的长度：${value}`)
}

/** 取某个前缀下的工具类值，prefix 传 '' 表示无变体前缀。 */
function utility(className: string, prefix: string, name: string): string | null {
  for (const token of className.split(/\s+/)) {
    const cut = token.lastIndexOf(':')
    const variant = cut === -1 ? '' : token.slice(0, cut)
    const base = cut === -1 ? token : token.slice(cut + 1)
    if (variant !== prefix || !base.startsWith(`${name}-`)) continue
    const raw = base.slice(name.length + 1)
    const arbitrary = /^\[(.+)\]$/.exec(raw)
    return (arbitrary ? (arbitrary[1] ?? '') : raw).replaceAll('_', ' ')
  }
  return null
}

describe('CommandDialog 无障碍', () => {
  it('标题与描述渲染在 Popup 内部', () => {
    render(dialog(true))
    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content).not.toBeNull()
    const title = document.querySelector('[data-slot="dialog-title"]')
    const description = document.querySelector('[data-slot="dialog-description"]')
    expect(title?.textContent).toBe('选字体')
    expect(description?.textContent).toBe('搜索字体名称')
    expect(content!.contains(title!)).toBe(true)
    expect(content!.contains(description!)).toBe(true)
  })

  it('关掉之后页面里不再留标题节点', async () => {
    const { rerender } = render(dialog(true))
    expect(document.querySelectorAll('[data-slot="dialog-title"]')).toHaveLength(1)

    rerender(dialog(false))
    await waitFor(() => {
      expect(document.querySelectorAll('[data-slot="dialog-content"]')).toHaveLength(0)
    })
    expect(document.querySelectorAll('[data-slot="dialog-title"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-slot="dialog-description"]')).toHaveLength(0)
  })
})

describe('CommandDialog 高度', () => {
  it('顶边偏移加高度上限在各档视口里都不越界', () => {
    render(dialog(true))
    const className = document.querySelector('[data-slot="dialog-content"]')!.className
    // 弹层要能随内容收缩，否则调用方给列表的 max-h 会把底边顶出去
    expect(className).toContain('flex-col')

    const short = '[@media(max-height:640px)]'
    for (const height of HEIGHTS) {
      const prefix = height <= 640 ? short : ''
      const top = utility(className, prefix, 'top') ?? utility(className, '', 'top')
      const cap = utility(className, prefix, 'max-h') ?? utility(className, '', 'max-h')
      expect(top, `${height} px 高时没有 top`).not.toBeNull()
      expect(cap, `${height} px 高时没有高度上限`).not.toBeNull()

      const bottom = toPx(top!)(height) + toPx(cap!)(height)
      expect(bottom, `视口 ${height} px 时底边落在 ${bottom.toFixed(0)} px`).toBeLessThanOrEqual(
        height,
      )
    }
  })
})
