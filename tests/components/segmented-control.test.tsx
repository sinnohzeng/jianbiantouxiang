/**
 * 分段控件的两条硬指标：
 * 1. 窄屏放不下时截断，不许把整组撑出容器。body 是 overflow-x:hidden，撑出去就等于内容丢失。
 * 2. 未选中态文字压在 bg-muted 上要过 WCAG AA 的 4.5:1，浅色与深色两套令牌都要过。
 *
 * jsdom 没有布局也没有 Tailwind，宽度这条只能验类名与结构；
 * 对比度这条把类名里的颜色与透明度取出来，配 src/index.css 的真实令牌算一遍，是真算不是断言字符串。
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SegmentedControl } from '@/components/blocks/segmented-control'
import { contrastRatio } from '@/palettes'
import { formatHex, rgb } from '@/palettes/culori'

afterEach(() => {
  cleanup()
})

type FsModule = { readFileSync: (path: string, encoding: 'utf8') => string }

/**
 * 主题令牌只能在运行时从磁盘读：vitest 的 test.css 默认关着，
 * 任何 .css 请求（含 ?raw）都被换成空串，import 拿不到内容。
 * specifier 拼一下是因为 tsconfig.app.json 的 types 里没有 node，字面量 'node:fs' 过不了类型检查；
 * 路径按仓库根解析，vitest 的工作目录就是根。
 */
let indexCss = ''

beforeAll(async () => {
  const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as FsModule
  indexCss = fs.readFileSync('src/index.css', 'utf8')
  expect(indexCss, '没读到 src/index.css').toContain('--muted-foreground')
})

/** 装文字的那一层。选中项前面还叠着炫技层的共享描边，按 data-slot 排掉。 */
const CONTENT_SPAN = 'span:not([data-slot="selection-indicator"])'

const OPTIONS = [
  { value: 'analogous', label: 'Analogous' },
  { value: 'complementary', label: 'Complementary' },
  { value: 'mono', label: 'Monochromatic' },
] as const

function renderControl() {
  return render(
    <SegmentedControl
      name="scheme"
      label="Scheme"
      value="analogous"
      options={OPTIONS}
      onChange={() => {}}
    />,
  )
}

/** 取 src/index.css 里某个作用域下的自定义属性，scope 传 ':root' 或 '.dark'。 */
function token(scope: string, name: string): string {
  const block = new RegExp(`${scope.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(indexCss)
  expect(block, `${scope} 块没找到`).not.toBeNull()
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(block![1] ?? '')
  expect(value, `${scope} 下没有 ${name}`).not.toBeNull()
  return value![1]!.trim()
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** 把带透明度的前景色压到底色上，返回合成后的 hex。浏览器就是这样合成 text 颜色的。 */
function composite(foreground: string, background: string, alpha: number): string {
  const fg = rgb(foreground)
  const bg = rgb(background)
  expect(fg && bg, `颜色解析失败：${foreground} / ${background}`).toBeTruthy()
  const mix = (a: number, b: number): number => clamp01(a) * alpha + clamp01(b) * (1 - alpha)
  return formatHex({
    mode: 'rgb',
    r: mix(fg!.r, bg!.r),
    g: mix(fg!.g, bg!.g),
    b: mix(fg!.b, bg!.b),
  })
}

describe('SegmentedControl 窄屏', () => {
  it('每个选项都能缩到内容宽度以下', () => {
    const { container } = renderControl()
    const labels = [...container.querySelectorAll('label')]
    expect(labels).toHaveLength(OPTIONS.length)
    for (const label of labels) {
      // flex-1 的项默认 min-width:auto，没有 min-w-0 就缩不下去
      expect(label.className).toContain('flex-1')
      expect(label.className).toContain('min-w-0')
      // 选中项前面还有一枚炫技层的共享描边，按 data-slot 排掉，取真正装文字的那一层
      expect(label.querySelector(CONTENT_SPAN)!.className).toContain('min-w-0')
    }
  })

  it('文字截断并把完整文案挂在 title 上', () => {
    const { container } = renderControl()
    const texts = [...container.querySelectorAll('label span[title]')]
    expect(texts.map((node) => node.getAttribute('title'))).toEqual(
      OPTIONS.map((option) => option.label),
    )
    for (const text of texts) expect(text.className).toContain('truncate')
  })

  it('给了图标就只渲染图标，不再套截断层', () => {
    const { container } = render(
      <SegmentedControl
        name="align"
        label="Align"
        value="left"
        options={[{ value: 'left', label: '左对齐', icon: <svg data-testid="icon" /> }]}
        onChange={() => {}}
      />,
    )
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull()
    expect(container.querySelector('label span[title]')).toBeNull()
    // 图标项的可访问名走 input 上的 aria-label
    expect(container.querySelector('input')!.getAttribute('aria-label')).toBe('左对齐')
  })
})

describe('SegmentedControl 对比度', () => {
  it('未选中态文字压在凹槽底上，浅色与深色都过 AA', () => {
    const { container } = renderControl()
    const group = container.querySelector('[role="radiogroup"]')!
    // 凹槽底是 --muted，文字的底色就是它
    expect(group.className).toContain('bg-muted')

    const styled = container.querySelector(`label > ${CONTENT_SPAN}`)!
    const matched = /(?:^|\s)text-([a-z-]+)\/(\d+)(?:\s|$)/.exec(styled.className)
    expect(matched, `未选中态没取到带透明度的文字色：${styled.className}`).not.toBeNull()

    const alpha = Number(matched![2]) / 100
    const colorToken = `--${matched![1]}`
    for (const scope of [':root', '.dark']) {
      const text = composite(token(scope, colorToken), token(scope, '--muted'), alpha)
      const ratio = contrastRatio(text, token(scope, '--muted'))
      expect(
        ratio,
        `${scope} 下 ${text} 压在 --muted 上只有 ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
