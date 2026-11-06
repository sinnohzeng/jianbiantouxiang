/** Generate reproducible review images in a caller-selected scratch directory. */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { Renderer } from './renderer.mjs'
import { logoPng } from './tests/fixtures.mjs'

const directory = path.resolve(process.argv[2] ?? '/tmp/gradient-avatar-review')
await mkdir(directory, { recursive: true })
const svg = await readFile(new URL('./examples/logo.svg', import.meta.url), 'utf8')
const inputLogo = (text) => ({
  mimeType: 'image/svg+xml',
  data: Buffer.from(text).toString('base64'),
})
const cases = [
  [
    'black-transparent',
    { logo: { mimeType: 'image/png', data: logoPng({ transparent: true }).toString('base64') } },
  ],
  [
    'white-transparent',
    {
      logo: {
        mimeType: 'image/png',
        data: logoPng({ white: true, transparent: true }).toString('base64'),
      },
      palette: 'midnight',
    },
  ],
  [
    'black-on-white',
    { logo: { mimeType: 'image/png', data: logoPng().toString('base64') }, style: 'flow' },
  ],
  [
    'white-on-black',
    {
      logo: { mimeType: 'image/png', data: logoPng({ white: true }).toString('base64') },
      style: 'silk',
    },
  ],
  ['svg-logo', { logo: inputLogo(svg), style: 'grain' }],
  [
    'wide-logo',
    {
      logo: inputLogo(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 60"><path d="M10 10H390V50H10Z"/></svg>',
      ),
    },
  ],
  [
    'tall-logo',
    {
      logo: inputLogo(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 400"><path d="M10 10H50V390H10Z"/></svg>',
      ),
    },
  ],
  [
    'long-lines',
    {
      line1: 'Open Source Design Engineering',
      line2: 'DESIGN • BUILD • SHARE',
      logo: inputLogo(svg),
    },
  ],
  ['logo-only', { line1: '', line2: '', logo: inputLogo(svg) }],
  ['logo-one-line', { line1: '研发', line2: '', logo: inputLogo(svg) }],
  ['short-two-lines', { line1: '研发', line2: 'STUDIO' }],
  ['text-only', { line1: '渐变头像', line2: 'Gradient Avatar' }],
  ['second-line-only', { line1: '', line2: '第二行也可独立使用' }],
  ['small-128', { size: 128, logo: inputLogo(svg), line1: '研发', line2: 'STUDIO' }],
]
const renderer = new Renderer(),
  results = [],
  cards = []
try {
  const catalog = await renderer.run(null, { catalog: true })
  const dark = catalog.palettes.find((p) => p.tone === 'dark').id
  for (const [name, patch] of cases) {
    if (patch.palette === 'midnight') patch.palette = dark
    const request = { line1: '产品研发', line2: 'Product Studio', size: 512, ...patch }
    const result = await renderer.run(request)
    await writeFile(path.join(directory, name + '.png'), Buffer.from(result.data, 'base64'))
    results.push({ name, ...result.metadata })
    cards.push(
      `<figure><img src="data:${result.mimeType};base64,${result.data}"><figcaption>${name} · ${request.size}px</figcaption><aside>${[24, 32, 48, 64].map((size) => `<span><img style="width:${size}px;height:${size}px;border-radius:50%" src="data:${result.mimeType};base64,${result.data}"><small>${size}px</small></span>`).join('')}</aside></figure>`,
    )
  }
} finally {
  await renderer.close()
}
await writeFile(path.join(directory, 'metadata.json'), JSON.stringify(results, null, 2))
const html = `<!doctype html><meta charset="utf-8"><title>Gradient Avatar CLI/MCP review</title><style>body{margin:0;padding:24px;background:#eee;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(4,256px);gap:20px}figure{margin:0}img{width:256px;height:256px;object-fit:contain}figcaption{padding:8px 0}aside{display:flex;align-items:center;gap:12px}small{display:block;font-size:10px;text-align:center}</style><h1>CLI / MCP · actual output review</h1><main>${cards.join('')}</main>`
await writeFile(path.join(directory, 'review.html'), html)
const browser = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  chromiumSandbox: process.env.AVATAR_CHROMIUM_SANDBOX !== '0',
})
try {
  const page = await browser.newPage({
    viewport: { width: 1140, height: 1000 },
    deviceScaleFactor: 1,
  })
  await page.setContent(html)
  await page.screenshot({ path: path.join(directory, 'contact-sheet.png'), fullPage: true })
} finally {
  await browser.close()
}
console.log(directory)
