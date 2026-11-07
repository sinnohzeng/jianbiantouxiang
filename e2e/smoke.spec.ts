import { expect, test } from '@playwright/test'
import { openApp, probeEncode } from './helpers'

// 界面语言默认跟浏览器走，Playwright 的 chromium 是 en-US，标题会变成英文。
// 用 ?lang= 把语言钉死，断言才跟运行环境无关。
test('首页可以打开并渲染标题', async ({ page }) => {
  await page.goto('/?lang=zh-CN')
  await expect(page).toHaveTitle(/渐变头像/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
              graphic: 0.3,
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
