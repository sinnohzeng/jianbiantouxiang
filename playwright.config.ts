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
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        launchOptions: chromiumLaunch,
      },
    },
    {
      name: 'iphone-15',
      use: {
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
