/**
 * 两份冒烟共用的动作。文件名不带 .spec，Playwright 不会当用例收。
 *
 * 语言一律用 ?lang=zh-CN 钉死：Playwright 的 chromium 是 en-US，不钉的话断言会跟运行环境走。
 * ?probe=1 挂上 window.__gradientAvatarProbe，见 src/app/probe.ts。
 */

import { expect, type Locator, type Page } from '@playwright/test'
import { CI_FACTOR } from './ci-factor'

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

/** 用例要读的那几位配置。探针返回整份配置，这里只声明断言用得到的字段。 */
export interface ProbeConfig {
  text: string
  seed: string
  style: string
  palette: string
  typography: { line1: { offsetY: number } }
  layout: { icon: { source: string; id: string; mono: boolean } }
}

interface ProbeWindow {
  __gradientAvatarProbe?: {
    stats(size?: number): Promise<ProbePixelStats>
    encode(size?: number): Promise<ProbeEncodeResult>
    config(): ProbeConfig
    flush(): void
  }
}

/** 合成与编码在软件渲染下要跑几秒，探针相关的**断言**统一放宽。 */
export const PROBE_TIMEOUT_MS = 60_000

/** openApp 的余量：goto、探针挂载与进场幕布读秒都落在测试预算里，不占断言那一份。 */
const OPEN_APP_BUDGET_MS = 30_000

/**
 * 探针用例的**测试**预算，给 test.setTimeout 用。
 *
 * 测试超时会直接终止测试，断言拿不满自己那份，报出来的错就变成 Test timeout exceeded，
 * 把真正的失败点盖掉。所以它必须严格大于自己内含的最大断言预算，也就是 PROBE_TIMEOUT_MS：
 * 一条用例最多串两次探针断言，再加一次 openApp 的余量。
 */
export const PROBE_TEST_TIMEOUT_MS = (PROBE_TIMEOUT_MS * 2 + OPEN_APP_BUDGET_MS) * CI_FACTOR

/** expect.poll 等状态落到存档或界面的预算。 */
export const POLL_TIMEOUT_MS = 5_000 * CI_FACTOR

/** 等界面自己稳下来的预算：幕布读完秒、网络字体到货之后重排完成。 */
export const SETTLE_TIMEOUT_MS = 15_000 * CI_FACTOR

/** 等一张图真的算出来的预算：离屏合成加 JPEG 编码，软件渲染下这一步最慢。 */
export const RENDER_TIMEOUT_MS = 30_000 * CI_FACTOR

/**
 * 打开首页并等到界面与探针都就绪。
 *
 * 进场幕布是 z-index 9999 的 fixed 层，读秒期间所有点击都落在幕布上，
 * 所以这里一并等它读完秒；开始抽走之后它就不吃指针事件了，不必等动画放完。
 * 炫技层关掉时它根本不挂，这一步立刻返回。
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto(APP_URL)
  await page.waitForFunction(
    () => (globalThis as unknown as ProbeWindow).__gradientAvatarProbe !== undefined,
  )
  await waitReady(page)
}

/** reload 之后再点界面之前用：等标题与幕布，不然点击会落在幕布上。 */
export async function waitReady(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page
    .locator('[data-slot="preloader"][data-loading="true"]')
    .waitFor({ state: 'detached', timeout: SETTLE_TIMEOUT_MS })
}

/**
 * 展开挑选栏里某个折叠组。slot 见各 section，如 text-group-layout。
 * 折叠组收起时整块不挂，不点开就一条滑杆都点不到。
 */
export async function openGroup(page: Page, slot: string): Promise<void> {
  const trigger = page.locator(`[data-slot="${slot}"] [data-slot="collapsible-trigger"]`)
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
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

/** store 里的当前配置，同步可读，不经存档的防抖。 */
export function probeConfig(page: Page): Promise<ProbeConfig> {
  return page.evaluate(() => (globalThis as unknown as ProbeWindow).__gradientAvatarProbe!.config())
}

/** 把防抖中的配置立刻写进存档，测刷新恢复前调一次。 */
export function probeFlush(page: Page): Promise<void> {
  return page.evaluate(() => (globalThis as unknown as ProbeWindow).__gradientAvatarProbe!.flush())
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
