/* global document */
/** Reproducible web-layout review using actual bundled fonts and production composition.
 * Start npm run dev, then node scripts/review-layout.mjs <output-dir> [origin]. */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const directory = path.resolve(process.argv[2] ?? '/tmp/avatar-layout-review')
const origin = process.argv[3] ?? 'http://127.0.0.1:5173'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  chromiumSandbox: process.env.AVATAR_CHROMIUM_SANDBOX !== '0',
})
try {
  const page = await browser.newPage({
    viewport: { width: 1180, height: 900 },
    deviceScaleFactor: 1,
  })
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  )
  await page.goto(origin)
  const results = await page.evaluate(async () => {
    await import('/node_modules/@fontsource/noto-sans-sc/700.css')
    const { normalizeConfig } = await import('/src/state/config.ts')
    const { layoutText } = await import('/src/text/layout.ts')
    const { composeWith } = await import('/src/export/compose-core.ts')
    const { renderGradient } = await import('/src/engine/render.ts')
    const { drawHighlight } = await import('/src/engine/highlight.ts')
    const { drawText } = await import('/src/text/draw.ts')
    const { drawGraphic } = await import('/src/graphics/draw.ts')
    const { loadGraphic } = await import('/src/graphics/source.ts')
    const results = []
    for (const icon of [false, true])
      for (const text of [
        '研发',
        '研发\nSTUDIO',
        '产品研发\n效率先锋',
        'ABC\nXYZ',
        '产品设计与工程团队\nDesign Engineering',
        '\n第二行',
      ]) {
        const config = normalizeConfig({
          text,
          seed: 'layout-review-v1',
          canvas: { width: 512, height: 512 },
          typography: { color: '#151515' },
          layout: {
            icon: icon ? { source: 'builtin', id: 'hexagon', mono: true } : { source: 'none' },
          },
        })
        await document.fonts.load('700 100px "Noto Sans SC"', text.replace('\n', ''))
        const graphic = await loadGraphic(config.layout.icon)
        const layout = layoutText(config, 512, 512, undefined, graphic)
        const canvas = await composeWith(config, 512, 512, {
          loadFonts: async () => [],
          loadGraphicForConfig: async () => graphic,
          renderGradient,
          drawHighlight,
          layoutText: () => layout,
          drawText,
          drawGraphic,
        })
        const ink = document.createElement('canvas')
        ink.width = ink.height = 512
        const ctx = ink.getContext('2d')
        drawText(ctx, layout, config, '#000')
        if (graphic && layout.graphic) drawGraphic(ctx, graphic, layout.graphic, config, '#000')
        const pixels = ctx.getImageData(0, 0, 512, 512).data
        let clipped = 0,
          inkPixels = 0
        for (let y = 0; y < 512; y++)
          for (let x = 0; x < 512; x++)
            if (pixels[(y * 512 + x) * 4 + 3] > 16) {
              inkPixels++
              if (Math.hypot(x + 0.5 - 256, y + 0.5 - 256) > 256) clipped++
            }
        const bounds = [layout.box, ...(layout.graphic ? [layout.graphic] : [])]
        const top = Math.min(...bounds.map((b) => b.y)),
          bottom = Math.max(...bounds.map((b) => b.y + b.height))
        results.push({
          name: `${icon ? 'logo' : 'text'}-${results.length + 1}`,
          text,
          icon,
          data: canvas.toDataURL(),
          metadata: {
            layout,
            clipped,
            inkPixels,
            centerError: (top + bottom) / 2 - 256,
            displayChecks: [24, 32, 48, 64].map((size) => ({
              size,
              inkHeights: layout.lines.map((l) => ((l.ascent + l.descent) * size) / 512),
            })),
          },
        })
        canvas.width = canvas.height = 1
        graphic?.release?.()
      }
    return results
  })
  const cards = []
  for (const result of results) {
    assert.equal(result.metadata.layout.overflow, false, result.name + ' overflow')
    assert.equal(result.metadata.clipped, 0, result.name + ' clipped pixels')
    assert.ok(Math.abs(result.metadata.centerError) < 1, result.name + ' center')
    await writeFile(
      path.join(directory, result.name + '.png'),
      Buffer.from(result.data.split(',')[1], 'base64'),
    )
    cards.push(
      `<article><strong>${result.name}: ${result.text.replace('\n', ' / ')}</strong><section><img class="large" src="${result.data}"><img class="large circle" src="${result.data}"><aside>${[24, 32, 48, 64].map((size) => `<figure><img class="circle" style="width:${size}px;height:${size}px" src="${result.data}"><figcaption>${size}px</figcaption></figure>`).join('')}</aside></section></article>`,
    )
  }
  await writeFile(
    path.join(directory, 'metadata.json'),
    JSON.stringify(
      results.map(({ name, text, icon, metadata }) => ({ name, text, icon, metadata })),
      null,
      2,
    ),
  )
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:14px sans-serif;background:#eee;color:#111;padding:24px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{background:white;padding:12px}section{display:flex;gap:12px;align-items:center;margin-top:12px}.large{width:160px;height:160px}.circle{border-radius:50%}aside{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:130px}figure{margin:0;text-align:center}figcaption{font-size:10px}</style><h1>网页实际导出 · 方形 / 圆裁 / 24–64 px</h1><p>固定字体与种子；小图按 CSS 真实像素显示，不代表飞书官方规格。</p><main>${cards.join('')}</main>`
  await writeFile(path.join(directory, 'review.html'), html)
  await page.setContent(html)
  await page.screenshot({ path: path.join(directory, 'contact-sheet.png'), fullPage: true })
  console.log(
    JSON.stringify({
      directory,
      cases: results.length,
      maxCenterError: Math.max(...results.map((r) => Math.abs(r.metadata.centerError))),
      clippedPixels: results.reduce((n, r) => n + r.metadata.clipped, 0),
    }),
  )
} finally {
  await browser.close()
}
