/** 启动 npm run dev 后运行；输出实际背景对比和深浅字、圆裁样张。 */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
const ids = process.env.PALETTE_IDS?.split(',') || [
  'supabase-green',
  'fluent-spark',
  'fluent-indigo',
]
const out = process.argv[2] || '/tmp/avatar-source-palettes'
await fs.mkdir(out, { recursive: true })
const b = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:5173')
  const result = await p.evaluate(async (ids) => {
    const { normalizeConfig } = await import('/src/state/config.ts')
    const { composeAvatar } = await import('/src/export/compose.ts')
    const { renderGradient } = await import('/src/engine/render.ts')
    const { drawHighlight } = await import('/src/engine/highlight.ts')
    const { resolveSeed } = await import('/src/engine/seed.ts')
    const { getPalette } = await import('/src/palettes/palettes.ts')
    const { loadFontsForConfig } = await import('/src/fonts/loader.ts')
    const rows = [],
      samples = []
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((x) => x / 255)
        .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
        .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0)
    const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    for (const id of ids) {
      const palette = getPalette(id),
        ink = lum(
          palette.text
            .slice(1)
            .match(/../g)
            .map((x) => parseInt(x, 16)),
        )
      for (const style of ['mesh', 'flow', 'silk', 'grain'])
        for (let seed = 0; seed < 3; seed++) {
          const c = normalizeConfig({
            palette: id,
            style,
            seed: 'source-' + seed,
            text: '',
            layout: { icon: { source: 'none', id: '' } },
          })
          let fallback = null
          const canvas = await renderGradient(c, 256, 256, {
            onFallback: (reason) => {
              fallback = reason
            },
          })
          if (fallback) throw new Error(id + '/' + style + ': shader fallback ' + fallback)
          drawHighlight(canvas.getContext('2d'), 256, 256, c.highlight, resolveSeed(c))
          const pixels = canvas.getContext('2d').getImageData(0, 0, 256, 256).data
          let worst = Infinity
          for (let i = 0; i < pixels.length; i += 4)
            worst = Math.min(worst, contrast(ink, lum(pixels.subarray(i, i + 3))))
          rows.push({ id, style, seed, worst, renderer: 'webgl2', highlight: c.highlight })
          canvas.width = canvas.height = 1
        }
      for (const color of ['#141413', '#FFFFFF']) {
        const c = normalizeConfig({
          palette: id,
          seed: 'source-1',
          text: '工作新习惯\n你说豆包干',
          typography: { color },
        })
        await loadFontsForConfig(c)
        const canvas = await composeAvatar(c, 512, 512)
        samples.push({ id, color, recommended: color === palette.text, data: canvas.toDataURL() })
        canvas.width = canvas.height = 1
      }
    }
    return { rows, samples }
  }, ids)
  for (const s of result.samples) {
    s.file = s.id + (s.color === '#FFFFFF' ? '-white' : '-dark') + '.png'
    await fs.writeFile(out + '/' + s.file, Buffer.from(s.data.split(',')[1], 'base64'))
    delete s.data
  }
  await fs.writeFile(out + '/metrics.json', JSON.stringify(result, null, 2))
  await fs.writeFile(
    out + '/review.html',
    '<body style="background:#eee;font:16px sans-serif;margin:20px"><h1>来源配色：深字 / 白字</h1>' +
      ids
        .map(
          (id) =>
            '<h2>' +
            id +
            '</h2><div style="display:flex;gap:24px">' +
            result.samples
              .filter((s) => s.id === id)
              .map(
                (s) =>
                  '<div><p>' +
                  s.color +
                  (s.recommended ? ' · 推荐' : ' · 对照') +
                  '</p><img width="256" src="' +
                  s.file +
                  '"><div style="display:flex;align-items:center;gap:16px;margin-top:10px">' +
                  [32, 48, 64]
                    .map(
                      (size) =>
                        '<img width="' + size + '" style="border-radius:50%" src="' + s.file + '">',
                    )
                    .join('') +
                  '</div></div>',
              )
              .join('') +
            '</div>',
        )
        .join(''),
  )
  await p.setViewportSize({ width: 620, height: 900 })
  let review = await fs.readFile(out + '/review.html', 'utf8')
  for (const sample of result.samples) {
    const data = await fs.readFile(out + '/' + sample.file, 'base64')
    review = review.replaceAll(
      'src="' + sample.file + '"',
      'src="data:image/png;base64,' + data + '"',
    )
  }
  await p.setContent(review)
  await p.screenshot({ path: out + '/review.png', fullPage: true })
  console.log(result.rows)
  if (result.rows.some((r) => r.worst < 4.5)) throw new Error('推荐文字对实际背景的对比度低于 4.5')
} finally {
  await b.close()
}
