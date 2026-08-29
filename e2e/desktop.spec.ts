/**
 * 桌面 1440 冒烟，对应 plan §2 阶段 4.4。
 * 只跑 desktop project，分派见 playwright.config.ts 的 testMatch。
 */

import { expect, test } from '@playwright/test'
import { APP_URL, PROBE_TIMEOUT_MS, openApp, probeEncode, probeStats } from './helpers'

test('预览挂着 WebGL 画布，合成结果不是一张平色', async ({ page }) => {
  await openApp(page)

  const canvas = page.locator('[data-slot="preview-shader"] canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()

  const stats = await probeStats(page)
  // 默认是圆角方形，四角被遮罩清成透明，所以不能按满幅断言
  expect(stats.opaque).toBeGreaterThan(stats.width * stats.height * 0.8)
  // 平色的话去重后只有一两个值，这里要的是真渐变
  expect(stats.colors).toBeGreaterThan(16)
})

test('点导出能出 JPG，非空且不超过 1 MB', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  await page.locator('[data-slot="export-run"]').click()

  await expect(page.locator('[data-slot="export-result"]')).toBeVisible({
    timeout: PROBE_TIMEOUT_MS,
  })
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.jpg$/)

  // 体积与类型按探针的结果断言：它走的是导出同一条 composeAvatar + encodeCanvas
  const encoded = await probeEncode(page)
  expect(encoded.type).toBe('image/jpeg')
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.bytes).toBeLessThanOrEqual(1024 * 1024)
  expect(encoded.hitTarget).toBe(true)
})

test('改文字后复制的链接在新页面打开，文字一致', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)

  await page.locator('#avatar-text').fill('链接往返')
  await page.locator('[data-slot="copy-link-action"]').click()

  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('#')

  const opened = await context.newPage()
  await opened.goto(shared)
  await expect(opened.locator('#avatar-text')).toHaveValue('链接往返')
  await opened.close()
})

test('切换语言后 html[lang] 与标题都跟着变', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page).toHaveTitle(/渐变头像生成器/)

  await page.locator('[data-slot="language-menu"]').click()
  await page.getByRole('menuitem', { name: '日本語' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  // ja 字典是单独一份 chunk，标题要等它落地才变，toHaveTitle 自带重试
  await expect(page).toHaveTitle(/グラデーションアバター/)
})

test('不带 probe 参数时不挂探针', async ({ page }) => {
  await page.goto(APP_URL.replace('probe=1&', ''))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const installed = await page.evaluate(
    () => '__gradientAvatarProbe' in (globalThis as Record<string, unknown>),
  )
  expect(installed).toBe(false)
})
