import { defineConfig, devices } from '@playwright/test'

// headless chromium 默认没有 GPU，WebGL2 走 swiftshader 软件渲染
const chromiumLaunch = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // 软件渲染下合成 1024 要几秒，默认 30 s 不够
  timeout: 60_000,
  projects: [
    {
      name: 'desktop',
      // smoke 两档都跑，desktop.spec 只属于这一档
      testMatch: /(smoke|desktop)\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        launchOptions: chromiumLaunch,
      },
    },
    {
      name: 'iphone-15',
      testMatch: /(smoke|mobile)\.spec\.ts$/,
      use: {
        // devices['iPhone 15'] 的 defaultBrowserType 是 webkit，必须显式覆盖成 chromium，
        // 否则 swiftshader 启动参数不生效、WebGL2 不可用
        ...devices['iPhone 15'],
        browserName: 'chromium',
        launchOptions: chromiumLaunch,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
