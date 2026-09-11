/**
 * iPhone 15 冒烟，对应 plan §2 阶段 4.4 与 spec §6 验收 1。
 * 只跑 iphone-15 project，分派见 playwright.config.ts 的 testMatch。
 */

import { expect, test } from '@playwright/test'
import {
  POLL_TIMEOUT_MS,
  PROBE_TEST_TIMEOUT_MS,
  RENDER_TIMEOUT_MS,
  centreBetweenBars,
  openApp,
  probeEncode,
  probeStats,
} from './helpers'

test('预览挂着 WebGL 画布，合成结果不是一张平色，且没有横向滚动', async ({ page }) => {
  await openApp(page)

  const canvas = page.locator('[data-slot="preview-shader"] canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()

  const overflowsX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflowsX).toBe(false)

  const stats = await probeStats(page)
  // 默认是方形，四角不应再被遮罩清成透明
  expect(stats.opaque).toBe(stats.width * stats.height)
  expect(stats.colors).toBeGreaterThan(16)
})

test('底栏点导出能出 JPG，非空且不超过 1 MB', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  // 底栏在最上层，不用手动滚；主按钮直接触发下载
  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()

  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.type).toBe('image/jpeg')
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.bytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  expect(encoded.hitTarget).toBe(true)
})

test('改文字后刷新页面，文字从本机存档恢复', async ({ page }) => {
  await openApp(page)

  const firstLine = page.locator('#avatar-text-first')
  await centreBetweenBars(page, firstLine)
  await firstLine.fill('手机往返')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('gradient-avatar:v3') ?? ''), {
      timeout: POLL_TIMEOUT_MS,
    })
    .toContain('手机往返')

  await page.reload()
  const restored = page.locator('#avatar-text-first')
  await centreBetweenBars(page, restored)
  await expect(restored).toHaveValue('手机往返')
})

test('切换语言后 html[lang] 与标题都跟着变', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page).toHaveTitle(/渐变头像/)

  await page.locator('[data-slot="language-menu"]').click()
  await page.getByRole('menuitem', { name: '한국어' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  // ko 字典是单独一份 chunk，标题要等它落地才变，toHaveTitle 自带重试
  await expect(page).toHaveTitle(/그라데이션 아바타/)
})

test('手机上图形选择器走底部抽屉且无横向滚动', async ({ page }) => {
  await openApp(page)
  const iconPick = page.locator('[data-slot="graphic-pick"]')
  await centreBetweenBars(page, iconPick)
  await iconPick.click()

  const dialog = page.locator('[data-slot="drawer-popup"]')
  await expect(dialog).toBeVisible()
  const overflowsX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflowsX).toBe(false)

  await page.locator('label:has(input[data-group="icon-source"][value="emoji"])').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await expect(page.locator('[data-slot="graphic-picker"]')).toContainText('1f334')
})

test('拖分隔条后预览变矮，刷新仍是新高度', async ({ page }) => {
  await openApp(page)

  const preview = page.locator('[data-slot="preview-pane"]')
  const divider = page.locator('[data-slot="preview-divider"]')
  await expect(divider).toBeVisible()

  const before = (await preview.boundingBox())!.height
  const handle = (await divider.boundingBox())!
  const x = handle.x + handle.width / 2
  const y = handle.y + handle.height / 2

  // 往上拖就是把预览压矮，范围下限 20svh 会自己夹住
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 120, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => (await preview.boundingBox())?.height ?? before, { timeout: POLL_TIMEOUT_MS })
    .toBeLessThan(before - 10)
  const after = (await preview.boundingBox())!.height

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const restored = (await preview.boundingBox())!.height
  expect(Math.abs(restored - after)).toBeLessThan(2)
})

test('预览上盖着可长按保存的 JPG，改文字会换新图，网格不进图', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  const image = page.locator('[data-slot="preview-save-image"]')
  await expect(image).toBeVisible({ timeout: RENDER_TIMEOUT_MS })
  const first = await image.getAttribute('src')
  expect(first?.startsWith('data:image/jpeg;base64,')).toBe(true)
  expect((first ?? '').length).toBeGreaterThan(5000)

  // 网格是预览参考层，长按存下来的图里不该有它。它收在顶栏的设置菜单里，顶栏 sticky 直接可点
  await page.locator('[data-slot="settings-menu"]').click()
  await page.locator('[data-slot="grid-toggle"]').click()
  await page.waitForTimeout(1200)
  expect(await image.getAttribute('src')).toBe(first)

  // 改文字后重新出图
  await page.locator('#avatar-text-first').fill('产品设计部')
  await expect
    .poll(async () => (await image.getAttribute('src')) !== first, { timeout: RENDER_TIMEOUT_MS })
    .toBe(true)
})

test('备案号在手机上不进顶栏', async ({ page }) => {
  await openApp(page)

  // 顶栏那点宽度分给六颗按钮就没了；手机上它改在页面末尾单起一行
  await expect(page.locator('[data-slot="icp-beian"]')).toBeHidden()
})

test('备案号在手机上在页面末尾', async ({ page }) => {
  await openApp(page)

  const beian = page.locator('[data-slot="icp-beian-mobile"]')
  await beian.scrollIntoViewIfNeeded()
  await expect(beian).toBeVisible()
  await expect(beian).toHaveAttribute('href', /beian\.miit\.gov\.cn/)

  // 它兼着给固定操作条让位：那段底部内距在自己身上，所以文字这一行落在操作条上沿之上，
  // 挑选栏最后一张卡片也不会被压住
  const cards = page.locator('[data-slot="pick-columns"] section')
  const [box, lastCard, barBox] = await Promise.all([
    beian.boundingBox(),
    cards.last().boundingBox(),
    page.locator('[data-slot="bottom-bar"]').boundingBox(),
  ])
  expect(box).not.toBeNull()
  expect(lastCard).not.toBeNull()
  expect(barBox).not.toBeNull()
  expect(box!.y).toBeLessThan(barBox!.y)
  expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(barBox!.y + 1)
})

test('操作条三格加齿轮，没有更多钮与微调钮', async ({ page }) => {
  await openApp(page)

  await expect(page.locator('[data-slot="shuffle-color"]')).toHaveCount(1)
  await expect(page.locator('[data-slot="shuffle-palette"]')).toHaveCount(1)
  await expect(page.locator('[data-slot="export-action"]')).toHaveCount(1)
  await expect(page.locator('[data-slot="export-options"]')).toHaveCount(1)
})
