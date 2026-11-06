import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAvatarHttp, httpOptions, BODY_LIMIT } from '../http.mjs'
import { batchSchema } from '../mcp.mjs'
import { request } from 'node:http'

test('external bindings require explicit security configuration', () => {
  assert.throws(() => httpOptions({ AVATAR_HOST: '0.0.0.0' }))
  assert.throws(() => httpOptions({ AVATAR_HOST: '0.0.0.0', AVATAR_PUBLIC: '1' }))
  assert.throws(() => httpOptions({ AVATAR_TOKEN: 'short' }))
  assert.throws(() => httpOptions({ AVATAR_PUBLIC_URL: 'http://example.com/mcp' }))
  assert.throws(() =>
    batchSchema.parse({ items: Array.from({ length: 3 }, () => ({ size: 2048 })) }),
  )
  assert.equal(httpOptions({}).host, '127.0.0.1')
})

test('HTTP rejects unauthorized, cross-origin, host spoofing and oversized requests before render', async () => {
  let calls = 0
  const token = 'test-only-not-a-deployment-secret-123456789'
  const renderer = {
    run: async () => {
      calls++
      throw new Error('must not execute')
    },
  }
  const server = createAvatarHttp(renderer, httpOptions({ AVATAR_TOKEN: token }))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/mcp`
  try {
    assert.equal((await fetch(url, { method: 'POST' })).status, 401)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://evil.example' },
          body: '{}',
        })
      ).status,
      403,
    )
    const badHostStatus = await new Promise((resolve, reject) => {
      const req = request(
        url,
        { method: 'POST', headers: { ...headers, Host: 'evil.example' } },
        (res) => {
          res.resume()
          resolve(res.statusCode)
        },
      )
      req.on('error', reject)
      req.end('{}')
    })
    assert.equal(badHostStatus, 403)
    assert.equal((await fetch(url, { headers })).status, 405)
    assert.equal((await fetch(url, { method: 'POST', headers, body: '[' })).status, 400)
    assert.equal(
      (await fetch(url, { method: 'POST', headers, body: ' '.repeat(BODY_LIMIT + 1) })).status,
      413,
    )
    assert.equal(calls, 0)
  } finally {
    await new Promise((r) => server.close(r))
    server.closeAllConnections()
  }
})

test('process-wide rate limit is bounded even for invalid calls', async () => {
  const server = createAvatarHttp({ run: async () => ({}) }, httpOptions({}))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    const url = `http://127.0.0.1:${server.address().port}/mcp`
    let response
    for (let i = 0; i < 61; i++)
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '60')
  } finally {
    await new Promise((r) => server.close(r))
    server.closeAllConnections()
  }
})
