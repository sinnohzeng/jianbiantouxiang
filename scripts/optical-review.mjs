/** Actual MCP outputs, not a perceptual score. Private logos are optional local inputs. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const dir = resolve(process.argv[2] || '/tmp/avatar-optical-review')
await mkdir(dir, { recursive: true })
const cases = [
  ['text', { line1: '飞书', line2: '效率先锋' }],
  ['counterexample', { line1: '厂', line2: '飞', font: 'serif' }],
  ['dongli-one', { preset: 'dongli-symbol-white', line1: '飞书对接' }],
  ['dongli-two', { preset: 'dongli-symbol-white', line1: '飞书对接', line2: '外部群' }],
  ['dongli-full', { preset: 'dongli-lockup-full-white', line1: '飞书对接', line2: '外部群' }],
  [
    'dongli-inline',
    { preset: 'dongli-wordmark-bilingual-inline-white', line1: '飞书对接', line2: '外部群' },
  ],
]
if (process.argv[3]) {
  const logo = {
    mimeType: 'image/svg+xml',
    data: (await readFile(process.argv[3])).toString('base64'),
  }
  cases.push(
    ['harmay-one', { line1: '飞书对接', logo, font: 'serif' }],
    ['harmay-two', { line1: '飞书对接', line2: '外部群', logo, font: 'serif' }],
  )
}
const client = new Client({ name: 'optical-review', version: '1' })
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['service/cli.mjs', 'mcp'],
  cwd: root,
  env: { ...process.env },
  stderr: 'pipe',
})
const records = [],
  cards = []
try {
  await client.connect(transport)
  for (const [name, body] of cases)
    for (const optical of [false, true]) {
      const id = `${name}-${optical ? 'optical' : 'geometric'}`
      const result = await client.callTool({
        name: 'render_avatar',
        arguments: { ...body, size: 512, seed: 'optical-review', optical },
      })
      if (result.isError) throw new Error(JSON.stringify(result))
      const img = result.content.find((c) => c.type === 'image')
      if (!img) throw new Error(`No image: ${id}`)
      await writeFile(resolve(dir, `${id}.png`), Buffer.from(img.data, 'base64'))
      records.push({ name: id, ...result.structuredContent })
      cards.push(
        `<article><h2>${id}</h2><section><img width="180" height="180" src="${id}.png">${[24, 32, 48, 64].map((n) => `<div><img width="${n}" height="${n}" src="${id}.png"><p>${n}px</p></div>`).join('')}</section></article>`,
      )
      console.log(id)
    }
} finally {
  await client.close()
}
await writeFile(resolve(dir, 'metadata.json'), JSON.stringify(records, null, 2))
await writeFile(
  resolve(dir, 'index.html'),
  `<meta charset="utf-8"><style>body{font:16px sans-serif;background:#eee;padding:24px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}article{background:white;padding:16px}h2{font-size:18px}section{display:flex;align-items:center;gap:16px}img{border-radius:50%}</style><h1>几何基线 / 有界光学补偿</h1><p>真实 MCP 输出；每对左为几何基线，右为光学补偿。非飞书客户端截图。小图按 1:1 查看；指标不代表审美评分。</p><main>${cards.join('')}</main>`,
)
