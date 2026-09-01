#!/usr/bin/env node
/**
 * 生成 README 使用的三张样张。
 *
 * 先构建，再起 vite preview，最后打开 ?samples=1 截 #samples。样张页走
 * composeAvatar 真实导出链路，不用 DOM 里的预览画布，避免软件渲染与
 * preserveDrawingBuffer 的差异。
 */
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const OUT_DIR = path.resolve(process.cwd(), 'docs/assets/samples')
const PORT = 4311
const URL = `http://localhost:${PORT}/?samples=1&lang=zh-CN`

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', cwd: process.cwd() })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

async function waitServer() {
  for (let round = 0; round < 60; round += 1) {
    try {
      const response = await fetch(URL, { redirect: 'manual' })
      if (response.ok) return
    } catch {
      // preview 还没起来
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`preview server not ready: ${URL}`)
}

async function main() {
  await run('npm', ['run', 'build'])
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const preview = spawn('npm', ['run', 'preview', '--', '--port', String(PORT)], {
    stdio: 'ignore',
    cwd: process.cwd(),
  })
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  try {
    await waitServer()
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
    await page.goto(URL, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => globalThis.__gradientAvatarSamplesReady === true,
      undefined,
      { timeout: 240_000 },
    )
    const pageRoot = page.locator('#samples')
    await pageRoot.waitFor({ state: 'visible' })

    const children = page.locator('#samples > div')
    await expectLocatorCount(children, 7)
    await children.nth(2).screenshot({ path: path.join(OUT_DIR, 'styles-x-palettes-1.jpg'), type: 'jpeg', quality: 86 })
    await children.nth(4).screenshot({ path: path.join(OUT_DIR, 'styles-x-palettes-2.jpg'), type: 'jpeg', quality: 86 })
    await children.nth(6).screenshot({ path: path.join(OUT_DIR, 'text-effects.jpg'), type: 'jpeg', quality: 86 })
    await page.close()
  } finally {
    await browser.close()
    preview.kill('SIGTERM')
    await new Promise((resolve) => {
      preview.once('exit', resolve)
      preview.once('error', resolve)
      setTimeout(() => {
        preview.kill('SIGKILL')
        resolve()
      }, 3000).unref?.()
    })
  }

  console.log(`已生成 3 张样张，输出目录 ${OUT_DIR}`)
}

async function expectLocatorCount(locator, count) {
  const actual = await locator.count()
  if (actual !== count) throw new Error(`样张结构不对：期望 ${count} 个节点，实际 ${actual}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
