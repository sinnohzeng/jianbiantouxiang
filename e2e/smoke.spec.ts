import { expect, test } from '@playwright/test'

// 界面语言默认跟浏览器走，Playwright 的 chromium 是 en-US，标题会变成英文。
// 用 ?lang= 把语言钉死，断言才跟运行环境无关。
test('首页可以打开并渲染标题', async ({ page }) => {
  await page.goto('/?lang=zh-CN')
  await expect(page).toHaveTitle(/渐变头像生成器/)
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
