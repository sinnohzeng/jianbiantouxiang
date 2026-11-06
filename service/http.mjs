import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createAvatarMcp } from './mcp.mjs'

export const BODY_LIMIT = 6 * 1024 * 1024
const digest = (value) => createHash('sha256').update(value).digest()

export function httpOptions(env = process.env) {
  const host = env.AVATAR_HOST ?? '127.0.0.1'
  const port = Number(env.AVATAR_PORT ?? 3000)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid AVATAR_PORT')
  const local = host === '127.0.0.1' || host === '::1' || host === 'localhost'
  const token = env.AVATAR_TOKEN
  if (token && token.length < 32)
    throw new Error('AVATAR_TOKEN must contain at least 32 characters')
  if (!local && !token && env.AVATAR_PUBLIC !== '1')
    throw new Error('External binding requires AVATAR_TOKEN or explicit AVATAR_PUBLIC=1')
  let publicUrl
  if (env.AVATAR_PUBLIC_URL) {
    publicUrl = new URL(env.AVATAR_PUBLIC_URL)
    if (
      publicUrl.protocol !== 'https:' ||
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.search ||
      publicUrl.hash ||
      publicUrl.pathname !== '/mcp'
    )
      throw new Error('AVATAR_PUBLIC_URL must be https://host/mcp')
  }
  if (!local && !publicUrl)
    throw new Error('External binding requires AVATAR_PUBLIC_URL with HTTPS')
  return { host, port, token, publicUrl, local }
}

/** Stateless Streamable HTTP. Nothing is written to disk; auth precedes parsing. */
export function createAvatarHttp(renderer, options = httpOptions()) {
  let active = 0,
    windowStart = Date.now(),
    count = 0
  const server = createServer(
    { requestTimeout: 10_000, headersTimeout: 5000, maxHeaderSize: 8192 },
    async (req, res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', 'no-store')
      const fail = (status, message) => {
        res
          .writeHead(status, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: message }))
      }
      const allowed = options.publicUrl
        ? [options.publicUrl.host]
        : [
            `127.0.0.1:${server.address().port}`,
            `localhost:${server.address().port}`,
            `[::1]:${server.address().port}`,
          ]
      if (!allowed.includes(req.headers.host)) return fail(403, 'Host not allowed')
      if (
        req.headers.origin &&
        req.headers.origin !== (options.publicUrl?.origin ?? `http://${req.headers.host}`)
      )
        return fail(403, 'Origin not allowed')
      if (req.url === '/healthz' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}')
        return
      }
      if (req.url !== '/mcp') return fail(404, 'Not found')
      if (
        options.token &&
        !timingSafeEqual(digest(req.headers.authorization ?? ''), digest(`Bearer ${options.token}`))
      ) {
        res.setHeader('WWW-Authenticate', 'Bearer')
        return fail(401, 'Authentication required')
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return fail(405, 'Only POST is supported; no sessions or SSE subscriptions')
      }
      if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json'))
        return fail(415, 'Use application/json')
      if (Date.now() - windowStart >= 60_000) {
        windowStart = Date.now()
        count = 0
      }
      if (++count > 60 || active >= 4) {
        res.setHeader('Retry-After', '60')
        return fail(429, 'Server request limit reached')
      }
      const length = Number(req.headers['content-length'] ?? 0)
      if (length > BODY_LIMIT) return fail(413, 'Request too large')
      active++
      let mcp, transport, bodyTimer
      try {
        const chunks = []
        let bytes = 0
        const readBody = async () => {
          for await (const chunk of req) {
            bytes += chunk.length
            if (bytes > BODY_LIMIT) throw new Error('BODY_LIMIT')
            chunks.push(chunk)
          }
          return JSON.parse(Buffer.concat(chunks).toString('utf8'))
        }
        const body = await Promise.race([
          readBody(),
          new Promise((_, reject) => {
            bodyTimer = setTimeout(() => reject(new Error('BODY_TIMEOUT')), 10_000)
          }),
        ])
        clearTimeout(bodyTimer)
        if (!body || Array.isArray(body) || typeof body !== 'object')
          return fail(400, 'Expected one JSON-RPC request')
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })
        mcp = createAvatarMcp(renderer)
        await mcp.connect(transport)
        await transport.handleRequest(req, res, body)
      } catch (error) {
        if (!res.headersSent && !res.destroyed)
          fail(
            error.message === 'BODY_LIMIT' ? 413 : error.message === 'BODY_TIMEOUT' ? 408 : 400,
            'Invalid or oversized request',
          )
      } finally {
        clearTimeout(bodyTimer)
        await transport?.close()
        await mcp?.close()
        active--
      }
    },
  )
  server.maxConnections = 32
  return server
}
