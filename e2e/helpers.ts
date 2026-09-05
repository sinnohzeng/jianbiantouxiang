/**
 * 两份冒烟共用的动作。文件名不带 .spec，Playwright 不会当用例收。
 *
 * 语言一律用 ?lang=zh-CN 钉死：Playwright 的 chromium 是 en-US，不钉的话断言会跟运行环境走。
 * ?probe=1 挂上 window.__gradientAvatarProbe，见 src/app/probe.ts。
 */

import { expect, type Locator, type Page } from '@playwright/test'

export const APP_URL = '/?probe=1&lang=zh-CN'

export interface ProbePixelStats {
  width: number
  height: number
  opaque: number
  colors: number
}

export interface ProbeEncodeResult {
  type: string
  bytes: number
  quality: number
  hitTarget: boolean
}

interface ProbeWindow {
  __gradientAvatarProbe?: {
    stats(size?: number): Promise<ProbePixelStats>
    encode(size?: number): Promise<ProbeEncodeResult>
  }
}

/** 合成与编码在软件渲染下要跑几秒，探针相关的用例统一放宽。 */
export const PROBE_TIMEOUT_MS = 60_000

/**
 * 打开首页并等到界面与探针都就绪。
 *
 * 进场幕布是 z-index 9999 的 fixed 层，读秒期间所有点击都落在幕布上，
 * 所以这里一并等它读完秒；开始抽走之后它就不吃指针事件了，不必等动画放完。
 * 炫技层关掉时它根本不挂，这一步立刻返回。
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto(APP_URL)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForFunction(
    () => (globalThis as unknown as ProbeWindow).__gradientAvatarProbe !== undefined,
  )
  await page
    .locator('[data-slot="preloader"][data-loading="true"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
}

/** 打开微调面板。v5 起它默认收起，开合状态落在 localStorage。 */
export async function openInspector(page: Page): Promise<void> {
  const toggle = page.locator('[data-slot="inspector-toggle"]')
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click()
  await expect(page.locator('[data-slot="inspector"]')).toBeVisible()
}

export function probeStats(page: Page, size?: number): Promise<ProbePixelStats> {
  return page.evaluate(
    (px) => (globalThis as unknown as ProbeWindow).__gradientAvatarProbe!.stats(px),
    size,
  )
}

export function probeEncode(page: Page, size?: number): Promise<ProbeEncodeResult> {
  return page.evaluate(
    (px) => (globalThis as unknown as ProbeWindow).__gradientAvatarProbe!.encode(px),
    size,
  )
}

/**
 * 手机档专用的点击与输入前置。
 *
 * 手机布局上边是 sticky 的预览、下边是 fixed 的操作条，中间才是可点的带。
 * Playwright 自己的 scrollIntoViewIfNeeded 只保证元素进视口，会把它停在预览底下，
 * 于是点击被判成“被别的元素拦住”。这里先量出中间那条带，把目标推到带中央再交给调用方点。
 */
export async function centreBetweenBars(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()

  const preview = page.locator('[data-slot="preview-pane"]')
  const bar = page.locator('[data-slot="bottom-bar"]')

  for (let round = 0; round < 3; round += 1) {
    const [box, previewBox, barBox, viewport] = await Promise.all([
      target.boundingBox(),
      preview.boundingBox(),
      bar.boundingBox(),
      Promise.resolve(page.viewportSize()),
    ])
    if (!box || !viewport) return

    const top = previewBox ? previewBox.y + previewBox.height : 0
    const bottom = barBox ? barBox.y : viewport.height
    const clearTop = box.y > top + 4
    const clearBottom = box.y + box.height < bottom - 4
    if (clearTop && clearBottom) return

    const delta = Math.round(box.y + box.height / 2 - (top + bottom) / 2)
    if (delta === 0) return
    await page.mouse.wheel(0, delta)
    // 滚动是异步的，量下一轮之前得让浏览器把这一帧走完
    await page.waitForTimeout(150)
  }
}
