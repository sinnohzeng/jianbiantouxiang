/**
 * iPhone 15 冒烟，对应 plan §2 阶段 4.4 与 spec §6 验收 1。
 * 只跑 iphone-15 project，分派见 playwright.config.ts 的 testMatch。
 */

import { expect, test } from '@playwright/test'
import { PROBE_TIMEOUT_MS, centreBetweenBars, openApp, probeEncode, probeStats } from './helpers'

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
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  // 底栏在最上层，不用手动滚；主按钮直接触发下载
  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()

  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.type).toBe('image/jpeg')
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.bytes).toBeLessThanOrEqual(1024 * 1024)
  expect(encoded.hitTarget).toBe(true)
})

test('改文字后复制的链接在新页面打开，文字一致', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)

  const textarea = page.locator('#avatar-text')
  await centreBetweenBars(page, textarea)
  await textarea.fill('手机往返')

  await page.locator('[data-slot="copy-link-action"]').click()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('#')

  const opened = await context.newPage()
  await opened.goto(shared)
  const restored = opened.locator('#avatar-text')
  await centreBetweenBars(opened, restored)
  await expect(restored).toHaveValue('手机往返')
  await opened.close()
})

test('切换语言后 html[lang] 与标题都跟着变', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page).toHaveTitle(/渐变头像生成器/)

  await page.locator('[data-slot="language-menu"]').click()
  await page.getByRole('menuitem', { name: '한국어' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  // ko 字典是单独一份 chunk，标题要等它落地才变，toHaveTitle 自带重试
  await expect(page).toHaveTitle(/그라데이션 아바타/)
})

test('手机上图形选择器走底部抽屉且无横向滚动', async ({ page }) => {
  await openApp(page)
  const kind = page.locator('label:has(input[data-group="text-kind"][value="logo"])')
  await centreBetweenBars(page, kind)
  await kind.click()

  const picker = page.locator('[data-slot="graphic-picker"]')
  await centreBetweenBars(page, picker)
  await picker.click()

  const dialog = page.locator('[data-slot="drawer-popup"]')
  await expect(dialog).toBeVisible()
  const overflowsX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflowsX).toBe(false)

  await page.locator('label:has(input[data-group="icon-source"][value="emoji"])').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await expect(picker).toContainText('1f334')
})
