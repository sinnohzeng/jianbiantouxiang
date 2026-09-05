/**
 * 微信内置浏览器：a[download] 被拦，长按只认 http(s) 与 data: 地址。
 * 这里用 MicroMessenger UA 走一遍，盯的是导出结果是 data:image/jpeg 的 img，且格式选择不出现。
 */

import { expect, test } from '@playwright/test'
import { PROBE_TIMEOUT_MS, openApp } from './helpers'

test.use({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003131) NetType/WIFI Language/zh_CN',
})

test('微信里导出画成 data URL 的 JPG 图片供长按保存', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  // 主按钮在微信里只开抽屉，不触发下载
  await page.locator('[data-slot="export-action"]').click()
  const drawer = page.locator('[data-slot="drawer-popup"]')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('input[data-group="export-format"]')).toHaveCount(0)

  await drawer.locator('[data-slot="export-run"]').click()
  const image = drawer.locator('[data-slot="export-image"]')
  await expect(image).toBeVisible({ timeout: 30_000 })
  const src = await image.getAttribute('src')
  expect(src?.startsWith('data:image/jpeg;base64,')).toBe(true)
  expect((src ?? '').length).toBeGreaterThan(10_000)
  await expect(drawer.locator('[data-slot="export-notice"]')).toContainText('长按')
})
