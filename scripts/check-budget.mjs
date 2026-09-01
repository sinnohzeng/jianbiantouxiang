#!/usr/bin/env node
/**
 * 首屏 JS 预算守卫。
 *
 * 口径与 docs/architecture.md 一致：entry script 加 dist/index.html 里全部
 * modulepreload 的 gzip 之和。CSS、PWA 注册脚本与懒加载 chunk 不算首屏 JS。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 250 * 1024
const HTML_PATH = path.resolve(process.cwd(), 'dist/index.html')

function attr(tag, name) {
  const match = new RegExp(`\\b${name}="([^"]+)"`).exec(tag)
  return match?.[1]
}

function refsOf(html) {
  const refs = []
  for (const match of html.matchAll(/<script\b[^>]*>/g)) {
    const tag = match[0] ?? ''
    const src = attr(tag, 'src')
    if (src?.startsWith('/assets/') && src.endsWith('.js')) refs.push(src)
  }
  for (const match of html.matchAll(/<link\b[^>]*>/g)) {
    const tag = match[0] ?? ''
    if (attr(tag, 'rel') !== 'modulepreload') continue
    const href = attr(tag, 'href')
    if (href?.startsWith('/assets/') && href.endsWith('.js')) refs.push(href)
  }
  return [...new Set(refs)]
}

async function main() {
  let html
  try {
    html = await readFile(HTML_PATH, 'utf8')
  } catch {
    console.error(`找不到 ${HTML_PATH}；先运行 npm run build。`)
    process.exitCode = 1
    return
  }

  const refs = refsOf(html)
  if (refs.length === 0) {
    console.error('dist/index.html 里没有 entry script，预算脚本读错了。')
    process.exitCode = 1
    return
  }

  let total = 0
  const rows = []
  for (const ref of refs) {
    const file = path.join(process.cwd(), 'dist', ref.slice(1))
    let bytes
    try {
      bytes = gzipSync(await readFile(file)).length
    } catch {
      console.error(`读不到 ${file}。`)
      process.exitCode = 1
      return
    }
    total += bytes
    rows.push({ ref, bytes })
  }

  for (const row of rows) {
    console.log(`${row.ref}\t${(row.bytes / 1024).toFixed(2)} KB`)
  }
  console.log(`TOTAL\t${(total / 1024).toFixed(2)} KB`)
  console.log(`BUDGET\t${(BUDGET_BYTES / 1024).toFixed(2)} KB`)

  if (total > BUDGET_BYTES) {
    console.error(`首屏 JS 超出预算 ${((total - BUDGET_BYTES) / 1024).toFixed(2)} KB`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
