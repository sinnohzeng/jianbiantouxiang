import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Renderer } from '../renderer.mjs'
import { createAvatarHttp, httpOptions } from '../http.mjs'
import { logoPng } from './fixtures.mjs'
import { createServer } from 'node:http'

const run = promisify(execFile)
const request = { line1: '渐变头像', line2: 'Product studio', size: 256, seed: 'integration' }
const logo = {
  mimeType: 'image/svg+xml',
  data: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><path fill="black" d="M40 20H160V80H40Z"/></svg>',
  ).toString('base64'),
}

test(
  'serif optical layout and customer presets preserve bounds, original artwork and manual opt-out',
  { timeout: 120_000 },
  async () => {
    const renderer = new Renderer()
    try {
      for (const font of ['sans', 'serif']) {
        const base = { line1: '飞书', line2: '效率先锋', font, size: 512, seed: 'optical-test' }
        const off = await renderer.run({ ...base, optical: false })
        const on = await renderer.run(base)
        assert.equal(off.metadata.optical.mode, 'off')
        assert.equal(on.metadata.optical.mode, 'bounded')
        assert.ok(on.metadata.font.includes(font === 'serif' ? 'Serif' : 'Sans'))
        assert.ok(
          Math.abs(on.metadata.lines[0].fontSize / off.metadata.lines[0].fontSize - 1) < 0.04,
        )
        assert.ok(Math.abs(on.metadata.optical.groupShiftY) <= 512 * 0.015)
        for (const [i, shift] of on.metadata.optical.lineShifts.entries())
          assert.ok(Math.abs(shift) <= on.metadata.lines[i].fontSize * 0.02 + 0.001)
        for (const l of on.metadata.lines)
          for (const x of [l.bounds.x, l.bounds.x + l.bounds.width])
            for (const y of [l.bounds.y, l.bounds.y + l.bounds.height])
              assert.ok(Math.hypot(x - 256, y - 256) <= on.metadata.safeCircle.radius + 0.1)
      }
      const wideLogo = {
        mimeType: 'image/svg+xml',
        data: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 100"><path fill="white" d="M0 0H900V100H0Z"/></svg>',
        ).toString('base64'),
      }
      for (const font of ['sans', 'serif']) {
        const { metadata: m } = await renderer.run({
          line1: '飞书对接',
          line2: '外部群',
          font,
          logo: wideLogo,
          size: 512,
        })
        assert.ok(m.lines[0].bounds.y - m.logoBounds.y - m.logoBounds.height >= 28)
        assert.ok(m.lines[1].bounds.y - m.lines[0].bounds.y - m.lines[0].bounds.height >= 16)
        assert.ok(m.lines[0].fontSize >= 85)
        assert.equal(m.overflow, false)
      }
      for (const presetId of [
        'dongli-symbol-white',
        'dongli-lockup-full-white',
        'dongli-wordmark-bilingual-inline-white',
      ]) {
        const input = { line1: '飞书对接', line2: '外部群', preset: presetId, size: 512 }
        const off = (await renderer.run({ ...input, optical: false })).metadata
        const on = (await renderer.run(input)).metadata
        assert.equal(on.overflow, false)
        assert.ok(
          on.optical.groupShiftY < -5,
          'preserved brand padding must not pin visible contents low',
        )
        assert.ok(on.optical.groupScale >= 0.94 && on.optical.groupScale <= 1)
        assert.ok(on.lines[0].fontSize >= off.lines[0].fontSize * 0.94)
        assert.ok(Math.abs(on.lines[1].fontSize / on.lines[0].fontSize - 0.62) < 0.001)
        for (const r of [on.logoBounds, ...on.lines.map((l) => l.bounds)])
          for (const x of [r.x, r.x + r.width])
            for (const y of [r.y, r.y + r.height])
              assert.ok(Math.hypot(x - 256, y - 256) <= on.safeCircle.radius + 0.1)
      }
      for (const title of ['飞', '大讲堂内部', '飞书大讲堂', '东黎羊绒项目协同']) {
        const body = { line1: title, line2: '东黎羊绒', preset: 'dongli-symbol-white', size: 512 }
        const old = (await renderer.run({ ...body, padding: 0.06 }, { validateOnly: true }))
          .metadata
        const next = (await renderer.run(body, { validateOnly: true })).metadata
        assert.ok(next.fillScale >= 1 && next.fillScale <= 1.16)
        assert.ok(next.lines[0].fontSize >= old.lines[0].fontSize)
        assert.ok(next.lines[0].font.includes('Serif'))
        assert.ok(next.lines[1].font.includes('Sans'))
        assert.ok(
          Math.abs(
            next.lines[1].fontSize / next.lines[0].fontSize -
              old.lines[1].fontSize / old.lines[0].fontSize,
          ) < 0.001,
        )
        assert.equal(next.overflow, false)
        for (const r of [next.logoBounds, ...next.lines.map((l) => l.bounds)])
          for (const x of [r.x, r.x + r.width])
            for (const y of [r.y, r.y + r.height])
              assert.ok(Math.hypot(x - 256, y - 256) <= next.safeCircle.radius + 0.01)
      }
      for (const size of [128, 256, 512, 1024]) {
        const { metadata: m } = await renderer.run(
          { ...request, size, logo },
          { validateOnly: true },
        )
        for (const r of [m.logoBounds, ...m.lines.map((l) => l.bounds)])
          for (const x of [r.x, r.x + r.width])
            for (const y of [r.y, r.y + r.height])
              assert.ok(
                Math.hypot(x - size / 2, y - size / 2) <= m.safeCircle.radius + 0.01,
                `hinted font boundary: ${JSON.stringify({ size, r, optical: m.optical })}`,
              )
      }
      const preset = await renderer.run({
        line1: '飞书对接',
        preset: 'dongli-symbol-white',
        size: 256,
      })
      assert.equal(preset.metadata.preset, 'dongli-symbol-white')
      assert.equal(preset.metadata.overflow, false)
      await assert.rejects(
        renderer.run({ line1: '测试', preset: 'dongli-symbol-white', palette: 'glacier' }),
        /dark palette/,
      )
      await assert.rejects(
        renderer.run({ line1: '测试', preset: 'dongli-symbol-white', logo }),
        /preset or logo/,
      )
    } finally {
      await renderer.close()
    }
  },
)

test(
  'real render: all shaders, formats, logo, validation, failure isolation and determinism',
  { timeout: 120_000 },
  async () => {
    const renderer = new Renderer()
    try {
      const validation = await renderer.run({ ...request, logo }, { validateOnly: true })
      assert.equal(validation.metadata.overflow, false)
      assert.equal(validation.metadata.lines.length, 2)
      assert.equal(validation.metadata.safeShape, 'circle')
      assert.equal(validation.metadata.safeCircle.radius, request.size * 0.47)
      assert.deepEqual(
        validation.metadata.displayChecks.map((x) => x.size),
        [24, 32, 48, 64],
      )
      for (const r of [
        validation.metadata.logoBounds,
        ...validation.metadata.lines.map((l) => l.bounds),
      ])
        for (const x of [r.x, r.x + r.width])
          for (const y of [r.y, r.y + r.height])
            assert.ok(
              Math.hypot(x - request.size / 2, y - request.size / 2) <=
                validation.metadata.safeCircle.radius + 0.01,
            )
      assert.equal(validation.data, undefined)
      for (const [style, format] of [
        ['mesh', 'png'],
        ['flow', 'jpg'],
        ['silk', 'webp'],
        ['grain', 'png'],
      ]) {
        const result = await renderer.run({ ...request, logo, style, format })
        assert.equal(result.metadata.renderMode, 'webgl2')
        if (style === 'mesh') {
          assert.equal(result.metadata.palette, 'steel-slate')
          assert.equal(result.metadata.color, '#ffffff')
          assert.ok(result.metadata.sampledMinContrast >= 4.5)
        }
        assert.equal(result.metadata.overflow, false)
        assert.ok(result.metadata.logoBounds.width > result.metadata.logoBounds.height)
        assert.ok(Buffer.from(result.data, 'base64').length > 1000)
        if (format === 'png') assert.equal(Buffer.from(result.data, 'base64').readUInt32BE(16), 256)
      }
      const first = await renderer.run(request),
        second = await renderer.run(request)
      assert.equal(first.data, second.data)
      const images = []
      for (const variant of [
        { white: false },
        { white: true },
        { white: false, transparent: true },
        { white: true, transparent: true },
      ]) {
        const result = await renderer.run({
          ...request,
          logo: { mimeType: 'image/png', data: logoPng(variant).toString('base64') },
        })
        images.push(result.data)
        assert.equal(result.metadata.logoBounds.width, result.metadata.logoBounds.height)
      }
      assert.ok(
        images.every((image) => image === images[0]),
        'black, white, transparent and opaque logos normalize identically',
      )
      // 压缩元数据从 PNG 中剥离，不进入解码器；像素输出保持一致。
      const plain = logoPng({ white: false, transparent: true })
      const metadata = Buffer.alloc(16)
      metadata.writeUInt32BE(4, 0)
      metadata.write('iCCP', 4)
      metadata.writeUInt32BE(0xffffffff, 8)
      const withMetadata = Buffer.concat([plain.subarray(0, 33), metadata, plain.subarray(33)])
      const normalized = await renderer.run({
        ...request,
        logo: {
          mimeType: 'image/png',
          data: withMetadata.toString('base64'),
        },
      })
      assert.equal(normalized.data, images[2])
      assert.ok(normalized.metadata.warnings.includes('png-compressed-metadata-removed'))
      metadata.write('acTL', 4)
      const animated = Buffer.concat([plain.subarray(0, 33), metadata, plain.subarray(33)])
      await assert.rejects(
        renderer.run({
          ...request,
          logo: {
            mimeType: 'image/png',
            data: animated.toString('base64'),
          },
        }),
        /Animated PNG/,
      )
      const bomb = logoPng()
      bomb.writeUInt32BE(100000, 16)
      await assert.rejects(
        renderer.run({
          ...request,
          logo: { mimeType: 'image/png', data: bomb.toString('base64') },
        }),
        /dimensions/,
      )
      await assert.rejects(
        renderer.run({
          ...request,
          logo: {
            ...logo,
            data: Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://169.254.169.254/latest/meta-data/"/></svg>',
            ).toString('base64'),
          },
        }),
      )
      await assert.rejects(renderer.run({ ...request, palette: 'not-a-palette' }))
      assert.equal((await renderer.run(request)).metadata.overflow, false)
    } finally {
      await renderer.close()
    }
  },
)

test(
  'official SDK client: HTTP initialize, discovery, validation, image result, partial batch and invalid inputs',
  { timeout: 120_000 },
  async () => {
    const renderer = new Renderer()
    const token = 'test-only-not-a-deployment-secret-123456789'
    const server = createAvatarHttp(renderer, httpOptions({ AVATAR_TOKEN: token }))
    const protocolVersions = new Set()
    server.on('request', (req) => {
      if (req.headers['mcp-protocol-version'])
        protocolVersions.add(req.headers['mcp-protocol-version'])
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const client = new Client({ name: 'gradient-avatar-integration', version: '1.0.0' })
    try {
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`http://127.0.0.1:${server.address().port}/mcp`),
          { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
        ),
      )
      assert.equal(client.getServerVersion().name, 'gradient-avatar')
      assert.equal((await client.listTools()).tools.length, 4)
      const options = await client.callTool({ name: 'list_avatar_options', arguments: {} })
      assert.equal(options.structuredContent.palettes.length, 47)
      const result = await client.callTool({
        name: 'render_avatar',
        arguments: { ...request, logo },
      })
      assert.equal(result.isError, undefined)
      assert.equal(result.content[0].type, 'image')
      assert.equal(result.content[0].mimeType, 'image/png')
      assert.equal(result.structuredContent.overflow, false)
      const batch = await client.callTool({
        name: 'render_avatar_batch',
        arguments: { items: [request, { ...request, palette: 'not-a-palette' }] },
      })
      assert.equal(batch.structuredContent.results[0].ok, true)
      assert.equal(batch.structuredContent.results[1].ok, false)
      const invalid = await client.callTool({
        name: 'render_avatar',
        arguments: { ...request, logo: { url: 'file:///etc/passwd' } },
      })
      assert.equal(invalid.isError, true)
      const invalidSize = await client.callTool({
        name: 'render_avatar',
        arguments: { ...request, size: 8192 },
      })
      assert.equal(invalidSize.isError, true)
      assert.ok(protocolVersions.has('2025-11-25'))
    } finally {
      await client.close()
      await new Promise((resolve) => server.close(resolve))
      await renderer.close()
    }
  },
)

test(
  'official SDK client: stdio protocol stays separate from diagnostics',
  { timeout: 60_000 },
  async () => {
    const client = new Client({ name: 'gradient-avatar-stdio-test', version: '1.0.0' })
    const env = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined))
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['service/cli.mjs', 'mcp'],
      cwd: path.resolve(import.meta.dirname, '../..'),
      env,
      stderr: 'pipe',
    })
    try {
      await client.connect(transport)
      assert.equal((await client.listTools()).tools.length, 4)
      const result = await client.callTool({ name: 'validate_avatar', arguments: request })
      assert.equal(result.structuredContent.overflow, false)
    } finally {
      await client.close()
    }
  },
)

test(
  'CLI creates files, refuses overwrite, batches partial failures and bounds output names',
  { timeout: 120_000 },
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'avatar-cli-test-'))
    const cwd = path.resolve(import.meta.dirname, '../..')
    try {
      const config = path.join(dir, 'input.json'),
        out = path.join(dir, 'avatar.png')
      await writeFile(config, JSON.stringify(request))
      const args = [
        'service/cli.mjs',
        'render',
        '--config',
        config,
        '--safe-shape',
        'square',
        '--out',
        out,
      ]
      const result = await run(process.execPath, args, { cwd })
      assert.equal(JSON.parse(result.stdout).size, 256)
      assert.equal(JSON.parse(result.stdout).safeShape, 'square')
      assert.equal(JSON.parse(result.stdout).safeCircle, null)
      const original = await readFile(out)
      await assert.rejects(run(process.execPath, args, { cwd }))
      assert.deepEqual(await readFile(out), original)
      await writeFile(
        config,
        JSON.stringify({ items: [request, { ...request, palette: 'invalid' }] }),
      )
      await assert.rejects(
        run(process.execPath, ['service/cli.mjs', 'batch', '--config', config, '--out-dir', dir], {
          cwd,
        }),
        (error) => {
          const report = JSON.parse(error.stdout)
          return report.results[0].ok && !report.results[1].ok
        },
      )
      assert.ok((await readFile(path.join(dir, '001.png'))).length > 1000)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

test(
  'renderer rejects an overfull queue and closes timed-out contexts',
  { timeout: 60_000 },
  async () => {
    const renderer = new Renderer({ timeoutMs: 1 })
    try {
      const work = Array.from({ length: 5 }, () => renderer.run(request))
      const settled = await Promise.allSettled(work)
      assert.equal(settled[4].status, 'rejected')
      assert.equal(settled[4].reason.code, 'BUSY')
      assert.equal(settled[0].status, 'rejected')
    } finally {
      await renderer.close()
    }
  },
)

test(
  'SVG localhost/private resource requests never reach a canary server',
  { timeout: 60_000 },
  async () => {
    let hits = 0
    const canary = createServer((req, res) => {
      hits++
      res.end('private data')
    })
    await new Promise((r) => canary.listen(0, '127.0.0.1', r))
    const renderer = new Renderer()
    try {
      for (const target of [
        `http://127.0.0.1:${canary.address().port}/secret`,
        'file:///etc/passwd',
        'https://example.com/logo.png',
      ]) {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><image href="${target}" width="100" height="100"/></svg>`
        await assert.rejects(
          renderer.run({
            ...request,
            logo: { mimeType: 'image/svg+xml', data: Buffer.from(malicious).toString('base64') },
          }),
        )
      }
      assert.equal(hits, 0)
    } finally {
      await renderer.close()
      await new Promise((r) => canary.close(r))
    }
  },
)
