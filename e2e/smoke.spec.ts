import { expect, test } from '@playwright/test'

// 界面语言默认跟浏览器走，Playwright 的 chromium 是 en-US，标题会变成英文。
// 用 ?lang= 把语言钉死，断言才跟运行环境无关。
test('首页可以打开并渲染标题', async ({ page }) => {
  await page.goto('/?lang=zh-CN')
  await expect(page).toHaveTitle(/渐变头像生成器/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
