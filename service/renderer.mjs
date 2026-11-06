import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { renderSchema } from '../src/automation/schema.ts'

const ROOT = path.resolve(import.meta.dirname, '../dist-service')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

export class RenderError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/** Serial browser ownership, bounded waiting, per-call context, no remote resources or files. */
export class Renderer {
  #server
  #browser
  #origin
  #pending = 0
  #tail = Promise.resolve()
  #closed = false
  #ready
  constructor({ executablePath = process.env.AVATAR_CHROMIUM_PATH, timeoutMs = 30_000 } = {}) {
    this.executablePath = executablePath
    this.timeoutMs = timeoutMs
  }
  async #start() {
    const files = new Map()
    const walk = async (dir) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) await walk(file)
        else if (entry.isFile())
          files.set('/' + path.relative(ROOT, file).split(path.sep).join('/'), file)
      }
    }
    await walk(ROOT)
    if (!files.has('/service/renderer.html')) throw new Error('Run npm run build:service first')
    this.#server = createServer(async (req, res) => {
      const file = req.method === 'GET' && files.get(req.url)
      if (!file) {
        res.writeHead(404).end()
        return
      }
      try {
        res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream')
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; connect-src 'none'; base-uri 'none'",
        )
        res.end(await readFile(file))
      } catch {
        res.writeHead(500).end()
      }
    })
    await new Promise((resolve, reject) => {
      this.#server.once('error', reject)
      this.#server.listen(0, '127.0.0.1', resolve)
    })
    this.#origin = `http://127.0.0.1:${this.#server.address().port}`
    try {
      this.#browser = await chromium.launch({
        executablePath: this.executablePath,
        // Chromium never needs service credentials or cloud SDK environment variables.
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: '/tmp', LANG: 'C.UTF-8' },
        chromiumSandbox: process.env.AVATAR_CHROMIUM_SANDBOX !== '0',
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      })
    } catch (error) {
      await new Promise((r) => this.#server.close(r))
      throw error
    }
  }
  async run(raw, { validateOnly = false, catalog = false } = {}) {
    if (this.#closed) throw new RenderError('CLOSED', 'Renderer is closed')
    const input = catalog ? undefined : renderSchema.parse(raw)
    if (this.#pending >= 4) throw new RenderError('BUSY', 'Render queue is full; retry later')
    this.#pending++
    const job = this.#tail.then(async () => {
      this.#ready ??= this.#start().catch((error) => {
        this.#ready = undefined
        throw error
      })
      await this.#ready
      const context = await this.#browser.newContext({
        serviceWorkers: 'block',
        acceptDownloads: false,
      })
      let timer
      try {
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url())
          return url.origin === this.#origin ? route.continue() : route.abort('blockedbyclient')
        })
        const page = await context.newPage()
        page.setDefaultTimeout(this.timeoutMs)
        const work = async () => {
          await page.goto(this.#origin + '/service/renderer.html')
          await page.waitForFunction(() => !!globalThis.gradientAvatar)
          return page.evaluate(
            async ({ input, validateOnly, catalog }) =>
              catalog
                ? globalThis.gradientAvatar.catalog()
                : globalThis.gradientAvatar.render(input, validateOnly),
            { input, validateOnly, catalog },
          )
        }
        return await Promise.race([
          work(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new RenderError('TIMEOUT', 'Render exceeded time limit')),
              this.timeoutMs,
            )
          }),
        ])
      } finally {
        clearTimeout(timer)
        await context.close()
      }
    })
    this.#tail = job.catch(() => {})
    try {
      return await job
    } finally {
      this.#pending--
    }
  }
  async close() {
    this.#closed = true
    await this.#tail
    await this.#browser?.close()
    if (this.#server?.listening) await new Promise((resolve) => this.#server.close(resolve))
  }
}
