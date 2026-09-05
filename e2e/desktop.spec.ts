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

  // 连点防护：点击后按钮立即禁用，loading 至少 600ms 可见
  await expect(page.locator('[data-slot="export-action"]')).toBeDisabled()

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

test('改文字后刷新页面，文字从本机存档恢复，地址栏不带配置', async ({ page }) => {
  await openApp(page)

  await page.locator('#avatar-text-first').fill('存档往返')
  // 存档是 300 ms 防抖写入，等它落地再刷新
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('gradient-avatar:v3') ?? ''), {
      timeout: 5000,
    })
    .toContain('存档往返')
  expect(await page.evaluate(() => window.location.hash)).toBe('')

  await page.reload()
  await expect(page.locator('#avatar-text-first')).toHaveValue('存档往返')
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

test('三列工作台：挑选栏、预览、检查器带常驻，没有页签', async ({ page }) => {
  await openApp(page)

  // v5 起页签与手风琴全部取消，五节卡片与检查器带一屏之内都在
  await expect(page.locator('[role="tablist"]')).toHaveCount(0)
  await expect(page.locator('[data-slot="pick-column"]')).toBeVisible()
  await expect(page.locator('[data-slot="inspector"]')).toBeVisible()
  await expect(page.locator('[data-slot="bottom-bar"]')).toBeVisible()

  // 检查器带每一行都有常驻数字框，数量与滑杆一致
  const sliders = await page.locator('[data-slot="inspector"] input[type="range"]').count()
  expect(sliders).toBeGreaterThan(6)
  await expect(page.locator('[data-slot="inspector"] [data-slot="slider-number"]')).toHaveCount(
    sliders,
  )
})

test('配色节的随机主按钮换种子', async ({ page }) => {
  await openApp(page)

  const readSeed = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem('gradient-avatar:v3')
      if (!raw) return null
      return (JSON.parse(raw) as { config: { seed: string } }).config.seed
    })
  const before = await readSeed()
  await page.locator('[data-slot="palette-shuffle"]').click()
  await expect.poll(readSeed, { timeout: 5000 }).not.toBe(before)
})

test('检查器带：改过的参数出现重置钮，点一下回默认', async ({ page }) => {
  await openApp(page)

  // 边距是排版组第四行，默认 15%
  const padding = page.locator('[data-slot="inspector"] input[type="range"]').nth(3)
  await expect(padding).toHaveValue('0.15')
  await padding.focus()
  await page.keyboard.press('ArrowRight')
  await expect(padding).toHaveValue('0.155')

  const reset = page.locator('[data-slot="inspector"] [data-slot="slider-reset"]')
  await expect(reset).toHaveCount(1)
  await reset.click()
  await expect(padding).toHaveValue('0.15')
  await expect(page.locator('[data-slot="inspector"] [data-slot="slider-reset"]')).toHaveCount(0)
})

test('常驻操作条：两个随机一级按钮与文字快捷入口', async ({ page }) => {
  await openApp(page)

  // 三个高频动作都在一级，不再有下拉二级
  await expect(page.locator('[data-slot="shuffle-color"]')).toBeVisible()
  await expect(page.locator('[data-slot="shuffle-all"]')).toBeVisible()

  // 随机颜色只换种子；比较存档里的 seed 字段，而不是「存档有没有写过」
  const readSeed = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem('gradient-avatar:v3')
      if (!raw) return null
      return (JSON.parse(raw) as { config: { seed: string } }).config.seed
    })
  const seedBefore = await readSeed()
  await page.locator('[data-slot="shuffle-color"]').click()
  await expect.poll(readSeed, { timeout: 5000 }).not.toBe(seedBefore)
  expect(await readSeed()).toBeTruthy()

  // 文字入口一步聚焦第一行
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

test('图标徽章能在品牌页搜到 GitHub 并导出', async ({ page }) => {
  test.setTimeout(PROBE_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="text-icon-switch"]').click()
  await page.locator('label:has(input[data-group="icon-source"][value="brand"])').click()
  await page.locator('[data-slot="command-input"]').fill('GitHub')
  // 名字精确匹配，免得选中同样命中的 GitHub Copilot
  await page.getByRole('option', { name: 'GitHub', exact: true }).click()

  // 默认单白变体，GitHub 有纯白件，存档里落的是 github-light
  const readIcon = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem('gradient-avatar:v3')
      if (!raw) return null
      return (
        JSON.parse(raw) as {
          config: { layout: { icon: { source: string; id: string } } }
        }
      ).config.layout.icon
    })
  await expect.poll(async () => (await readIcon())?.source, { timeout: 5000 }).toBe('brand')
  expect((await readIcon())?.id).toBe('github-light')

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

test('网格参考线打开后刷新仍开，且不进导出画布', async ({ page }) => {
  await openApp(page)

  const toggle = page.locator('[data-slot="grid-toggle"]')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-slot="preview-grid"]')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-slot="preview-grid"]')).toHaveCount(1)
  // 网格是 DOM 图层，不进着色器宿主，那里仍只有一张画布
  await expect(page.locator('[data-slot="preview-shader"] canvas')).toHaveCount(1)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('[data-slot="grid-toggle"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-slot="preview-grid"]')).toHaveCount(1)
})

test('字号滑杆默认自动，拖动后切手动且数值连续', async ({ page }) => {
  await openApp(page)

  const auto = page.locator('[data-slot="slider-auto"]')
  await expect(auto).toHaveAttribute('aria-pressed', 'true')

  // 自动态滑杆显示预览回写的求解值，得等首帧排版完成；
  // 网络字体到货会再排一次，值可能再变一档，所以等它连续两次读数相同再取基线
  const slider = page.locator('input[type="range"]').first()
  await expect.poll(() => slider.inputValue(), { timeout: 5000 }).not.toBe('0.42')
  await expect
    .poll(
      async () => {
        const first = await slider.inputValue()
        await page.waitForTimeout(400)
        return first === (await slider.inputValue())
      },
      { timeout: 15000 },
    )
    .toBe(true)
  const before = Number(await slider.inputValue())
  expect(before).toBeGreaterThan(0.04)

  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(auto).toHaveAttribute('aria-pressed', 'false')
  const after = Number(await slider.inputValue())
  expect(after).toBeCloseTo(before + 0.005, 3)

  await auto.click()
  await expect(auto).toHaveAttribute('aria-pressed', 'true')
})
