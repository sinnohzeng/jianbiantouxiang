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
import { useAvatarStore } from '@/state/store'

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
  useAvatarStore.setState({ config: DEFAULT_CONFIG, history: [] })
})

afterEach(() => {
  cleanup()
})

/** 切用途。分段控件的真实控件是 sr-only 的 radio，按 data-group 与取值查。 */
function pickKind(container: HTMLElement, value: string): void {
  const radio = container.querySelector<HTMLInputElement>(
    `input[data-group="text-kind"][value="${value}"]`,
  )
  expect(radio, value).not.toBeNull()
  fireEvent.click(radio!)
}

function firstLine(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#avatar-text-first')!
}

function secondLine(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#avatar-text-second')!
}

describe('TextPanel', () => {
  it('输入文字写回 store', () => {
    const { container } = mount(<TextPanel />)
    const textarea = container.querySelector('textarea')
    expect(textarea).not.toBeNull()
    fireEvent.change(textarea!, { target: { value: '猪猪老公' } })
    expect(config().text).toBe('猪猪老公')
  })

  it('对齐、锚点与竖排都接上了 store', () => {
    const { container } = mount(<TextPanel />)

    const right = container.querySelector<HTMLInputElement>(
      'input[data-group="text-align"][value="right"]',
    )
    expect(right).not.toBeNull()
    fireEvent.click(right!)
    expect(config().typography.align).toBe('right')

    const anchors = container.querySelectorAll('input[data-group="text-anchor"]')
    expect(anchors).toHaveLength(9)
    const topLeft = container.querySelector<HTMLInputElement>(
      'input[data-group="text-anchor"][value="tl"]',
    )
    fireEvent.click(topLeft!)
    expect(config().typography.anchor).toBe('tl')

    const vertical = container.querySelector<HTMLInputElement>('#text-vertical')
    expect(vertical).not.toBeNull()
    fireEvent.click(vertical!)
    expect(config().typography.vertical).toBe(true)
  })

  it('排版组里有滑杆', () => {
    // Base UI 的滑杆真实控件是 thumb 里那个 input[type=range]，
    // jsdom 没有布局，thumb 会停在 visibility:hidden，按 role 查不到，所以按标签查
    const { container } = mount(<TextPanel />)
    expect(container.querySelectorAll('input[type="range"]').length).toBeGreaterThanOrEqual(6)
  })

  it('状态徽章下换成两个单行输入框，两行用换行连起来写回', () => {
    const { container } = mount(<TextPanel />)
    pickKind(container, 'status')

    expect(container.querySelector('textarea')).toBeNull()
    fireEvent.change(firstLine(container), { target: { value: '请假中' } })
    fireEvent.change(secondLine(container), { target: { value: '09-01 至 09-07' } })
    expect(config().text).toBe('请假中\n09-01 至 09-07')
  })

  it('第二行清空后不留尾随换行', () => {
    const { container } = mount(<TextPanel />)
    pickKind(container, 'status')

    fireEvent.change(firstLine(container), { target: { value: '请假中' } })
    fireEvent.change(secondLine(container), { target: { value: '09-01' } })
    fireEvent.change(secondLine(container), { target: { value: '' } })
    expect(config().text).toBe('请假中')
  })

  it('切用途不清空已经填好的文字', () => {
    const { container } = mount(<TextPanel />)
    fireEvent.change(container.querySelector('textarea')!, { target: { value: '猪猪老公\n09-01' } })

    pickKind(container, 'status')
    expect(config().text).toBe('猪猪老公\n09-01')
    expect(firstLine(container).value).toBe('猪猪老公')
    expect(secondLine(container).value).toBe('09-01')

    pickKind(container, 'text')
    expect(config().text).toBe('猪猪老公\n09-01')
    expect(container.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('猪猪老公\n09-01')
  })

  it('状态徽章下锚点、偏移、对齐、竖排、自动换行都不在 DOM 里', () => {
    const { container } = mount(<TextPanel />)
    const sliders = () => container.querySelectorAll('input[type="range"]').length

    expect(container.querySelector('input[data-group="text-align"]')).not.toBeNull()
    expect(container.querySelectorAll('input[data-group="text-anchor"]')).toHaveLength(9)
    expect(container.querySelector('#text-vertical')).not.toBeNull()
    expect(container.querySelector('#text-auto-wrap')).not.toBeNull()
    const before = sliders()

    pickKind(container, 'status')

    // 条件渲染而不是 CSS 隐藏：这几个参数在这个用途下不参与求解，读屏与键盘也不该走到它们
    expect(container.querySelector('input[data-group="text-align"]')).toBeNull()
    expect(container.querySelectorAll('input[data-group="text-anchor"]')).toHaveLength(0)
    expect(container.querySelector('#text-vertical')).toBeNull()
    expect(container.querySelector('#text-auto-wrap')).toBeNull()
    // 两个偏移滑杆收起、次行字号滑杆出现，净少一个。数数量而不是认文案，换语言不会红
    expect(sliders()).toBe(before - 1)
  })

  it('次行字号滑杆写回 layout.scale', () => {
    const { container } = mount(<TextPanel />)
    pickKind(container, 'status')

    // 基础组排在最前，这个用途下它里面唯一的滑杆就是次行字号
    const range = container.querySelector<HTMLInputElement>('input[type="range"]')
    expect(range).not.toBeNull()
    fireEvent.change(range!, { target: { value: '0.6' } })
    expect(config().layout.scale).toBeCloseTo(0.6)
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
    const buttons = screen.getAllByRole('button')
    const shuffle = buttons.at(-1)
    expect(shuffle).toBeDefined()
    fireEvent.click(shuffle!)
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
    useAvatarStore.setState({ history: [older] })
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
