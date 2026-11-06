/* global document, Image */
/** Measure visible white ink on dark backgrounds in optical-review outputs. Not a beauty score. */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const dir = resolve(process.argv[2] || '/tmp/avatar-optical-review')
const records = JSON.parse(await readFile(resolve(dir, 'metadata.json'), 'utf8'))
const browser = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  chromiumSandbox: process.env.AVATAR_CHROMIUM_SANDBOX !== '0',
})
try {
  const page = await browser.newPage()
  const results = []
  for (const record of records) {
    if (!/^[a-z0-9-]+-optical$/.test(record.name) || !record.logoBounds) continue
    const data = (await readFile(resolve(dir, record.name + '.png'))).toString('base64')
    const measured = await page.evaluate(
      async ({ data, record }) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + data
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = record.size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const frames = [record.logoBounds, ...record.lines.map((l) => l.bounds)]
        const ink = frames.map((b) => {
          let top = Infinity,
            bottom = -Infinity
          for (
            let y = Math.max(0, Math.floor(b.y));
            y < Math.min(canvas.height, Math.ceil(b.y + b.height));
            y++
          )
            for (
              let x = Math.max(0, Math.floor(b.x));
              x < Math.min(canvas.width, Math.ceil(b.x + b.width));
              x++
            ) {
              const i = (y * canvas.width + x) * 4
              if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 220) {
                top = Math.min(top, y)
                bottom = Math.max(bottom, y + 1)
              }
            }
          if (!Number.isFinite(top))
            throw new Error(
              'No white ink; this diagnostic requires a dark background and white foreground',
            )
          return { top, bottom }
        })
        return {
          inkGaps: ink.slice(1).map((b, i) => b.top - ink[i].bottom),
          groupTop: ink[0].top,
          groupBottom: ink.at(-1).bottom,
        }
      },
      { data, record },
    )
    results.push({
      name: record.name,
      size: record.size,
      font: record.font,
      fontSizes: record.lines.map((l) => l.fontSize),
      ...measured,
      overflow: record.overflow,
    })
  }
  await writeFile(resolve(dir, 'spacing-measurements.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
