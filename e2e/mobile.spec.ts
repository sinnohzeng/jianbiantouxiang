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
  expect(stats.opaque).toBeGreaterThan(stats.width * stats.height * 0.8)
  expect(stats.colors).toBeGreaterThan(16)
})

test('底栏点导出能出 JPG，非空且不超过 1 MB', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  // 底栏与抽屉都在最上层，不会被 sticky 预览压住，这两下不用手动滚
  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  await page.locator('[data-slot="export-run"]').click()

  await expect(page.locator('[data-slot="export-result"]')).toBeVisible({
    timeout: PROBE_TIMEOUT_MS,
  })
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
