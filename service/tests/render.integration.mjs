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
  'real render: all shaders, formats, logo, validation, failure isolation and determinism',
  { timeout: 120_000 },
  async () => {
    const renderer = new Renderer()
    try {
      const validation = await renderer.run({ ...request, logo }, { validateOnly: true })
      assert.equal(validation.metadata.overflow, false)
      assert.equal(validation.metadata.lines.length, 2)
      assert.equal(validation.metadata.safeShape, 'circle')
      assert.equal(validation.metadata.safeCircle.radius, request.size * 0.44)
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
              Math.hypot(x - request.size / 2, y - request.size / 2) <= request.size * 0.44 + 0.01,
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
      assert.equal(options.structuredContent.palettes.length, 37)
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
