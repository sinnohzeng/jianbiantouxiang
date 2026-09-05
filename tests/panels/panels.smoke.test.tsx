/**
 * 控制面板冒烟：每个面板都能渲染出关键控件，且动一下就写回 store。
 * 断言走 role 与 name/value 选择器，不依赖具体文案，换语言或改措辞都不会红。
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nProvider } from '@/i18n'
import {
  CanvasPanel,
  ExportDrawer,
  FontPicker,
  HistoryStrip,
  PalettePanel,
  StylePanel,
  TextPanel,
} from '@/app/panels'
import { DEFAULT_CONFIG, type AvatarConfig } from '@/state/config'
import { DEFAULT_UI, useAvatarStore } from '@/state/store'

beforeAll(() => {
  // Base UI 的弹层组件要这几个浏览器 API，jsdom 里没有
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

function mount(node: ReactElement) {
  return render(<I18nProvider>{node}</I18nProvider>)
}

function config(): AvatarConfig {
  return useAvatarStore.getState().config
}

beforeEach(() => {
  useAvatarStore.setState({ config: DEFAULT_CONFIG, history: [], ui: { ...DEFAULT_UI } })
})

afterEach(() => {
  cleanup()
})

function firstLine(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#avatar-text-first')!
}

function secondLine(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#avatar-text-second')!
}

describe('TextPanel', () => {
  it('两个单行输入框，两行用换行连起来写回', () => {
    const { container } = mount(<TextPanel />)
    expect(container.querySelector('textarea')).toBeNull()

    fireEvent.change(firstLine(container), { target: { value: '请假中' } })
    fireEvent.change(secondLine(container), { target: { value: '09-01 至 09-07' } })
    expect(config().text).toBe('请假中\n09-01 至 09-07')
  })

  it('第二行清空后不留尾随换行', () => {
    const { container } = mount(<TextPanel />)
    fireEvent.change(firstLine(container), { target: { value: '请假中' } })
    fireEvent.change(secondLine(container), { target: { value: '09-01' } })
    fireEvent.change(secondLine(container), { target: { value: '' } })
    expect(config().text).toBe('请假中')
  })

  it('单行输入里粘贴的多行内容并成一行', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, text: '' } })
    const { container } = mount(<TextPanel />)
    fireEvent.change(firstLine(container), { target: { value: '第一行\n第二行\r\n第三行' } })
    expect(config().text).toBe('第一行第二行第三行')
  })

  it('用途分段控件退役，DOM 里不再出现', () => {
    const { container } = mount(<TextPanel />)
    expect(container.querySelector('input[data-group="text-kind"]')).toBeNull()
    expect(container.querySelector('input[data-group="text-align"]')).toBeNull()
    expect(container.querySelectorAll('input[data-group="text-anchor"]')).toHaveLength(0)
    expect(container.querySelector('#text-vertical')).toBeNull()
    expect(container.querySelector('#text-auto-wrap')).toBeNull()
  })

  it('两行都有内容时：次行字号加两条水平补偿共三个行级滑杆', () => {
    const { container } = mount(<TextPanel />)
    fireEvent.change(firstLine(container), { target: { value: '飞书' } })
    fireEvent.change(secondLine(container), { target: { value: '效率先锋' } })

    // 滑杆总数 = 字号一个 + 行级三个 + 排版组三个 + 效果组强度一个起步，数下限不认文案
    const ranges = container.querySelectorAll('input[type="range"]')
    expect(ranges.length).toBeGreaterThanOrEqual(7)

    // 排版组第一条是字号，之后三个行级滑杆依次是：次行字号、第一行补偿、第二行补偿
    fireEvent.change(ranges[1]!, { target: { value: '0.7' } })
    fireEvent.change(ranges[2]!, { target: { value: '0.02' } })
    fireEvent.change(ranges[3]!, { target: { value: '-0.03' } })
    expect(config().typography.lineSizeScales[1]).toBeCloseTo(0.7)
    expect(config().typography.lineOffsetsX).toEqual([0.02, -0.03])
  })

  it('只有一行时：没有次行字号，只有一条第一行补偿', () => {
    const { container } = mount(<TextPanel />)
    fireEvent.change(firstLine(container), { target: { value: '暴富' } })
    fireEvent.change(secondLine(container), { target: { value: '' } })

    const before = config().typography.lineOffsetsX
    const ranges = container.querySelectorAll<HTMLInputElement>('input[type="range"]')
    // 字号之后的第一个行级滑杆就是第一行补偿
    fireEvent.change(ranges[1]!, { target: { value: '0.05' } })
    expect(config().typography.lineOffsetsX).toEqual([0.05, before[1] ?? 0])
  })

  it('字号：默认自动态，拖滑杆以自动值为起点切到手动，点「自动」回去', () => {
    useAvatarStore.setState({ ui: { ...useAvatarStore.getState().ui, autoFontSize: 0.31 } })
    const { container } = mount(<TextPanel />)
    expect(config().typography.sizeMode).toBe('auto')

    const autoButton = container.querySelector<HTMLButtonElement>('[data-slot="slider-auto"]')
    expect(autoButton?.getAttribute('aria-pressed')).toBe('true')

    // 自动态滑杆显示的是预览回写的自动值，不是配置里陈旧的手动值 0.42
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')
    expect(Number(slider!.value)).toBeCloseTo(0.31)

    fireEvent.change(slider!, { target: { value: '0.33' } })
    expect(config().typography.sizeMode).toBe('manual')
    expect(config().typography.fontSize).toBeCloseTo(0.33)
    expect(autoButton?.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(autoButton!)
    expect(config().typography.sizeMode).toBe('auto')
  })

  it('图标开关：选了图形才算开，清除按钮一键回纯文字', () => {
    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        layout: { ...DEFAULT_CONFIG.layout, icon: { source: 'emoji', id: '1f334' } },
      },
    })
    const { container } = mount(<TextPanel />)

    const toggle = container.querySelector<HTMLInputElement>('#text-icon')
    expect(toggle?.checked).toBe(true)

    const clear = container.querySelector<HTMLButtonElement>('button[data-slot="icon-clear"]')
    expect(clear).not.toBeNull()
    fireEvent.click(clear!)
    expect(config().layout.icon).toEqual({ source: 'none', id: '' })
  })

  it('自定义颜色下有四个预设色块，点选即写回', () => {
    const { container } = mount(<TextPanel />)
    // 效果组默认折叠，先展开
    fireEvent.click(screen.getByRole('button', { name: /效果|Effect|効果|효과/ }))

    const presets = container.querySelectorAll('button[role="radio"]')
    expect(presets).toHaveLength(4)
    fireEvent.click(presets[1]!)
    expect(config().typography.color).toBe('#141413')
  })
})

describe('StylePanel 排布', () => {
  it('质感面板的种子区在质感选择之前', () => {
    mount(<StylePanel />)

    const seed = screen.getByRole('button', { name: 'Seed' })
    const style = screen.getByRole('button', { name: 'Texture' })
    expect(seed.compareDocumentPosition(style) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
})

describe('PalettePanel', () => {
  it('点内置配色写回 palette', () => {
    const { container } = mount(<PalettePanel />)
    const swatches = container.querySelectorAll<HTMLInputElement>('input[data-group="palette"]')
    expect(swatches.length).toBeGreaterThanOrEqual(24)

    const target = [...swatches].find((item) => item.value !== DEFAULT_CONFIG.palette)
    expect(target).toBeDefined()
    fireEvent.click(target!)
    expect(config().palette).toBe(target!.value)
  })

  it('粘贴 hex 列表就落到自定义配色', () => {
    const { container } = mount(<PalettePanel />)
    // 自定义分组默认折叠，先展开再拿里面的粘贴框
    fireEvent.click(screen.getByRole('button', { name: /自定义|Custom|カスタム|사용자/ }))
    const paste = container.querySelector('textarea')
    expect(paste).not.toBeNull()

    fireEvent.change(paste!, { target: { value: '#FDE68A, #a5f3fc\n#c7d2fe' } })
    expect(config().palette).toBe('custom')
    expect(config().customColors).toEqual(['#fde68a', '#a5f3fc', '#c7d2fe'])
  })

  it('明暗筛选能收窄网格', () => {
    const { container } = mount(<PalettePanel />)
    const total = container.querySelectorAll('input[data-group="palette"]').length
    fireEvent.click(
      container.querySelector<HTMLInputElement>('input[data-group="palette-tone"][value="dark"]')!,
    )
    const dark = container.querySelectorAll('input[data-group="palette"]').length
    expect(dark).toBeGreaterThan(0)
    expect(dark).toBeLessThan(total)
  })
})

describe('StylePanel', () => {
  it('换质感与换种子都写回 store', () => {
    const { container } = mount(<StylePanel />)

    const silk = container.querySelector<HTMLInputElement>(
      'input[data-group="style"][value="silk"]',
    )
    expect(silk).not.toBeNull()
    fireEvent.click(silk!)
    expect(config().style).toBe('silk')

    const before = config().seed
    const shuffle = screen.getByRole('button', { name: 'New seed' })
    fireEvent.click(shuffle)
    expect(config().seed).not.toBe(before)
  })

  it('当前 style 的五个滑杆加高光都在', () => {
    const { container } = mount(<StylePanel />)
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(6)
  })
})

describe('CanvasPanel', () => {
  it('尺寸预设与形状写回 store', () => {
    const { container } = mount(<CanvasPanel />)

    const preset = screen.getByRole('button', { name: '2048' })
    fireEvent.click(preset)
    expect(config().canvas.width).toBe(2048)
    expect(config().canvas.height).toBe(2048)

    const circle = container.querySelector<HTMLInputElement>(
      'input[data-group="canvas-shape"][value="circle"]',
    )
    fireEvent.click(circle!)
    expect(config().canvas.shape).toBe('circle')
  })

  it('自定义宽高会夹到合法区间', () => {
    const { container } = mount(<CanvasPanel />)
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]')
    expect(inputs).toHaveLength(2)
    fireEvent.change(inputs[0]!, { target: { value: '99999' } })
    expect(config().canvas.width).toBe(8192)
  })
})

describe('ExportDrawer', () => {
  it('打开后能切格式与体积档', () => {
    mount(<ExportDrawer open onOpenChange={() => {}} />)
    const png = document.querySelector<HTMLInputElement>(
      'input[data-group="export-format"][value="png"]',
    )
    expect(png).not.toBeNull()
    fireEvent.click(png!)
    expect(config().exportOptions.format).toBe('png')

    const target = document.querySelector<HTMLInputElement>(
      'input[data-group="export-size-target"][value="none"]',
    )
    expect(target).not.toBeNull()
    // PNG 无损，体积档这时应当是禁用的
    expect(target!.disabled).toBe(true)
  })
})

describe('FontPicker', () => {
  it('打开后有搜索框与字体条目', () => {
    mount(<FontPicker open onOpenChange={() => {}} />)
    const input = document.querySelector<HTMLInputElement>('[data-slot="command-input"]')
    expect(input).not.toBeNull()
    expect(document.querySelectorAll('[data-slot="command-item"]').length).toBeGreaterThan(0)
  })
})

describe('HistoryStrip', () => {
  it('没有历史时给一句提示，有历史时点了能回退', () => {
    const { container, rerender } = mount(<HistoryStrip />)
    expect(container.querySelectorAll('button')).toHaveLength(0)

    const older: AvatarConfig = { ...DEFAULT_CONFIG, text: '旧的一版', palette: 'coral-dawn' }
    useAvatarStore.setState({ history: [{ config: older }] })
    rerender(
      <I18nProvider>
        <HistoryStrip />
      </I18nProvider>,
    )

    const group = screen.getByRole('group')
    const items = within(group).getAllByRole('button')
    expect(items).toHaveLength(1)
    fireEvent.click(items[0]!)
    expect(config().text).toBe('旧的一版')
  })
})
