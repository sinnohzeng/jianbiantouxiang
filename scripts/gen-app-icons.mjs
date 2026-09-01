/**
 * 从 public/icon.svg 与 public/icon-maskable.svg 位图化出 PWA 图标。
 *
 * 仓库里没有 raster 工具链，借 Playwright 的 chromium 把 SVG 画进 canvas 再导出 PNG：
 * 矢量源改完之后跑一次，三个 PNG 就跟得上。maskable 按 80% 安全区收小图形。
 *
 * 用法：node scripts/gen-app-icons.mjs（需要本机已装 Playwright 浏览器）
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = path.resolve(import.meta.dirname, '..')

const JOBS = [
  { svg: 'public/icon.svg', out: 'public/icon-192.png', size: 192, scale: 1 },
  { svg: 'public/icon.svg', out: 'public/icon-512.png', size: 512, scale: 1 },
  { svg: 'public/icon-maskable.svg', out: 'public/icon-maskable-512.png', size: 512, scale: 0.8 },
]

/**
 * 在浏览器页面里跑：把挂好的 SVG 序列化进 canvas 导出 data URL。
 * 这段的运行环境是 chromium 页面而不是 node，浏览器全局量对 eslint 不可见。
 */
/* eslint-disable no-undef */
async function rasterizeInPage(size) {
  const box = document.getElementById('box')
  const svgEl = box.querySelector('svg')
  svgEl.setAttribute('width', '100%')
  svgEl.setAttribute('height', '100%')
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const xml = new XMLSerializer().serializeToString(svgEl)
  const image = new Image()
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  await image.decode()
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, size, size)
  return canvas.toDataURL('image/png')
}
/* eslint-enable no-undef */

const browser = await chromium.launch()
const page = await browser.newPage()

for (const job of JOBS) {
  const svg = fs.readFileSync(path.join(ROOT, job.svg), 'utf8')
  const inner = Math.round(job.size * job.scale)
  const offset = Math.round((job.size - inner) / 2)
  const html = `<body style="margin:0">
    <div id="box" style="width:${job.size}px;height:${job.size}px;position:relative">
      <div style="position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px">${svg}</div>
    </div>
  </body>`
  await page.setContent(html)
  const dataUrl = await page.evaluate(rasterizeInPage, job.size)
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
  fs.writeFileSync(path.join(ROOT, job.out), buffer)
  console.log(`${job.out} ${buffer.length} bytes`)
}

await browser.close()
