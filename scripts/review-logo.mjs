/* global document, Image */
import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const input = process.argv[2]
if (!input)
  throw new Error('Usage: node scripts/review-logo.mjs logo.png|logo.svg output-dir [dev-origin]')
const dir = process.argv[3] ?? '/tmp/avatar-logo-review'
await mkdir(dir, { recursive: true })
const raw = (await readFile(input)).toString('base64')
const mime = input.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png'
const b = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  chromiumSandbox: process.env.AVATAR_CHROMIUM_SANDBOX !== '0',
})
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.goto(process.argv[4] ?? 'http://127.0.0.1:5173')
const results = await p.evaluate(
  async ({ raw, mime }) => {
    await import('/node_modules/@fontsource/noto-sans-sc/700.css')
    const { normalizeConfig } = await import('/src/state/config.ts')
    const { layoutText } = await import('/src/text/layout.ts')
    const { registerUploadedGraphic, getUploadedGraphic } = await import('/src/graphics/upload.ts')
    const { drawText } = await import('/src/text/draw.ts')
    const { drawGraphic } = await import('/src/graphics/draw.ts')
    const { composeWith } = await import('/src/export/compose-core.ts')
    const { renderGradient } = await import('/src/engine/render.ts')
    const { drawHighlight } = await import('/src/engine/highlight.ts')
    const source = await new Promise((resolve) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.src = 'data:' + mime + ';base64,' + raw
    })
    const out = []
    for (const variant of ['original-black', 'derived-white', 'derived-opaque']) {
      const c = document.createElement('canvas')
      c.width = source.naturalWidth
      c.height = source.naturalHeight
      const ctx = c.getContext('2d')
      if (variant === 'derived-opaque') {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, c.width, c.height)
      }
      ctx.drawImage(source, 0, 0)
      if (variant === 'derived-white') {
        ctx.globalCompositeOperation = 'source-in'
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, c.width, c.height)
      }
      const data = variant === 'original-black' ? 'data:' + mime + ';base64,' + raw : c.toDataURL()
      const blob = await (await fetch(data)).blob()
      const uploaded = await registerUploadedGraphic(
        new File(
          [blob],
          'logo-' +
            variant +
            (variant === 'original-black' && mime === 'image/svg+xml' ? '.svg' : '.png'),
          { type: variant === 'original-black' ? mime : 'image/png' },
        ),
      )
      const graphic = getUploadedGraphic(uploaded.id)
      for (const text of ['飞书对接', '飞书对接\n外部群']) {
        await document.fonts.load('700 100px "Noto Sans SC"', text.replace('\n', ''))
        const config = normalizeConfig({
          text,
          canvas: { width: 512, height: 512 },
          palette: variant === 'derived-white' ? 'forest-night' : 'aurora',
          seed: 'harmay-official-review',
          typography: { color: variant === 'derived-white' ? '#fff' : '#141413', effect: 'plain' },
          layout: { icon: { source: 'upload', id: uploaded.id, mono: false } },
        })
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
        const x = ink.getContext('2d')
        drawText(x, layout, config, '#000')
        drawGraphic(x, graphic, layout.graphic, config, '#000')
        const px = x.getImageData(0, 0, 512, 512).data
        let clipped = 0
        for (let y = 0; y < 512; y++)
          for (let xx = 0; xx < 512; xx++)
            if (px[(y * 512 + xx) * 4 + 3] > 16 && Math.hypot(xx + 0.5 - 256, y + 0.5 - 256) > 256)
              clipped++
        out.push({
          name: variant + '-' + (text.includes('\n') ? 'two' : 'one'),
          variant,
          text,
          source: data,
          image: canvas.toDataURL(),
          graphic: { width: graphic.width, height: graphic.height, sourceRect: graphic.sourceRect },
          layout,
          clipped,
        })
      }
    }
    return out
  },
  { raw, mime },
)
for (const r of results) {
  await writeFile(dir + '/' + r.name + '.png', Buffer.from(r.image.split(',')[1], 'base64'))
  await writeFile(
    dir +
      '/' +
      r.variant +
      '-input' +
      (r.variant === 'original-black' && mime === 'image/svg+xml' ? '.svg' : '.png'),
    Buffer.from(r.source.split(',')[1], 'base64'),
  )
}
await writeFile(
  dir + '/metadata.json',
  JSON.stringify(
    results.map(({ name, variant, text, graphic, layout, clipped }) => ({
      name,
      variant,
      text,
      graphic,
      layout,
      clipped,
    })),
    null,
    2,
  ),
)
const html = `<meta charset=utf-8><style>body{font:16px sans-serif;background:#eee;padding:20px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{background:white;padding:16px}section{display:flex;align-items:center;gap:12px}img{border-radius:50%;width:180px;height:180px}aside{display:flex;gap:8px;align-items:center}small{font-size:12px}</style><h1>输入 Logo · 网页上传与实际合成</h1><p>原始黑字；由原图生成白字、白底测试变体。1/2 行文字。原稿保留文件格式，变体为派生 PNG。未在飞书客户端重新上传。</p><main>${results.map((r) => `<article><strong>${r.name}</strong><section><img src="${r.image}"><aside>${[24, 32, 48, 64].map((n) => `<div><img style="width:${n}px;height:${n}px" src="${r.image}"><small>${n}px</small></div>`).join('')}</aside></section></article>`).join('')}</main>`
await writeFile(dir + '/review.html', html)
await p.setContent(html)
await p.screenshot({ path: dir + '/contact-sheet.png', fullPage: true })
console.log(
  JSON.stringify(
    results.map((r) => ({
      name: r.name,
      source: r.graphic,
      logo: r.layout.graphic,
      lines: r.layout.lines.map((l) => ({
        text: l.text,
        w: l.width / 512,
        h: (l.ascent + l.descent) / 512,
      })),
      overflow: r.layout.overflow,
      clipped: r.clipped,
    })),
  ),
)
await b.close()
