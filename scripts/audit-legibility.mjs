/* global document */
/** Production-font/paint audit. Optional private case JSON stays outside the repository.
 * node scripts/audit-legibility.mjs OUTPUT [ORIGIN] [CASES.json] */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
const output = path.resolve(process.argv[2] ?? '/tmp/avatar-legibility')
const origin = process.argv[3] ?? 'http://127.0.0.1:5173'
const cases = process.argv[4]
  ? JSON.parse(await fs.readFile(process.argv[4], 'utf8'))
  : [
      {
        name: 'brand-two',
        text: '品牌讲堂\n东黎羊绒',
        layout: {
          icon: { source: 'brand', id: 'dongli-symbol-white', mono: false },
          graphic: 0.63,
        },
      },
      ...[
        '研发',
        '产品研发\n效率先锋',
        'A',
        'ABC\nxyz',
        'Design Engineering\nProduct Research',
        '产品设计与工程团队\n效率先锋',
        '\n第二行',
      ].flatMap((text, i) =>
        ['none', 'bd-doubao-work-white'].map((id) => ({
          name: `${id}-${i}`,
          text,
          layout: {
            icon: id === 'none' ? { source: 'none' } : { source: 'brand', id, mono: false },
          },
        })),
      ),
      ...['harmay-wordmark-black', 'dongli-wordmark-bilingual-inline-white'].map((id) => ({
        name: id,
        text: '研发\nSTUDIO',
        layout: { icon: { source: 'brand', id, mono: false } },
      })),
    ]
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage()
  await page.goto(origin)
  const results = []
  for (const partial of cases) {
    const row = await page.evaluate(async (partial) => {
      const { normalizeConfig } = await import('/src/state/config.ts')
      const { layoutText } = await import('/src/text/layout.ts')
      const { loadFontsForConfig } = await import('/src/fonts/loader.ts')
      const { loadGraphic } = await import('/src/graphics/source.ts')
      const { drawGraphic } = await import('/src/graphics/draw.ts')
      const { drawText } = await import('/src/text/draw.ts')
      const { alphaBounds } = await import('/src/graphics/trim.ts')
      const { composeAvatar } = await import('/src/export/compose.ts')
      const { automaticGroup } = await import('/src/text/fill.ts')
      const S = 1024
      const config = normalizeConfig({
        ...partial,
        seed: 'legibility-audit',
        canvas: { width: S, height: S, ...partial.canvas },
      })
      const fonts = await loadFontsForConfig(config)
      if (fonts.some((f) => !f.ok || f.via !== 'bundled'))
        throw new Error('Audit requires bundled fonts: ' + JSON.stringify(fonts))
      const graphic = await loadGraphic(config.layout.icon)
      if (config.layout.icon.source !== 'none' && !graphic) throw new Error('Missing graphic')
      const layout = layoutText(config, S, S, undefined, graphic)
      const plain = { ...config, typography: { ...config.typography, effect: 'plain' } }
      const mask = document.createElement('canvas')
      mask.width = mask.height = S
      const ctx = mask.getContext('2d', { willReadFrequently: true })
      const stats = () => {
        const d = ctx.getImageData(0, 0, S, S).data
        let maxRadius = 0,
          clipped = 0,
          unsafe = 0,
          mass = 0
        const radius = S * (0.5 - config.typography.padding)
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            const a = d[(y * S + x) * 4 + 3]
            mass += a / 255
            if (a <= 16) continue
            const r = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2)
            maxRadius = Math.max(maxRadius, r)
            if (r > S / 2) clipped++
            if (r > radius + 1) unsafe++
          }
        return {
          bounds: alphaBounds(d, S, S),
          mass,
          clipped,
          unsafe,
          safeSlack: radius - maxRadius,
        }
      }
      const masks = []
      const lines = layout.lines.map((line) => {
        ctx.clearRect(0, 0, S, S)
        drawText(ctx, { ...layout, lines: [line] }, plain, '#fff')
        const saved = document.createElement('canvas')
        saved.width = saved.height = S
        saved.getContext('2d').drawImage(mask, 0, 0)
        masks.push(saved)
        return stats()
      })
      ctx.clearRect(0, 0, S, S)
      if (graphic && layout.graphic) drawGraphic(ctx, graphic, layout.graphic, plain, '#fff')
      const logo = graphic ? stats() : null
      const canvas = await composeAvatar(config, S, S)
      const images = { full: canvas.toDataURL() }
      const sizes = []
      for (const size of [24, 32, 40, 48, 64]) {
        const small = document.createElement('canvas')
        small.width = small.height = size
        const c = small.getContext('2d')
        c.drawImage(canvas, 0, 0, size, size)
        images[`square-${size}`] = small.toDataURL()
        c.globalCompositeOperation = 'destination-in'
        c.beginPath()
        c.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI)
        c.fill()
        images[`circle-${size}`] = small.toDataURL()
        const ink = lines.map((l) => (l.bounds.height * size) / S)
        const raster = masks.map((m) => {
          c.globalCompositeOperation = 'source-over'
          c.clearRect(0, 0, size, size)
          c.drawImage(m, 0, 0, size, size)
          const data = c.getImageData(0, 0, size, size).data
          let pixels = 0,
            mass = 0
          for (let n = 3; n < data.length; n += 4) {
            if (data[n] > 16) pixels++
            mass += data[n] / 255
          }
          return { bounds: alphaBounds(data, size, size), pixels, mass }
        })
        sizes.push({ size, inkHeights: ink, raster })
      }
      const smallText48 = layout.lines.some((l) => ((l.ascent + l.descent) * 48) / S < 6)
      for (const m of masks) m.width = m.height = 1
      canvas.width = canvas.height = mask.width = mask.height = 1
      if (
        automaticGroup(config) &&
        (layout.overflow ||
          lines.some((l) => l.unsafe || l.clipped) ||
          logo?.unsafe ||
          logo?.clipped)
      )
        throw new Error('Automatic safety violation: ' + partial.name)
      return { name: partial.name, fonts, config, layout, lines, logo, sizes, smallText48, images }
    }, partial)
    const folder = path.join(output, partial.name)
    await fs.mkdir(folder, { recursive: true })
    for (const [name, data] of Object.entries(row.images))
      await fs.writeFile(
        path.join(folder, name + '.png'),
        Buffer.from(data.split(',')[1], 'base64'),
      )
    delete row.images
    results.push(row)
    console.log(
      partial.name,
      row.layout.lines.map((l) => l.fontSizePx.toFixed(2)).join('/'),
      'unsafe',
      row.lines.reduce((n, l) => n + l.unsafe, 0),
      '48px',
      row.smallText48,
    )
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
