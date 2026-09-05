/**
 * 样张页。只在 URL 带 ?samples=1 时由 main.tsx 动态加载，
 * 不进首屏 chunk，产品代码也不引用它。
 *
 * 样张不是截图工具的一部分：这里走 composeAvatar 真实导出链路，
 * 页面只负责把 37 套配色、四种质感与五种文字效果排成可目检的网格。
 *
 * 配色分三张排，不是两张：一张塞满二十几行时高度过万像素，
 * 软件渲染下 Chromium 直接报 “Unable to capture screenshot”。
 */

import { releaseCanvas } from '@/export/canvas'
import { composeAvatar } from '@/export/compose'
import { PALETTES } from '@/palettes/palettes'
import { STYLE_LIST } from '@/engine/styles'
import { translate } from '@/i18n'
import { DEFAULT_CONFIG, TEXT_EFFECTS, normalizeConfig, type AvatarConfig } from '@/state/config'

const CELL = 352
const GAP = 8
const EFFECT_PALETTES = ['aurora', 'sunset', 'glacier', 'midnight', 'peach']
/** 配色样张分几张。每张十几行，再多就超出截图能承受的高度。 */
const SHEETS = 3

function text(text: string): HTMLDivElement {
  const node = document.createElement('div')
  node.textContent = text
  return node
}

function header(): HTMLDivElement {
  const node = document.createElement('div')
  node.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:0 0 18px'
  const title = text('渐变头像样张')
  title.style.cssText = 'font-size:22px;font-weight:700;color:#141413'
  const d = DEFAULT_CONFIG
  const detail = text(
    [
      `文字：${JSON.stringify(d.text)}`,
      `文字效果：${d.typography.effect} · 强度 ${d.typography.effectStrength}`,
      `边距 ${d.typography.padding} · 行高 ${d.typography.lineHeight} · 光感 ${d.highlight}`,
      `质感参数：intensity ${d.styleParams.intensity} / softness ${d.styleParams.softness} / grain ${d.styleParams.grain} / scale ${d.styleParams.scale} / rotation ${d.styleParams.rotation}`,
    ].join('　'),
  )
  detail.style.cssText = 'font-size:12px;color:#52525b;max-width:1424px'
  node.append(title, detail)
  return node
}

function sectionTitle(value: string): HTMLDivElement {
  const node = text(value)
  node.style.cssText = 'font-size:15px;font-weight:650;color:#141413;margin:22px 0 10px'
  return node
}

async function cell(config: AvatarConfig): Promise<HTMLCanvasElement> {
  const canvas = await composeAvatar(config, CELL, CELL)
  canvas.style.cssText = `width:${CELL}px;height:${CELL}px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.12)`
  return canvas
}

function grid(width: number): HTMLDivElement {
  const node = document.createElement('div')
  node.style.cssText = `display:grid;gap:${GAP}px;width:${width}px`
  return node
}

async function stylePaletteSheet(palettes: typeof PALETTES): Promise<HTMLDivElement> {
  const sheet = document.createElement('div')
  const columns = STYLE_LIST.length
  const width = columns * CELL + (columns - 1) * GAP
  const heading = grid(width)
  heading.style.gridTemplateColumns = `repeat(${columns}, ${CELL}px)`
  for (const style of STYLE_LIST) {
    const label = text(translate('zh-CN', style.nameKey))
    label.style.cssText = 'height:28px;font-size:12px;font-weight:600;color:#52525b'
    heading.appendChild(label)
  }
  sheet.appendChild(heading)

  for (const palette of palettes) {
    const row = grid(width)
    row.style.gridTemplateColumns = `repeat(${columns}, ${CELL}px)`
    for (const style of STYLE_LIST) {
      const config = normalizeConfig({
        ...DEFAULT_CONFIG,
        style: style.id,
        palette: palette.id,
      })
      row.appendChild(await cell(config))
    }
    sheet.appendChild(row)
  }
  return sheet
}

async function textEffectSheet(): Promise<HTMLDivElement> {
  const columns = TEXT_EFFECTS.length
  const width = columns * CELL + (columns - 1) * GAP
  const sheet = document.createElement('div')
  const heading = grid(width)
  heading.style.gridTemplateColumns = `repeat(${columns}, ${CELL}px)`
  for (const effect of TEXT_EFFECTS) {
    const label = text(translate('zh-CN', `panel.text.effect.${effect}`))
    label.style.cssText = 'height:28px;font-size:12px;font-weight:600;color:#52525b'
    heading.appendChild(label)
  }
  sheet.appendChild(heading)

  for (const paletteId of EFFECT_PALETTES) {
    const row = grid(width)
    row.style.gridTemplateColumns = `repeat(${columns}, ${CELL}px)`
    for (const effect of TEXT_EFFECTS) {
      const config = normalizeConfig({
        ...DEFAULT_CONFIG,
        palette: paletteId,
        typography: { ...DEFAULT_CONFIG.typography, effect },
      })
      row.appendChild(await cell(config))
    }
    sheet.appendChild(row)
  }
  return sheet
}

function mount(node: HTMLElement): void {
  const root = document.getElementById('root')
  if (!root) throw new Error('samples: missing #root')
  root.textContent = ''
  root.appendChild(node)
}

/** 渲染四张样张的 DOM；截图脚本等这个标记出现再落盘。 */
export async function renderSamples(): Promise<void> {
  const page = document.createElement('div')
  page.id = 'samples'
  page.style.cssText =
    'display:inline-flex;flex-direction:column;align-items:flex-start;padding:24px;background:#fbf9f6;color:#141413'
  page.appendChild(header())

  const per = Math.ceil(PALETTES.length / SHEETS)
  for (let i = 0; i < SHEETS; i += 1) {
    page.appendChild(sectionTitle(`质感 × 配色（${i + 1} / ${SHEETS}）`))
    page.appendChild(await stylePaletteSheet(PALETTES.slice(i * per, (i + 1) * per)))
  }
  page.appendChild(sectionTitle('文字效果'))
  page.appendChild(await textEffectSheet())

  mount(page)
  ;(window as unknown as { __gradientAvatarSamplesReady?: boolean }).__gradientAvatarSamplesReady =
    true
}

/** 截图脚本拿到的画布不需要复用，页面关闭即释放。 */
export function releaseSampleCanvases(): void {
  for (const canvas of document.querySelectorAll('#samples canvas')) {
    releaseCanvas(canvas as HTMLCanvasElement)
  }
}
