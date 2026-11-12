/* global document */
/** Pixel audit of layout invariants with production layout/draw code and real fonts and brand assets.
 * Start npm run dev, then node scripts/audit-geometry.mjs <output-dir> [origin]. Exits 1 on a violation. */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const directory = path.resolve(process.argv[2] ?? '/tmp/avatar-geometry-audit')
const origin = process.argv[3] ?? 'http://127.0.0.1:5173'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.AVATAR_CHROMIUM_PATH,
  chromiumSandbox: process.env.AVATAR_CHROMIUM_SANDBOX !== '0',
})
try {
  const page = await browser.newPage()
  await page.goto(origin)
  const result = await page.evaluate(async () => {
    const { normalizeConfig } = await import('/src/state/config.ts')
    const { layoutText } = await import('/src/text/layout.ts')
    const { loadFontsForConfig } = await import('/src/fonts/loader.ts')
    const { loadGraphic } = await import('/src/graphics/source.ts')
    const { alphaBounds } = await import('/src/graphics/trim.ts')
    const { drawText } = await import('/src/text/draw.ts')
    const { drawGraphic } = await import('/src/graphics/draw.ts')
    const { BRAND_INDEX } = await import('/src/graphics/generated/brand-index.ts')
    const S = 1024
    const graphics = new Map()
    const graphicOf = async (icon) => {
      const key = `${icon.source}:${icon.id}`
      if (!graphics.has(key))
        graphics.set(key, icon.source === 'none' ? null : await loadGraphic(icon))
      return graphics.get(key)
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const ink = () => alphaBounds(ctx.getImageData(0, 0, S, S).data, S, S)
    const measure = async (partial) => {
      const config = normalizeConfig(partial)
      const plain = { ...config, typography: { ...config.typography, effect: 'plain' } }
      await loadFontsForConfig(config)
      const graphic = await graphicOf(config.layout.icon)
      const layout = layoutText(config, S, S, undefined, graphic)
      ctx.clearRect(0, 0, S, S)
      if (graphic && layout.graphic) drawGraphic(ctx, graphic, layout.graphic, plain, '#000')
      const logo = layout.graphic ? ink() : null
      const lines = layout.lines.map((_, i) => {
        ctx.clearRect(0, 0, S, S)
        drawText(ctx, { ...layout, lines: layout.lines.filter((__, j) => j === i) }, plain, '#000')
        return ink()
      })
      ctx.clearRect(0, 0, S, S)
      if (graphic && layout.graphic) drawGraphic(ctx, graphic, layout.graphic, plain, '#000')
      drawText(ctx, layout, plain, '#000')
      const group = ink()
      const pct = (v) => Math.round((v / S) * 10000) / 100
      return {
        errX: group ? pct(group.x + group.width / 2 - S / 2) : null,
        errY: group ? pct(group.y + group.height / 2 - S / 2) : null,
        logo: logo && { width: logo.width, height: logo.height },
        lines,
        fontPx: layout.lines.map((l) => Math.round(l.fontSizePx * 10) / 10),
        overflow: layout.overflow,
      }
    }

    const aspects = []
    for (const entry of BRAND_INDEX) {
      const g = await graphicOf({ source: 'brand', id: entry.id, mono: false })
      if (g) aspects.push({ id: entry.id, aspect: Math.round((g.width / g.height) * 100) / 100 })
    }
    const byAspect = [...aspects].sort((a, b) => a.aspect - b.aspect)
    const tall = byAspect[0].id
    const wide = byAspect.at(-1).id

    const icons = ['none', 'doubao-work', 'lark', 'dongli-lockup-full-white', tall, wide]
    const iconOf = (id) =>
      id === 'none' ? { source: 'none' } : { source: 'brand', id, mono: false }
    const texts = [
      '工作新习惯\n你说豆包干',
      '研发',
      '研发\nSTUDIO',
      '飞书\n效率先锋',
      'ABC\nxyz',
      '\n只有第二行',
    ]
    const centering = []
    for (const id of icons)
      for (const text of texts)
        for (const shape of ['square', 'circle'])
          centering.push({
            icon: id,
            text,
            shape,
            ...(await measure({
              text,
              canvas: { width: S, height: S, shape },
              layout: { icon: iconOf(id) },
            })),
          })

    const steps = [
      0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.52, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
    ]
    const logoSweep = []
    for (const id of icons.slice(1))
      for (const text of ['工作新习惯\n你说豆包干', ''])
        for (const graphic of steps) {
          const m = await measure({ text, layout: { icon: iconOf(id), graphic } })
          logoSweep.push({ icon: id, text: text ? 'two-line' : 'logo-only', graphic, ...m })
        }

    const lineHeightSweep = []
    for (const id of ['none', 'doubao-work'])
      for (const lineHeight of [0.85, 1, 1.03, 1.3, 1.6, 2]) {
        const m = await measure({ typography: { lineHeight }, layout: { icon: iconOf(id) } })
        const [a, b] = m.lines
        lineHeightSweep.push({ icon: id, lineHeight, gap: a && b ? b.y - (a.y + a.height) : null })
      }
    return { aspects, centering, logoSweep, lineHeightSweep }
  })

  const violations = []
  for (const c of result.centering)
    if (Math.abs(c.errY) > 0.5)
      violations.push(`centre ${c.icon} ${JSON.stringify(c.text)} ${c.shape}: errY ${c.errY}%`)
  const series = Object.groupBy(result.logoSweep, (r) => `${r.icon} ${r.text}`)
  for (const [name, rows] of Object.entries(series))
    rows.forEach((row, i) => {
      const prev = rows[i - 1]
      if (!prev || !row.logo || !prev.logo) return
      const share = (r) => (r.fontPx[0] ? r.logo.height / r.fontPx[0] : r.logo.width)
      if (share(row) <= share(prev))
        violations.push(`logo ${name}: ${prev.graphic} → ${row.graphic} does not grow`)
    })
  for (const [name, rows] of Object.entries(Object.groupBy(result.lineHeightSweep, (r) => r.icon)))
    rows.forEach((row, i) => {
      if (i > 0 && row.gap <= rows[i - 1].gap)
        violations.push(`lineHeight ${name}: ${rows[i - 1].lineHeight} → ${row.lineHeight}`)
    })

  await writeFile(
    path.join(directory, 'geometry.json'),
    JSON.stringify({ ...result, violations }, null, 1),
  )
  const maxErr = (rows, key) => Math.max(...rows.map((r) => Math.abs(r[key] ?? 0)))
  console.log(
    JSON.stringify({
      directory,
      brands: result.aspects.length,
      centreErrY: maxErr(result.centering, 'errY'),
      centreErrX: maxErr(result.centering, 'errX'),
      violations,
    }),
  )
  if (violations.length) process.exitCode = 1
} finally {
  await browser.close()
}
