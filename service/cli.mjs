#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { readFile, writeFile, mkdir, stat, mkdtemp, link, rm } from 'node:fs/promises'
import path from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Renderer } from './renderer.mjs'
import { createAvatarMcp, batchSchema } from './mcp.mjs'
import { createAvatarHttp, httpOptions } from './http.mjs'
import { LOGO_BYTES, renderSchema } from '../src/automation/schema.ts'

const HELP = `Gradient Avatar (Node 24+)
  node service/cli.mjs render --line1 "团队" --line2 "产品研发" --logo logo.svg --out avatar.png
  node service/cli.mjs render --config request.json --out avatar.png
  node service/cli.mjs validate --config request.json
  node service/cli.mjs batch --config batch.json --out-dir ./avatars
  node service/cli.mjs options
  node service/cli.mjs mcp          # stdio
  node service/cli.mjs serve        # Streamable HTTP /mcp
Options: --preset dongli-symbol-white|dongli-lockup-full-white|dongli-wordmark-bilingual-inline-white
         --font sans|serif --no-optical --preset --line1 --line2 --logo --background auto|white|black|transparent
         --color auto|original --size --safe-shape circle|square --padding --logo-scale --style --palette --seed
         --format png|jpg|webp --config --out --out-dir --allow-fallback
Outputs are created exclusively: existing files are never overwritten.
Set AVATAR_CHROMIUM_PATH for a system browser. See docs/automation.md.`

async function boundedFile(file, limit) {
  if ((await stat(file)).size > limit) throw new Error('Input file exceeds size limit')
  const data = await readFile(file)
  if (data.length > limit) throw new Error('Input file exceeds size limit')
  return data
}

async function createOutput(file, data) {
  const temporary = await mkdtemp(path.join(path.dirname(path.resolve(file)), '.gradient-avatar-'))
  try {
    const staged = path.join(temporary, 'image')
    await writeFile(staged, data, { flag: 'wx', mode: 0o600 })
    await link(staged, file) // Atomic publication; EEXIST also protects existing symlinks.
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries([
      ...[
        'preset',
        'font',
        'line1',
        'line2',
        'logo',
        'background',
        'color',
        'size',
        'padding',
        'safe-shape',
        'logo-scale',
        'style',
        'palette',
        'seed',
        'format',
        'config',
        'out',
        'out-dir',
      ].map((k) => [k, { type: 'string' }]),
      ['help', { type: 'boolean' }],
      ['allow-fallback', { type: 'boolean' }],
      ['no-optical', { type: 'boolean' }],
    ]),
  })
  const command = positionals[0]
  if (values.help || !command) {
    console.log(HELP)
    return
  }
  if (
    positionals.length !== 1 ||
    !['render', 'validate', 'batch', 'options', 'mcp', 'serve'].includes(command)
  )
    throw new Error('Unknown command; use --help')
  const permitted = { batch: ['config', 'out-dir'], options: [], mcp: [], serve: [] }[command]
  if (permitted && Object.keys(values).some((key) => !permitted.includes(key)))
    throw new Error(`Unsupported option for ${command}`)
  if (!values.logo && (values.color || values.background))
    throw new Error(
      '--color and --background require --logo; otherwise set logo options in the JSON config',
    )
  const renderer = new Renderer()
  if (command === 'mcp' || command === 'serve') {
    let server, mcp
    if (command === 'mcp') {
      mcp = createAvatarMcp(renderer)
      await mcp.connect(new StdioServerTransport())
    } else {
      const options = httpOptions()
      server = createAvatarHttp(renderer, options)
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(options.port, options.host, resolve)
      })
      console.error(`Gradient Avatar listening on ${options.host}:${server.address().port}/mcp`)
    }
    const close = async () => {
      server?.close()
      await mcp?.close()
      await renderer.close()
    }
    process.once('SIGINT', close)
    process.once('SIGTERM', close)
    if (mcp)
      mcp.server.onclose = () => {
        void renderer.close()
      }
    return
  }
  try {
    if (command === 'options') {
      console.log(JSON.stringify(await renderer.run(null, { catalog: true }), null, 2))
      return
    }
    const raw = values.config
      ? JSON.parse((await boundedFile(values.config, 6 * 1024 ** 2)).toString('utf8'))
      : {}
    if (values.preset) raw.preset = values.preset
    if (values.font) raw.font = values.font
    if (values['no-optical']) raw.optical = false
    if (command === 'batch') {
      if (!values['out-dir']) throw new Error('batch requires --out-dir')
      const { items } = batchSchema.parse(raw)
      await mkdir(values['out-dir'], { recursive: true })
      const results = []
      for (const [index, item] of items.entries()) {
        const target = path.resolve(
          values['out-dir'],
          `${String(index + 1).padStart(3, '0')}.${item.format}`,
        )
        try {
          const result = await renderer.run(item)
          await createOutput(target, Buffer.from(result.data, 'base64'))
          results.push({ index, ok: true, path: target, ...result.metadata })
        } catch (error) {
          results.push({ index, ok: false, error: error.message.split('\n')[0] })
        }
      }
      console.log(JSON.stringify({ results }, null, 2))
      if (results.some((r) => !r.ok)) process.exitCode = 1
      return
    }
    if (values['safe-shape'] !== undefined) raw.safeShape = values['safe-shape']
    for (const key of ['line1', 'line2', 'style', 'palette', 'seed', 'format'])
      if (values[key] !== undefined) raw[key] = values[key]
    for (const [key, field] of [
      ['size', 'size'],
      ['padding', 'padding'],
      ['logo-scale', 'logoScale'],
    ])
      if (values[key] !== undefined) raw[field] = Number(values[key])
    if (values.logo) {
      const extension = path.extname(values.logo).toLowerCase()
      if (!['.png', '.svg'].includes(extension)) throw new Error('Logo must be PNG or SVG')
      raw.logo = {
        mimeType: extension === '.svg' ? 'image/svg+xml' : 'image/png',
        data: (await boundedFile(values.logo, LOGO_BYTES)).toString('base64'),
        background: values.background ?? 'auto',
        color: values.color ?? 'auto',
      }
    }
    if (values['allow-fallback']) raw.strict = false
    const input = renderSchema.parse(raw)
    if (command === 'render' && !values.out) throw new Error('render requires --out')
    if (command === 'render' && path.extname(values.out).toLowerCase() !== `.${input.format}`)
      throw new Error('Output extension must match --format')
    const result = await renderer.run(input, { validateOnly: command === 'validate' })
    if (command === 'render') await createOutput(values.out, Buffer.from(result.data, 'base64'))
    console.log(
      JSON.stringify(
        { ...(values.out ? { path: path.resolve(values.out) } : {}), ...result.metadata },
        null,
        2,
      ),
    )
  } finally {
    await renderer.close()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
