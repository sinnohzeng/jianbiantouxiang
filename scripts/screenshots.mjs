#!/usr/bin/env node
/**
 * 设备模拟截图工具，供人工与视觉核查智能体使用。
 *
 * 用法：
 *   node scripts/screenshots.mjs                       截 http://localhost:4173
 *   node scripts/screenshots.mjs --url http://x:5173   指定地址
 *   SHOT_URL=http://x:5173 node scripts/screenshots.mjs
 *
 * 输出到 .screenshots/，命名 <设备>-<主题>[-full].png。
 */
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium, devices } from '@playwright/test'

const OUT_DIR = path.resolve(process.cwd(), '.screenshots')
const THEMES = /** @type {const} */ (['dark', 'light'])

const TARGETS = [
  {
    name: 'desktop-1440',
    mobile: false,
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  },
  { name: 'iphone-15', mobile: true, context: devices['iPhone 15'] },
  { name: 'iphone-se', mobile: true, context: devices['iPhone SE'] },
]

function resolveUrl() {
  const flag = process.argv.indexOf('--url')
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1]
  return process.env.SHOT_URL || 'http://localhost:4173'
}

async function main() {
  const url = resolveUrl()
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })

  const written = []
  try {
    for (const target of TARGETS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          ...target.context,
          colorScheme: theme,
          isMobile: target.mobile ? target.context.isMobile : undefined,
        })
        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.waitForTimeout(600)

        const base = `${target.name}-${theme}`
        const shot = path.join(OUT_DIR, `${base}.png`)
        await page.screenshot({ path: shot })
        written.push(shot)

        if (target.mobile) {
          const full = path.join(OUT_DIR, `${base}-full.png`)
          await page.screenshot({ path: full, fullPage: true })
          written.push(full)
        }

        // 导出抽屉的打开态：文案随浏览器语言变，按 data-slot 点更稳
        const exportButton = page.locator('[data-slot="export-action"]')
        if ((await exportButton.count()) > 0) {
          await exportButton.first().click()
          await page.waitForTimeout(600)
          const drawer = path.join(OUT_DIR, `${base}-export.png`)
          await page.screenshot({ path: drawer })
          written.push(drawer)
        }

        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`已截图 ${written.length} 张，输出目录 ${OUT_DIR}`)
  for (const file of written) console.log(`  ${path.relative(process.cwd(), file)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
