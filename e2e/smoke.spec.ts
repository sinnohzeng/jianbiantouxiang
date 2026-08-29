import { expect, test } from '@playwright/test'

test('首页可以打开并渲染标题', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/渐变头像生成器/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
