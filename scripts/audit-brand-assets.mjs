/* global document, Image */
import { chromium } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
const outDir = path.resolve(process.argv[2] || '/tmp/avatar-brand-audit')
await mkdir(outDir, { recursive: true })
const list = JSON.parse(await readFile(new URL('./brand-list.json', import.meta.url), 'utf8'))
const b = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  args: ['--no-sandbox'],
})
const p = await b.newPage({ viewport: { width: 1200, height: 1000 } })
await p.goto(process.env.AUDIT_URL || 'http://127.0.0.1:5173')
const out = await p.evaluate(async (brands) => {
  const rows = []
  for (const e of brands) {
    const images = []
    for (const id of [e.id, e.white].filter(Boolean)) {
      const ext = id === e.id && e.file?.endsWith('.png') ? 'png' : 'svg'
      const im = new Image()
      im.src = `/brand/${id}.${ext}`
      try {
        await im.decode()
      } catch {
        images.push({ id, ext, error: 'decode failed' })
        continue
      }
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const x = c.getContext('2d')
      const s = 120 / Math.max(im.width, im.height)
      x.drawImage(
        im,
        (128 - im.width * s) / 2,
        (128 - im.height * s) / 2,
        im.width * s,
        im.height * s,
      )
      const data = x.getImageData(0, 0, 128, 128).data
      let solid = 0,
        white = 0,
        black = 0,
        colored = 0
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3] > 240) {
          solid++
          const rgb = [data[i], data[i + 1], data[i + 2]]
          if (Math.min(...rgb) > 240) white++
          if (Math.max(...rgb) < 15) black++
          if (Math.max(...rgb) - Math.min(...rgb) > 20) colored++
        }
      images.push({ id, ext, width: im.width, height: im.height, solid, white, black, colored })
    }
    rows.push({ ...e, images })
  }
  return rows
}, list.brands)
await p.evaluate((rows) => {
  document.body.innerHTML = ''
  document.head.innerHTML =
    '<style>body{background:#eee;color:#111;font:14px sans-serif;padding:12px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.item{background:white;padding:8px}img{width:74px;height:64px;object-fit:contain;background:#59616c;margin:3px}p{margin:4px}</style>'
  const grid = document.createElement('div')
  grid.className = 'grid'
  for (const r of rows) {
    const item = document.createElement('div')
    item.className = 'item'
    const label = document.createElement('p')
    label.textContent = r.id
    item.append(label)
    for (const image of r.images) {
      const im = document.createElement('img')
      im.src = `/brand/${image.id}.${image.ext}`
      item.append(im)
    }
    grid.append(item)
  }
  document.body.append(grid)
}, out)
await p.waitForFunction(() => [...document.images].every((x) => x.complete))
await p.screenshot({ path: path.join(outDir, 'brand-contact.png'), fullPage: true })
await writeFile(path.join(outDir, 'brand-audit.json'), JSON.stringify(out, null, 2))
console.log({
  entries: out.length,
  files: out.reduce((n, r) => n + r.images.length, 0),
  whiteVariant: out.filter((r) => r.white).map((r) => ({ id: r.id, ...r.images[1] })),
})
await b.close()

if (out.some((row) => row.images.some((image) => image.error))) process.exitCode = 1
