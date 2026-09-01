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
  // 默认是方形，四角不应再被遮罩清成透明
  expect(stats.opaque).toBe(stats.width * stats.height)
  // 平色的话去重后只有一两个值，这里要的是真渐变
  expect(stats.colors).toBeGreaterThan(16)
})

test('点导出能出 JPG，非空且不超过 1 MB', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()

  const file = await download
  // v4.0 起文件名带秒级时间戳：`文字_宽x高_YYYYMMDD-HHmmss.jpg`
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  // 体积与类型按探针的结果断言：它走的是导出同一条 composeAvatar + encodeCanvas
  const encoded = await probeEncode(page)
  expect(encoded.type).toBe('image/jpeg')
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.bytes).toBeLessThanOrEqual(1024 * 1024)
  expect(encoded.hitTarget).toBe(true)

  // 导出后历史条应该拿到一张真实缩略图，而不是只靠配色近似
  await expect(page.locator('[data-slot="history-strip"] img')).toBeVisible({
    timeout: PROBE_TIMEOUT_MS,
  })
})

test('导出抽屉能把 PNG 复制到剪贴板', async ({ context, page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)

  await page.locator('[data-slot="export-options"]').click()
  await page.locator('[data-slot="export-copy"]').click()

  await expect(page.locator('[data-slot="export-notice"]')).toHaveText('图片已复制', {
    timeout: PROBE_TIMEOUT_MS,
  })
  const copied = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read()
    if (!item || !item.types.includes('image/png')) return false
    const blob = await item.getType('image/png')
    return blob.size > 0
  })
  expect(copied).toBe(true)
})

test('改文字后复制的链接在新页面打开，文字一致', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)

  await page.locator('#avatar-text-first').fill('链接往返')
  await page.locator('[data-slot="copy-link-action"]').click()

  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('#')

  const opened = await context.newPage()
  await opened.goto(shared)
  await expect(opened.locator('#avatar-text-first')).toHaveValue('链接往返')
  await opened.close()
})

test('改文字后可以用键盘撤销与重做', async ({ page }) => {
  await openApp(page)

  const firstLine = page.locator('#avatar-text-first')
  await firstLine.fill('撤销往返')
  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(firstLine).toHaveValue('飞书')
  await expect(page.locator('#avatar-text-second')).toHaveValue('效率先锋')

  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(firstLine).toHaveValue('撤销往返')
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

test('常驻操作条：两个随机一级按钮与文字快捷入口', async ({ page }) => {
  await openApp(page)

  // 三个高频动作都在一级，不再有下拉二级
  await expect(page.locator('[data-slot="shuffle-color"]')).toBeVisible()
  await expect(page.locator('[data-slot="shuffle-all"]')).toBeVisible()

  const hashBefore = await page.evaluate(() => window.location.hash)
  await page.locator('[data-slot="shuffle-color"]').click()
  await expect
    .poll(() => page.evaluate(() => window.location.hash), { timeout: 5000 })
    .not.toBe(hashBefore)

  // 文字入口一步切到文字页签并聚焦第一行
  await page.locator('[data-slot="edit-text"]').click()
  await expect(page.locator('#avatar-text-first')).toBeFocused({ timeout: 5000 })
})

test('图标徽章能选内置棕榈图标并导出', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="text-icon-switch"]').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('图标徽章能用中文搜到棕榈 emoji 并导出', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="text-icon-switch"]').click()
  await page.locator('label:has(input[data-group="icon-source"][value="emoji"])').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('上传的 SVG 会进入本次会话并用于导出', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="text-icon-switch"]').click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'team.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><script>alert(2)</script><path d="M20 20h60v60h-60z" fill="#3730c3"/></svg>',
    ),
  })
  await expect(page.locator('[data-slot="graphic-picker"]')).toContainText('upload-')
  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('关于对话框展示版本号，恢复默认回到默认档', async ({ page }) => {
  await openApp(page)

  await page.locator('#avatar-text-first').fill('重置演练')
  await page.locator('[data-slot="about-action"]').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/版本 \d+\.\d+\.\d+/)).toBeVisible()

  await page.locator('[data-slot="reset-action"]').click()
  await expect(dialog).toBeHidden()
  // 重置回到默认档，示例文字重新跟随界面语言
  await expect(page.locator('#avatar-text-first')).toHaveValue('飞书')
  await expect(page.locator('#avatar-text-second')).toHaveValue('效率先锋')
})

test('环境光滑杆调低后刷新仍在', async ({ page }) => {
  await openApp(page)

  await page.getByRole('button', { name: '主题' }).click()
  const slider = page.locator('[data-slot="ambient-slider"]').getByRole('slider')
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveAttribute('aria-valuenow', '0')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: '主题' }).click()
  await expect(page.locator('[data-slot="ambient-slider"]').getByRole('slider')).toHaveAttribute(
    'aria-valuenow',
    '0',
  )
})
