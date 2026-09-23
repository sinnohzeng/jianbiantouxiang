/**
 * 工作台冒烟：挑选栏两列能渲染出关键控件，动一下就写回 store。
 * 断言走 role、data-slot 与可访问名，不按下标数滑杆：
 * 滑杆散在四张卡片里，条数随图标有无、文字行数、当前质感与折叠组开合四个维度变。
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import ja from '@/i18n/ja.json'
import { I18nProvider, LOCALE_STORAGE_KEY } from '@/i18n'
import { CATALOG_CACHE_KEY, clearCatalogCache } from '@/fonts/catalog'
import { fontJobs, type FontLoadResult } from '@/fonts/loader'
import { clearUploadedFonts, registerUploadedFont } from '@/fonts/upload'
import { PreviewStage } from '@/app/PreviewStage'
import { ExportDrawer } from '@/app/panels/ExportDrawer'
import { FontPickerPanel } from '@/app/panels/FontPickerPanel'
import { HistoryStrip } from '@/app/panels/HistoryStrip'
import { IconPicker } from '@/app/panels/IconPicker'
import { recentFonts } from '@/app/panels/recent-fonts'
import { PickColumn } from '@/app/workspace/PickColumn'
import { DEFAULT_CONFIG, fontKey, type AvatarConfig, type FontChoice } from '@/state/config'
import { DEFAULT_UI, useAvatarStore } from '@/state/store'

// 预览只验字体 effect：加载器换成桩，fontJobs 保留真实实现；WebGL 挂载换成空壳
const loader = vi.hoisted(() => ({
  loadFontsForConfig: vi.fn<(config: AvatarConfig) => Promise<FontLoadResult[]>>(async () => []),
  topUpGlyphs: vi.fn<(config: AvatarConfig) => Promise<boolean>>(async () => false),
}))
vi.mock('@/fonts/loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/fonts/loader')>()),
  ...loader,
}))
vi.mock('@/engine/mount', () => ({
  createGradientMount: () => ({ update: () => {}, dispose: () => {} }),
}))

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

function ranges(container: HTMLElement): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')]
}

/** 按 data-slot 取一个折叠组，取不到直接报错，省得后面对着 null 断言。 */
function group(container: HTMLElement, slot: string): HTMLElement {
  const node = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`)
  expect(node, slot).not.toBeNull()
  return node!
}

/** 展开一个折叠组：Collapsible 收起时整块不挂，不点开就一条滑杆都数不到。 */
function openGroup(container: HTMLElement, slot: string): HTMLElement {
  const node = group(container, slot)
  const trigger = node.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger)
  return node
}

describe('挑选栏 · 文字节', () => {
  it('两个单行输入框，两行用换行连起来写回', () => {
    const { container } = mount(<PickColumn />)
    expect(container.querySelector('#avatar-text-first textarea')).toBeNull()

    fireEvent.change(firstLine(container), { target: { value: '请假中' } })
    fireEvent.change(secondLine(container), { target: { value: '09-01 至 09-07' } })
    expect(config().text).toBe('请假中\n09-01 至 09-07')
  })

  it('第二行清空后不留尾随换行', () => {
    const { container } = mount(<PickColumn />)
    fireEvent.change(firstLine(container), { target: { value: '请假中' } })
    fireEvent.change(secondLine(container), { target: { value: '09-01' } })
    fireEvent.change(secondLine(container), { target: { value: '' } })
    expect(config().text).toBe('请假中')
  })

  it('单行输入里粘贴的多行内容并成一行', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, text: '' } })
    const { container } = mount(<PickColumn />)
    fireEvent.change(firstLine(container), { target: { value: '第一行\n第二行\r\n第三行' } })
    expect(config().text).toBe('第一行第二行第三行')
  })

  it('页签与旧用途控件都退役，DOM 里不再出现', () => {
    const { container } = mount(<PickColumn />)
    expect(container.querySelector('[role="tablist"]')).toBeNull()
    expect(container.querySelector('input[data-group="text-kind"]')).toBeNull()
    expect(container.querySelector('input[data-group="text-align"]')).toBeNull()
  })

  it('滑杆全在挑选栏里：文字卡片至少有字号与强度两条', () => {
    const { container } = mount(<PickColumn />)
    expect(ranges(container).length).toBeGreaterThan(0)
    expect(ranges(group(container, 'text-font-size'))).toHaveLength(1)
    expect(ranges(group(container, 'text-effect-strength'))).toHaveLength(1)
  })

  it('文字色是一排从白到黑的预设色块，点选即写回', () => {
    const { container } = mount(<PickColumn />)
    const presets = container.querySelectorAll('button[role="radio"]')
    expect(presets).toHaveLength(5)
    fireEvent.click(presets[4]!)
    expect(config().typography.color).toBe('#000000')
  })
})

describe('挑选栏 · 图形节', () => {
  it('磁贴带当前图形标识，清除按钮一键回纯文字', () => {
    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        layout: { ...DEFAULT_CONFIG.layout, icon: { source: 'emoji', id: '1f334', mono: false } },
      },
    })
    const { container } = mount(<PickColumn />)

    expect(container.querySelector('[data-slot="graphic-pick"]')).toBeNull()
    expect(container.querySelector('[data-slot="graphic-picker"]')?.textContent).toContain('1f334')

    const clear = container.querySelector<HTMLButtonElement>('button[data-slot="icon-clear"]')
    expect(clear).not.toBeNull()
    fireEvent.click(clear!)
    expect(config().layout.icon).toEqual({ source: 'none', id: '', mono: false })
  })

  it('没有图形时是空态按钮，没有磁贴也没有清除按钮', () => {
    const { container } = mount(<PickColumn />)
    expect(container.querySelector('[data-slot="graphic-pick"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="graphic-picker"]')).toBeNull()
    expect(container.querySelector('button[data-slot="icon-clear"]')).toBeNull()
  })
})

describe('挑选栏 · 配色节', () => {
  it('点内置配色写回 palette', () => {
    const { container } = mount(<PickColumn />)
    const swatches = container.querySelectorAll<HTMLInputElement>('input[data-group="palette"]')
    expect(swatches.length).toBeGreaterThanOrEqual(24)

    const target = [...swatches].find((item) => item.value !== DEFAULT_CONFIG.palette)
    expect(target).toBeDefined()
    fireEvent.click(target!)
    expect(config().palette).toBe(target!.value)
  })

  it('明暗筛选能收窄磁贴', () => {
    const { container } = mount(<PickColumn />)
    const total = container.querySelectorAll('input[data-group="palette"]').length
    fireEvent.click(
      container.querySelector<HTMLInputElement>('input[data-group="palette-tone"][value="dark"]')!,
    )
    const dark = container.querySelectorAll('input[data-group="palette"]').length
    expect(dark).toBeGreaterThan(0)
    expect(dark).toBeLessThan(total)
  })

  it('粘贴 hex 列表就落到自定义配色', () => {
    const { container } = mount(<PickColumn />)
    // 折叠组现在有六处，按 data-slot 认自定义配色那一处，不按下标数
    openGroup(container, 'palette-custom')

    const paste = container.querySelector('textarea')
    expect(paste).not.toBeNull()
    fireEvent.change(paste!, { target: { value: '#FDE68A, #a5f3fc\n#c7d2fe' } })
    expect(config().palette).toBe('custom')
    expect(config().customColors).toEqual(['#fde68a', '#a5f3fc', '#c7d2fe'])
  })

  it('配色节不再重复摆随机按钮与家族下拉，两者都在别处', () => {
    const { container } = mount(<PickColumn />)
    expect(container.querySelector('[data-slot="palette-shuffle"]')).toBeNull()
    expect(container.querySelector('[data-slot="select-trigger"]')).toBeNull()
  })
})

describe('挑选栏 · 质感节', () => {
  it('换质感与换种子都写回 store', () => {
    const { container } = mount(<PickColumn />)

    const silk = container.querySelector<HTMLInputElement>(
      'input[data-group="style"][value="silk"]',
    )
    expect(silk).not.toBeNull()
    fireEvent.click(silk!)
    expect(config().style).toBe('silk')

    const before = config().seed
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-slot="seed-shuffle"]')!)
    expect(config().seed).not.toBe(before)
  })

  it('种子那一行排在四张质感磁贴之后', () => {
    const { container } = mount(<PickColumn />)
    const tile = container.querySelector('input[data-group="style"]')!
    const seed = container.querySelector('#style-seed')!
    expect(tile.compareDocumentPosition(seed) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
})

describe('导出抽屉 · 画布', () => {
  // 画布本质上是导出参数，v5 起长在导出抽屉里，不在微调面板
  it('尺寸预设与形状写回 store', () => {
    mount(<ExportDrawer open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '4096' }))
    expect(config().canvas.width).toBe(4096)
    expect(config().canvas.height).toBe(4096)

    const circle = document.querySelector<HTMLInputElement>(
      'input[data-group="canvas-shape"][value="circle"]',
    )
    fireEvent.click(circle!)
    expect(config().canvas.shape).toBe('circle')
  })

  it('自定义宽高会夹到合法区间', () => {
    mount(<ExportDrawer open onOpenChange={() => {}} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="number"]')
    expect(inputs).toHaveLength(2)
    fireEvent.change(inputs[0]!, { target: { value: '99999' } })
    expect(config().canvas.width).toBe(8192)
  })

  it('挑选栏里没有画布字段了', () => {
    const { container } = mount(<PickColumn />)
    expect(container.querySelector('input[data-group="canvas-shape"]')).toBeNull()
  })
})

describe('挑选栏 · 数值行', () => {
  it('版面与位置微调默认收起，展开后才挂滑杆', () => {
    const { container } = mount(<PickColumn />)
    const layout = group(container, 'text-group-layout')
    const trigger = layout.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // Base UI 的 Collapsible 收起时整块从 DOM 卸载，不是藏起来
    expect(ranges(layout)).toHaveLength(0)

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(ranges(layout).length).toBeGreaterThan(0)
  })

  it('第一行字号紧跟第一行输入：自动态显示回写值，拖一下切手动，点“自动”回去', () => {
    useAvatarStore.setState({ ui: { ...useAvatarStore.getState().ui, autoFontSize: 0.31 } })
    const { container } = mount(<PickColumn />)
    expect(config().typography.line1.size).toBeNull()

    const row = group(container, 'text-font-size')
    const input = firstLine(container)
    expect(input.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

    const autoButton = row.querySelector<HTMLButtonElement>('[data-slot="slider-auto"]')
    expect(autoButton?.getAttribute('aria-pressed')).toBe('true')

    // 自动态滑杆显示的是预览回写的自动值
    const slider = ranges(row)[0]!
    expect(Number(slider.value)).toBeCloseTo(0.31)

    fireEvent.change(slider, { target: { value: '0.33' } })
    expect(config().typography.line1.size).toBeCloseTo(0.33)
    expect(autoButton?.getAttribute('aria-pressed')).toBe('false')

    // 点回自动后滑杆停在刚才的定值上，等预览回写新解再动
    fireEvent.click(autoButton!)
    expect(config().typography.line1.size).toBeNull()
    expect(Number(ranges(row)[0]!.value)).toBeCloseTo(0.33)
  })

  it('第二行字号紧跟在第二行输入之后：默认跟随第一行的 62%，一拖就是自己的短边比例', () => {
    useAvatarStore.setState({ ui: { ...useAvatarStore.getState().ui, autoFontSize: 0.5 } })
    const { container } = mount(<PickColumn />)
    const row = group(container, 'text-line2-size')
    const input = secondLine(container)
    expect(input.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

    const autoButton = row.querySelector<HTMLButtonElement>('[data-slot="slider-auto"]')
    expect(autoButton?.getAttribute('aria-pressed')).toBe('true')
    expect(Number(ranges(row)[0]!.value)).toBeCloseTo(0.31)

    fireEvent.change(ranges(row)[0]!, { target: { value: '0.3' } })
    expect(config().typography.line2.size).toBeCloseTo(0.3)
    // 第一行仍是自动，第二行的定值不牵连它
    expect(config().typography.line1.size).toBeNull()
    expect(autoButton?.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(autoButton!)
    expect(config().typography.line2.size).toBeNull()
  })

  it('拖第一行字号时第二行钉在此刻的大小', () => {
    useAvatarStore.setState({ ui: { ...useAvatarStore.getState().ui, autoFontSize: 0.5 } })
    const { container } = mount(<PickColumn />)
    expect(config().typography.line2.size).toBeNull()

    fireEvent.change(ranges(group(container, 'text-font-size'))[0]!, { target: { value: '0.7' } })
    expect(config().typography.line1.size).toBeCloseTo(0.7)
    // 拖之前第二行跟随 0.5 × 0.62，拖完仍是这个数
    expect(config().typography.line2.size).toBeCloseTo(0.31)

    fireEvent.change(ranges(group(container, 'text-font-size'))[0]!, { target: { value: '0.2' } })
    expect(config().typography.line2.size).toBeCloseTo(0.31)
  })

  it('位置微调组展开后是四行：两行各自的水平与垂直', () => {
    const { container } = mount(<PickColumn />)
    const offset = openGroup(container, 'text-group-offset')
    const list = ranges(offset)
    expect(list).toHaveLength(4)

    fireEvent.change(list[0]!, { target: { value: '0.02' } })
    fireEvent.change(list[1]!, { target: { value: '0.01' } })
    fireEvent.change(list[2]!, { target: { value: '-0.03' } })
    fireEvent.change(list[3]!, { target: { value: '-0.02' } })
    const { line1, line2 } = config().typography
    expect([line1.offsetX, line1.offsetY]).toEqual([0.02, 0.01])
    expect([line2.offsetX, line2.offsetY]).toEqual([-0.03, -0.02])
  })

  it('只有一行时：没有第二行字号，位置微调只剩第一行那两条', () => {
    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, text: '暴富' } })
    const { container } = mount(<PickColumn />)
    expect(container.querySelector('[data-slot="text-line2-size"]')).toBeNull()

    const offset = openGroup(container, 'text-group-offset')
    expect(ranges(offset)).toHaveLength(2)
    fireEvent.change(ranges(offset)[0]!, { target: { value: '0.05' } })
    expect(config().typography.line1.offsetX).toBeCloseTo(0.05)
  })

  it('质感的参数组展开后是当前 style 的五个参数加光感', () => {
    const { container } = mount(<PickColumn />)
    const params = openGroup(container, 'style-group-params')
    expect(ranges(params)).toHaveLength(6)
  })

  it('图标大小常显，位置微调展开后再多两条；没有图标时一条都没有', () => {
    const { container: empty } = mount(<PickColumn />)
    const emptyCard = empty.querySelector('[data-slot="graphic-pick"]')!.closest('section')!
    expect(ranges(emptyCard)).toHaveLength(0)
    expect(empty.querySelector('[data-slot="graphic-group-offset"]')).toBeNull()
    cleanup()

    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        layout: {
          ...DEFAULT_CONFIG.layout,
          icon: { source: 'builtin', id: 'palmtree', mono: false },
        },
      },
    })
    const { container } = mount(<PickColumn />)
    const card = container.querySelector('[data-slot="graphic-picker"]')!.closest('section')!
    expect(ranges(card)).toHaveLength(1)
    expect(ranges(openGroup(container, 'graphic-group-offset'))).toHaveLength(2)
    expect(ranges(card)).toHaveLength(3)
  })

  it('偏离默认值的行才有重置钮，点一下回默认', () => {
    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        typography: { ...DEFAULT_CONFIG.typography, padding: 0.25 },
      },
    })
    const { container } = mount(<PickColumn />)
    const layout = openGroup(container, 'text-group-layout')
    const resets = layout.querySelectorAll<HTMLButtonElement>('[data-slot="slider-reset"]')
    expect(resets).toHaveLength(1)
    fireEvent.click(resets[0]!)
    expect(config().typography.padding).toBeCloseTo(DEFAULT_CONFIG.typography.padding)
  })

  it('每一行都有常驻数字框', () => {
    const { container } = mount(<PickColumn />)
    expect(container.querySelectorAll('[data-slot="slider-number"]')).toHaveLength(
      ranges(container).length,
    )
  })
})

const KUAILE: FontChoice = { family: 'ZCOOL KuaiLe', source: 'google', weight: 400 }

/** 按 data-slot 取某一行的字体行，取不到直接报错。 */
function fontField(container: HTMLElement, line: 1 | 2): HTMLElement {
  return group(container, `text-line${line}-font`)
}

function fontTrigger(container: HTMLElement, line: 1 | 2): HTMLButtonElement {
  return fontField(container, line).querySelector<HTMLButtonElement>('[data-slot="font-trigger"]')!
}

/** 打开某一行的字重下拉，返回弹出来的选项。Base UI 的 Select 在 mousedown 时打开。 */
async function openWeights(container: HTMLElement, line: 1 | 2): Promise<HTMLElement[]> {
  const trigger = fontField(container, line).querySelector<HTMLElement>(
    '[data-slot="font-weight"]',
  )!
  fireEvent.mouseDown(trigger)
  await screen.findByRole('listbox')
  return screen.getAllByRole('option')
}

/** 点一个下拉选项。Base UI 的真实鼠标点选要从选项上按下开始，只发 click 会被当成打开时的误触。 */
function pickOption(name: RegExp): void {
  const option = screen.getByRole('option', { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

function withLine2(font: FontChoice | null, text = '飞书\n效率先锋'): AvatarConfig {
  return {
    ...DEFAULT_CONFIG,
    text,
    typography: {
      ...DEFAULT_CONFIG.typography,
      line2: { ...DEFAULT_CONFIG.typography.line2, font },
    },
  }
}

describe('挑选栏 · 逐行字体', () => {
  it('两行都有内容时两条字体行，只有第一行时一条', () => {
    const { container, unmount } = mount(<PickColumn />)
    expect(container.querySelectorAll('[data-slot="font-trigger"]')).toHaveLength(2)
    unmount()

    useAvatarStore.setState({ config: { ...DEFAULT_CONFIG, text: '暴富' } })
    const single = mount(<PickColumn />)
    expect(single.container.querySelectorAll('[data-slot="font-trigger"]')).toHaveLength(1)
  })

  it('字体排在自己那一行输入之后、字号之前', () => {
    const { container } = mount(<PickColumn />)
    const after = (a: Node, b: Node) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(after(firstLine(container), fontField(container, 1))).toBe(true)
    expect(after(fontField(container, 1), group(container, 'text-font-size'))).toBe(true)
    expect(after(secondLine(container), fontField(container, 2))).toBe(true)
    expect(after(fontField(container, 2), group(container, 'text-line2-size'))).toBe(true)
  })

  it('第二行默认跟随：跟随钮按下，按钮写第一行那款且用次要前景色', () => {
    const { container } = mount(<PickColumn />)
    const follow = fontField(container, 2).querySelector('[data-slot="font-follow"]')!
    expect(follow.getAttribute('aria-pressed')).toBe('true')

    const trigger = screen.getByRole('button', { name: 'Line 2 font Noto Sans SC' })
    expect(trigger).toBe(fontTrigger(container, 2))
    expect(trigger.getAttribute('title')).toBe('Noto Sans SC')
    const name = document.getElementById(trigger.getAttribute('aria-labelledby')!.split(' ')[1]!)!
    expect(name.className).toContain('text-muted-foreground')
    expect(fontTrigger(container, 1).textContent).toContain('Noto Sans SC')
  })

  it('第一行字重下拉写第一行，第二行仍跟随', async () => {
    const { container } = mount(<PickColumn />)
    const options = await openWeights(container, 1)
    expect(options.map((option) => option.textContent)).toContain('Regular400')
    pickOption(/Regular/)
    expect(config().typography.line1.font.weight).toBe(400)
    expect(config().typography.line2.font).toBeNull()
  })

  it('第二行改字重即独立，点跟随回到 null', async () => {
    const { container } = mount(<PickColumn />)
    await openWeights(container, 2)
    pickOption(/Regular/)
    expect(config().typography.line2.font).toEqual({
      ...DEFAULT_CONFIG.typography.line1.font,
      weight: 400,
    })
    expect(config().typography.line1.font).toEqual(DEFAULT_CONFIG.typography.line1.font)

    const follow = fontField(container, 2).querySelector<HTMLButtonElement>(
      '[data-slot="font-follow"]',
    )!
    expect(follow.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(follow)
    expect(config().typography.line2.font).toBeNull()
  })

  it('非精选字体的字重下拉只列目录缓存里的真实档位', async () => {
    clearCatalogCache()
    localStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({
        at: Date.now() - 30 * 24 * 60 * 60 * 1000,
        fonts: [{ id: 'roboto-slab', family: 'Roboto Slab', weights: [300, 700] }],
      }),
    )
    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        typography: {
          ...DEFAULT_CONFIG.typography,
          line1: {
            ...DEFAULT_CONFIG.typography.line1,
            font: { family: 'Roboto Slab', source: 'google', weight: 700 },
          },
        },
      },
    })
    const { container } = mount(<PickColumn />)
    const options = await openWeights(container, 1)
    expect(options.map((option) => option.textContent)).toEqual(['Light300', 'Bold700'])
    clearCatalogCache()
  })

  it('只有一档字重的字体，下拉禁用', () => {
    useAvatarStore.setState({ config: withLine2(KUAILE) })
    const { container } = mount(<PickColumn />)
    const weight = fontField(container, 2).querySelector('[data-slot="font-weight"]')!
    expect(weight.hasAttribute('data-disabled')).toBe(true)
  })

  it('第二行字体回落中时按钮带告警图标与读屏说明，第一行不受牵连', () => {
    useAvatarStore.setState({
      config: withLine2(KUAILE),
      ui: { ...DEFAULT_UI, fontFallbacks: [fontKey(KUAILE)] },
    })
    const { container } = mount(<PickColumn />)
    const second = fontTrigger(container, 2)
    expect(second.querySelector('svg.text-amber-600')).not.toBeNull()
    const described = document.getElementById(second.getAttribute('aria-describedby')!)
    expect(described?.textContent).toBe('Failed to load, showing a system font')

    const first = fontTrigger(container, 1)
    expect(first.querySelector('svg.text-amber-600')).toBeNull()
    expect(first.hasAttribute('aria-describedby')).toBe(false)
  })

  it('点字体按钮弹出选择器，关掉再开搜索框是空的', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
    const { container } = mount(<PickColumn />)
    fireEvent.click(fontTrigger(container, 1))
    const input = await screen.findByPlaceholderText('Search fonts')
    fireEvent.change(input, { target: { value: 'pacif' } })
    expect((input as HTMLInputElement).value).toBe('pacif')

    fireEvent.click(fontTrigger(container, 1))
    await waitFor(() => expect(screen.queryByPlaceholderText('Search fonts')).toBeNull())

    fireEvent.click(fontTrigger(container, 1))
    const reopened = await screen.findByPlaceholderText('Search fonts')
    expect((reopened as HTMLInputElement).value).toBe('')
    vi.unstubAllGlobals()
  })
})

describe('FontPickerPanel', () => {
  beforeEach(() => {
    recentFonts.set([])
    // 全库目录不发真实请求：空目录让 fetchCatalog 回落精选清单
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearUploadedFonts()
  })

  function panel(line: 1 | 2, onDone = vi.fn()) {
    mount(<FontPickerPanel line={line} onDone={onDone} />)
    return onDone
  }

  function selected(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')
  }

  it('打开时高亮该行的生效字体，勾选项带读屏的“当前”', () => {
    useAvatarStore.setState({
      config: withLine2({ family: 'Noto Serif SC', source: 'google', weight: 700 }),
    })
    panel(2)
    expect(selected()?.textContent).toBe('Noto Serif SCcurrent')
    expect(selected()?.getAttribute('data-checked')).toBe('true')
  })

  it('第二行跟随时点打勾那一项，只关弹层，第二行仍跟随，撤销栈不变', () => {
    useAvatarStore.setState({ past: [] })
    const onDone = panel(2)
    const checked = document.querySelector<HTMLElement>('[cmdk-item][data-checked="true"]')!
    expect(checked.textContent).toContain('Noto Sans SC')
    fireEvent.click(checked)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(config().typography.line2.font).toBeNull()
    expect(useAvatarStore.getState().past).toHaveLength(0)
  })

  it('第二行的选择器写第二行，第一行不动', () => {
    const onDone = panel(2)
    fireEvent.click(screen.getAllByRole('option', { name: 'Inter' })[0]!)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(config().typography.line2.font).toEqual({
      family: 'Inter',
      source: 'google',
      weight: 700,
    })
    expect(config().typography.line1.font).toEqual(DEFAULT_CONFIG.typography.line1.font)
    expect(recentFonts.get()).toEqual(['Inter'])
  })

  it('第一行的选择器写第一行，跟随中的第二行仍是 null', () => {
    panel(1)
    fireEvent.click(screen.getAllByRole('option', { name: 'Inter' })[0]!)
    expect(config().typography.line1.font.family).toBe('Inter')
    expect(config().typography.line2.font).toBeNull()
  })

  it('日文界面第一个精选组是日文，第二个是拉丁', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ja')
    panel(1)
    await screen.findByText(ja['font.curated.jp'])
    const curatedHeadings = new Set([
      ja['font.curated.sc'],
      ja['font.curated.tc'],
      ja['font.curated.jp'],
      ja['font.curated.kr'],
      ja['font.curated.latin'],
    ])
    const headings = [...document.querySelectorAll('[cmdk-group-heading]')]
      .map((node) => node.textContent ?? '')
      .filter((text) => curatedHeadings.has(text))
    expect(headings.slice(0, 2)).toEqual([ja['font.curated.jp'], ja['font.curated.latin']])
  })

  it('繁体组同时收台湾与香港两类字体', () => {
    panel(1)
    const heading = [...document.querySelectorAll('[cmdk-group-heading]')].find(
      (node) => node.textContent === 'Traditional Chinese picks',
    )!
    const items = heading.parentElement!.querySelectorAll('[cmdk-item]')
    const names = [...items].map((item) => item.textContent)
    expect(names).toContain('Noto Sans TC')
    expect(names).toContain('Noto Sans HK')
  })

  it('本会话上传过的字体在第二行的选择器里可选，选中写成上传来源', async () => {
    vi.stubGlobal(
      'FontFace',
      class {
        load() {
          return Promise.resolve(this)
        }
      },
    )
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: () => {}, delete: () => true },
    })
    await registerUploadedFont(new File([new Uint8Array([0, 1, 0, 0])], 'Brush.ttf'))

    panel(2)
    expect(screen.getByText('Uploaded')).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: 'Brush' }))
    expect(config().typography.line2.font).toEqual({
      family: 'Brush-upload',
      source: 'upload',
      weight: 700,
    })
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

describe('IconPicker', () => {
  it('品牌页能切到并列出飞书，单色档读的是配置里那一位', async () => {
    mount(<IconPicker open onOpenChange={() => {}} />)

    const brand = document.querySelector<HTMLInputElement>(
      'input[data-group="icon-source"][value="brand"]',
    )
    expect(brand).not.toBeNull()
    fireEvent.click(brand!)

    // 索引是懒加载的，等它落地再断言；界面语言随环境，中英文名都认
    expect(await screen.findByRole('option', { name: /飞书|Lark/ })).toBeTruthy()

    // 默认原色，切一下写回配置而不是选择器的局部 state
    const mono = document.querySelector<HTMLInputElement>(
      'input[data-group="brand-variant"][value="mono"]',
    )
    expect(mono?.checked).toBe(false)
    fireEvent.click(mono!)
    expect(config().layout.icon.mono).toBe(true)
  })

  it('挑中的品牌落成品牌 id，单色档不再改写 id', async () => {
    mount(<IconPicker open onOpenChange={() => {}} />)
    fireEvent.click(
      document.querySelector<HTMLInputElement>('input[data-group="icon-source"][value="brand"]')!,
    )
    fireEvent.click(
      document.querySelector<HTMLInputElement>('input[data-group="brand-variant"][value="mono"]')!,
    )
    fireEvent.click(await screen.findByRole('option', { name: /飞书|Lark/ }))

    expect(config().layout.icon).toEqual({ source: 'brand', id: 'lark', mono: true })
  })
})

describe('挑选栏 · 品牌单色', () => {
  function monoTiles(container: HTMLElement): HTMLInputElement[] {
    return [...container.querySelectorAll<HTMLInputElement>('input[data-group="brand-mono"]')]
  }

  it('只有品牌来源才出现原色 / 单色这一档', () => {
    const { container, rerender } = mount(<PickColumn />)
    expect(monoTiles(container)).toHaveLength(0)

    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        layout: { ...DEFAULT_CONFIG.layout, icon: { source: 'emoji', id: '1f334', mono: false } },
      },
    })
    rerender(
      <I18nProvider>
        <PickColumn />
      </I18nProvider>,
    )
    expect(monoTiles(container)).toHaveLength(0)

    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        layout: { ...DEFAULT_CONFIG.layout, icon: { source: 'brand', id: 'lark', mono: false } },
      },
    })
    rerender(
      <I18nProvider>
        <PickColumn />
      </I18nProvider>,
    )
    expect(monoTiles(container)).toHaveLength(2)
  })

  it('切一下写回配置，撤销栈只多一格', () => {
    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        layout: { ...DEFAULT_CONFIG.layout, icon: { source: 'brand', id: 'lark', mono: false } },
      },
      past: [],
    })
    const { container } = mount(<PickColumn />)

    const mono = monoTiles(container).find((tile) => tile.value === 'mono')
    fireEvent.click(mono!)

    expect(config().layout.icon.mono).toBe(true)
    expect(useAvatarStore.getState().past).toHaveLength(1)
  })
})

describe('PreviewStage 的字体加载', () => {
  it('第二行填上文字、字体与第一行不同时再加载一次', async () => {
    loader.loadFontsForConfig.mockClear()
    // jsdom 没有画布实现，取上下文一律给 null，预览按拿不到上下文的分支跳过绘制
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const kuaile = { family: 'ZCOOL KuaiLe', source: 'google', weight: 400 } as const
    useAvatarStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        text: '飞书',
        typography: {
          ...DEFAULT_CONFIG.typography,
          line2: { ...DEFAULT_CONFIG.typography.line2, font: kuaile },
        },
      },
    })
    mount(<PreviewStage />)

    // 第二行没有文字，钉住的字体不加载
    await waitFor(() => expect(loader.loadFontsForConfig).toHaveBeenCalledTimes(1))
    const first = loader.loadFontsForConfig.mock.calls[0]![0]
    expect(fontJobs(first).map((job) => job.font.family)).toEqual(['Noto Sans SC'])

    act(() => {
      useAvatarStore.getState().setConfig({ text: '飞书\n先锋' })
    })
    await waitFor(() => expect(loader.loadFontsForConfig).toHaveBeenCalledTimes(2))
    const second = loader.loadFontsForConfig.mock.calls[1]![0]
    expect(fontJobs(second).map((job) => job.font)).toContainEqual(kuaile)
    getContext.mockRestore()
  })
})
