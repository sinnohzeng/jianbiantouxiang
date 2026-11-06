import { CLIENT_PRESET_IDS } from '@/graphics/client-presets'
import { presetLogo } from './presets'
import { applyOpticalLayout } from '@/text/optical'
import '@fontsource/noto-sans-sc/700.css'
import { renderGradient } from '@/engine/render'
import { drawHighlight } from '@/engine/highlight'
import { composeWith } from '@/export/compose-core'
import { encodeCanvas } from '@/export/encode'
import { drawGraphic } from '@/graphics/draw'
import { createCanvas, get2d, releaseCanvas } from '@/lib/canvas'
import { PALETTES } from '@/palettes/palettes'
import { normalizeConfig, STYLE_IDS } from '@/state/config'
import { drawText } from '@/text/draw'
import { badgeLayout } from './layout'
import { prepareLogo } from './logo'
import { renderSchema } from './schema'
import { unsupportedCharacters } from './glyphs'
import { selectInk } from './contrast'

async function render(raw: unknown, validateOnly = false) {
  const input = renderSchema.parse(raw)
  if (input.preset) {
    if (input.logo) throw new Error('Use preset or logo, not both')
    input.logo = presetLogo(input.preset)
  }
  const weight = input.font === 'serif' ? 600 : 700
  const family = input.font === 'serif' ? 'Noto Serif SC' : 'Noto Sans SC'
  if (input.font === 'serif') await import('@fontsource/noto-serif-sc/600.css')
  const palette = PALETTES.find((p) => p.id === input.palette)
  if (!palette) throw new Error(`Unknown palette: ${input.palette}`)
  if (input.preset && palette.tone !== 'dark')
    throw new Error('White customer preset requires a dark palette')
  if (!input.line1 && !input.line2 && !input.logo)
    throw new Error('Provide a logo or at least one text line')
  const warnings: string[] = []
  if (input.preset && input.preset !== 'dongli-symbol-white')
    warnings.push('dense-brand-lockup:prefer-dongli-symbol-white-for-small-avatars')
  const missing = unsupportedCharacters(input.line1 + input.line2, input.font)
  if (missing.length) {
    const warning = `font-missing-glyphs:${missing.map((c) => 'U+' + c.codePointAt(0)?.toString(16).toUpperCase()).join(',')}`
    if (input.strict) throw new Error(warning)
    warnings.push(warning)
  }
  const fontFaces = await document.fonts.load(
    `${weight} 32px "${family}"`,
    input.line1 + input.line2 || 'Aa中',
  )
  if (!fontFaces.length || fontFaces.some((font) => font.status !== 'loaded'))
    throw new Error('Bundled font could not load')
  const config = normalizeConfig({
    text: [input.line1, input.line2].join('\n'),
    seed: input.seed,
    style: input.style,
    palette: input.palette,
    canvas: { width: input.size, height: input.size, shape: 'square' },
    typography: { color: palette.text, optical: input.optical, padding: input.padding },
    exportOptions: { format: input.format, sizeTarget: 'none', bgColor: palette.bg },
  })
  const logo = input.logo ? await prepareLogo(input.logo, palette.text) : null
  const measureCanvas = createCanvas(1, 1),
    ctx = get2d(measureCanvas)
  let output: HTMLCanvasElement | undefined
  try {
    if (logo) warnings.push(...logo.warnings)
    let layout = badgeLayout(
      input.size,
      input.padding,
      input.logoScale,
      [input.line1, input.line2],
      logo?.graphic ?? null,
      (text, size) => {
        ctx.font = `${weight} ${size}px "${family}"`
        const m = ctx.measureText(text)
        return {
          left: m.actualBoundingBoxLeft,
          right: m.actualBoundingBoxRight,
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent,
        }
      },
      input.safeShape,
      family,
      weight,
    )
    layout = applyOpticalLayout(
      layout,
      config,
      input.size,
      input.size,
      logo?.graphic ?? null,
      input.safeShape === 'circle',
    )
    if (layout.overflow) warnings.push('content-outside-safe-area')
    if (!logo && layout.lines.every((line) => line.width <= 0))
      throw new Error('Text has no visible glyphs')
    if (layout.lines.some((l) => ((l.ascent + l.descent) / input.size) * 48 < 6))
      warnings.push('text-small-at-48px:shorten-text-or-remove-second-line')
    if (
      logo &&
      Math.min(logo.graphic.width / logo.graphic.height, logo.graphic.height / logo.graphic.width) <
        0.12
    )
      warnings.push('extreme-logo-aspect-ratio')
    if (input.strict && layout.overflow) throw new Error('Content exceeds the safe area')
    let renderMode = 'webgl2'
    let sampledMinContrast: number | null = null
    const metadata = () => ({
      schemaVersion: 1,
      size: input.size,
      style: input.style,
      palette: input.palette,
      seed: input.seed,
      color: config.typography.color,
      sampledMinContrast,
      font: family + ' ' + weight,
      optical: layout.optical,
      preset: input.preset ?? null,
      safeArea: layout.safeBox,
      safeShape: input.safeShape,
      safeCircle:
        input.safeShape === 'circle'
          ? { cx: input.size / 2, cy: input.size / 2, radius: input.size * (0.5 - input.padding) }
          : null,
      logoBounds: layout.graphic ?? null,
      textBounds: layout.box,
      lines: layout.lines.map((l) => ({
        text: l.text,
        fontSize: l.fontSizePx,
        baseline: l.y,
        width: l.width,
        bounds: (() => {
          ctx.font = l.font
          const m = ctx.measureText(l.text)
          return {
            x: l.x - m.actualBoundingBoxLeft,
            y: l.y - l.ascent,
            width: l.width,
            height: l.ascent + l.descent,
          }
        })(),
      })),
      displayChecks: [24, 32, 48, 64].map((size) => ({
        size,
        lineInkHeights: layout.lines.map((l) =>
          Number((((l.ascent + l.descent) / input.size) * size).toFixed(2)),
        ),
      })),
      overflow: layout.overflow,
      warnings,
      renderMode,
    })
    if (validateOnly) return { metadata: { ...metadata(), renderMode: 'not-rendered' } }
    output = await composeWith(config, input.size, input.size, {
      loadFonts: async () => [],
      loadGraphicForConfig: async () => logo?.graphic ?? null,
      renderGradient: (c, w, h) =>
        renderGradient(c, w, h, {
          onFallback: (reason) => {
            renderMode = 'approximation'
            warnings.push(`render-fallback:${reason}`)
          },
        }),
      drawHighlight: (context, w, h, strength, seed) => {
        drawHighlight(context, w, h, strength, seed)
        const ink = selectInk(context, [layout.box, ...(layout.graphic ? [layout.graphic] : [])])
        config.typography.color = ink.color
        sampledMinContrast = ink.sampledMinContrast
        logo?.recolor(ink.color)
        if (sampledMinContrast < 4.5)
          warnings.push('sampled-low-contrast:try-another-palette-or-seed')
      },
      layoutText: () => layout,
      drawText,
      drawGraphic,
    })
    if (input.strict && renderMode !== 'webgl2')
      throw new Error('WebGL2 rendering failed; strict mode rejects approximation')
    const encoded = await encodeCanvas(output, config.exportOptions)
    const mimeType = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[input.format]
    if (encoded.blob.type !== mimeType) throw new Error('Requested encoder is unavailable')
    const bytes = new Uint8Array(await encoded.blob.arrayBuffer())
    if (bytes.length > 8 * 1024 ** 2) throw new Error('Image exceeds 8 MiB; use JPG or reduce size')
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    return {
      data: btoa(binary),
      mimeType,
      metadata: { ...metadata(), mimeType, bytes: bytes.length, quality: encoded.quality },
    }
  } finally {
    logo?.release()
    releaseCanvas(measureCanvas)
    if (output) releaseCanvas(output)
  }
}

declare global {
  interface Window {
    gradientAvatar: {
      render: typeof render
      catalog: () => {
        palettes: typeof PALETTES
        styles: typeof STYLE_IDS
        fonts: string[]
        presets: typeof CLIENT_PRESET_IDS
      }
    }
  }
}
window.gradientAvatar = {
  render,
  catalog: () => ({
    palettes: PALETTES,
    styles: STYLE_IDS,
    fonts: ['sans', 'serif'],
    presets: CLIENT_PRESET_IDS,
  }),
}
