import { expect, test } from '@playwright/test'
import { openApp, probeEncode, probeFlush, probeInk } from './helpers'

// 界面语言默认跟浏览器走，Playwright 的 chromium 是 en-US，标题会变成英文。
// 用 ?lang= 把语言钉死，断言才跟运行环境无关。
test('首页可以打开并渲染标题', async ({ page }) => {
  await page.goto('/?lang=zh-CN')
  await expect(page).toHaveTitle(/渐变头像/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#avatar-text-first')).toHaveValue('工作新习惯')
  await expect(page.locator('#avatar-text-second')).toHaveValue('你说豆包干')
})

test.describe('禁用 JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('页面给出双语提示而不是空白', async ({ page }) => {
    await page.goto('/?lang=zh-CN')
    // 禁用 JS 后 Playwright 的文本选择引擎注入不进去，只能走 CSS 定位器。
    const notice = page.locator('noscript p')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('这个工具需要在浏览器里运行 JavaScript。')
    await expect(notice).toContainText('JavaScript is required to run this tool.')
  })
})

for (const offsetY of [-0.1, 0.3]) {
  test(`最终图文边界提示：主行位移 ${offsetY}`, async ({ page }) => {
    await page.addInitScript((offset) => {
      localStorage.setItem(
        'gradient-avatar:v4',
        JSON.stringify({
          config: {
            text: '大讲堂\n内部群',
            canvas: { shape: 'square' },
            layout: {
              icon: { source: 'brand', id: 'dongli-symbol-white', mono: false },
              graphic: 0.45,
            },
            typography: {
              padding: 0.06,
              optical: false,
              line1: { size: 0.25, offsetY: offset },
              line2: { size: 0.11 },
            },
          },
        }),
      )
    }, offsetY)
    await openApp(page)
    await probeEncode(page, 192)
    const warning = page.getByText('内容超出安全区', { exact: true })
    if (offsetY < 0) {
      await expect(warning).toHaveCount(0)
      const spare = await page.locator('[data-slot="slider-number"]').evaluateAll((inputs) => {
        const input = inputs.find(
          (el) => (el as HTMLInputElement).value === '-10.00%',
        ) as HTMLInputElement
        if (!input) throw new Error('负位移数值未显示')
        const style = getComputedStyle(input)
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        return (
          input.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight) -
          ctx.measureText(input.value).width
        )
      })
      expect(spare).toBeGreaterThanOrEqual(0)
    } else await expect(warning).toBeVisible()
  })
}

// 两行整组按可见墨迹居中：字重分布再不均，也不按质心把整组挪离中心
for (const text of ['飞书\n效率先锋', '研发\nSTUDIO', '工作新习惯\n你说豆包干']) {
  test(`无图标两行整组上下居中：${text.replace('\n', ' / ')}`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem(
        'gradient-avatar:v4',
        JSON.stringify({ config: { text: value, layout: { icon: { source: 'none' } } } }),
      )
    }, text)
    await openApp(page)
    const size = 512
    const ink = await probeInk(page, size)
    expect(ink).not.toBeNull()
    const centre = ink!.y + ink!.height / 2
    expect(Math.abs(centre - size / 2)).toBeLessThanOrEqual(size * 0.005)
  })
}

test('设置内简介新标签打开，保留编辑状态', async ({ page }) => {
  await openApp(page)
  await page.locator('#avatar-text-first').fill('保留我的编辑')
  await expect(page.locator('[data-slot="about-action"]')).toHaveCount(0)
  await page.locator('[data-slot="settings-menu"]').click()
  const link = page.locator('[data-slot="about-action"]')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await link.focus()
  const opened = page.waitForEvent('popup')
  await page.keyboard.press('Enter')
  const about = await opened
  await expect(about).toHaveURL(/\/about$/)
  await expect(about.locator('[data-slot="app-version"]')).toHaveText(/\d+\.\d+\.\d+/)
  await expect(page.locator('#avatar-text-first')).toHaveValue('保留我的编辑')
  expect(await about.evaluate(() => window.opener === null)).toBe(true)
  await about.close()
})

test('英文单行可见笔画边界不把绘制起点当作左边界', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'gradient-avatar:v4',
      JSON.stringify({
        config: {
          text: 'Hello',
          typography: { line1: { font: { family: 'Arial', source: 'system', weight: 700 } } },
        },
      }),
    )
  })
  await openApp(page)
  await probeEncode(page, 192)
  await expect(page.getByText('内容超出安全区', { exact: true })).toHaveCount(0)
})

test('冷启动导出外壳立即入场，内容慢加载不阻断动画', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/ExportControls-*.js', async (route) => {
    await pending
    await route.continue()
  })
  await openApp(page)
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const popup = document.querySelector('[data-slot="drawer-popup"]')
      if (popup?.hasAttribute('data-starting-style')) {
        document.documentElement.dataset.drawerStarted = 'true'
        observer.disconnect()
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
  })
  try {
    await page.locator('[data-slot="export-options"]').click()
    const popup = page.locator('[data-slot="drawer-popup"]')
    await expect(popup).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-drawer-started', 'true')
    await expect(popup.getByRole('status')).toBeVisible()
    await expect
      .poll(() => popup.evaluate((el) => getComputedStyle(el).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
    release()
    await expect(popup.getByRole('button', { name: '4096', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await page.locator('[data-slot="export-options"]').click()
    await expect(popup.getByRole('button', { name: '4096', exact: true })).toBeVisible()
  } finally {
    release()
  }
})

test('减少动态效果时导出设置仍可首次打开和关闭', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApp(page)
  await page.locator('[data-slot="export-options"]').click()
  const popup = page.locator('[data-slot="drawer-popup"]')
  await expect(popup.getByRole('button', { name: '4096', exact: true })).toBeVisible()
  const duration = await popup.evaluate((el) =>
    Math.max(...getComputedStyle(el).transitionDuration.split(',').map(parseFloat)),
  )
  expect(duration).toBeLessThanOrEqual(0.001)
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()
})

test('字节品牌紧随客户素材，选择原稿后刷新保留', async ({ page }) => {
  await openApp(page)
  await page.locator('[data-slot="graphic-picker"]').click()
  const groups = page.locator('[cmdk-group-heading]')
  await expect(groups.nth(0)).toHaveText('客户品牌')
  await expect(groups.nth(1)).toHaveText('字节跳动')
  const entries = page.locator('[cmdk-group]').nth(1).getByRole('option')
  await expect(entries.nth(0)).toContainText('豆包工作')
  await expect(entries.nth(3)).toContainText('飞书')
  await expect(entries.nth(7)).toContainText('豆包')
  await page.getByRole('option', { name: '飞书 · 纯白组合', exact: true }).click()
  await expect(page.locator('[data-slot="graphic-name"]')).toContainText('飞书 · 纯白组合')
  await expect(page.locator('[data-slot="brand-mono"]')).toHaveCount(0)
  await probeFlush(page)
  await page.reload()
  await expect(page.locator('[data-slot="graphic-name"]')).toContainText('飞书 · 纯白组合')
})

test('ISV 分组紧随字节分组，选中后加载原稿并刷新保留', async ({ page }) => {
  await openApp(page)
  await page.locator('[data-slot="graphic-picker"]').click()
  const groups = page.locator('[cmdk-group-heading]')
  await expect(groups.nth(2)).toHaveText('ISV')
  const entries = page.locator('[cmdk-group]').nth(2).getByRole('option')
  await expect(entries).toHaveCount(92)
  const response = page.waitForResponse((r) =>
    r.url().endsWith('/brand/isv-beisen-symbol-color.png'),
  )
  await page.getByRole('option', { name: '北森 · 图标 · 品牌色', exact: true }).click()
  expect((await response).ok()).toBe(true)
  await expect(page.locator('[data-slot="graphic-name"]')).toContainText('北森 · 图标 · 品牌色')
  await expect(page.locator('[data-slot="brand-mono"]')).toHaveCount(0)
  await probeEncode(page, 192)
  await probeFlush(page)
  await page.reload()
  await expect(page.locator('[data-slot="graphic-name"]')).toContainText('北森 · 图标 · 品牌色')
})

for (const [id, asset] of [
  ['doubao-work', 'doubao-work-avatar.png'],
  ['bd-doubao-work-black', 'bd-doubao-work-avatar-black.png'],
  ['lark', 'feishu-symbol-202611.svg'],
] as const) {
  test(`旧品牌配置 ${id} 加载新素材并保留文字`, async ({ page }) => {
    await page.addInitScript((brandId) => {
      localStorage.setItem(
        'gradient-avatar:v4',
        JSON.stringify({
          config: {
            text: '已保存客户\n协作群',
            layout: { icon: { source: 'brand', id: brandId, mono: true }, graphic: 0.37 },
          },
        }),
      )
    }, id)
    const response = page.waitForResponse((r) => r.url().endsWith('/brand/' + asset))
    await openApp(page)
    expect((await response).ok()).toBe(true)
    await expect(page.locator('#avatar-text-first')).toHaveValue('已保存客户')
    await expect(page.locator('[data-slot="brand-mono"]')).toHaveCount(0)
    await probeEncode(page, 192)
    await probeFlush(page)
    await page.reload()
    await expect(page.locator('#avatar-text-second')).toHaveValue('协作群')
    await expect(page.locator('[data-slot="graphic-picker"]')).toContainText(id)
  })
}
