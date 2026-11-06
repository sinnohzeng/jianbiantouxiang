import { describe, it, expect } from 'vitest'
import { safeLogoSvg, trimLogoPixels } from '@/automation/logo'

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">${body}</svg>`
describe('remote SVG safety', () => {
  it.each([
    '<script>alert(1)</script>',
    '<foreignObject><iframe/></foreignObject>',
    '<image href="http://169.254.169.254/"/>',
    '<use href="file:///etc/passwd"/>',
    '<path onload="alert(1)" d="M0 0h1"/>',
    '<path fill="url(https://example.com/a)" d="M0 0h1"/>',
    '<style>@import "https://example.com";</style>',
    '<style>.a {fill:url(https://example.com/x)}</style>',
    '<style>.a {filter:blur(5px)}</style>',
    '<style>path {fill:red}</style>',
    '<style>.a {fill: red; background: url(file:///x)}</style>',
    '<filter/>',
    '<text>convert to paths first</text>',
  ])('rejects unsafe or unsupported content: %s', (body) =>
    expect(() => safeLogoSvg(svg(body))).toThrow(),
  )
  it('rejects entity declarations, depth and node bombs', () => {
    expect(() =>
      safeLogoSvg('<!DOCTYPE svg [<!ENTITY x "a">]>' + svg('<path d="M0 0h10"/>')),
    ).toThrow()
    expect(() =>
      safeLogoSvg(svg('<g>'.repeat(40) + '<path d="M0 0h10"/>' + '</g>'.repeat(40))),
    ).toThrow()
    expect(() => safeLogoSvg(svg('<path d="M0 0h1"/>'.repeat(2001)))).toThrow()
  })
  it('handles nonzero/negative viewBox origins and forces bounded raster size', () => {
    const safe = safeLogoSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -10 200 100"><path d="M0 0h50v50z"/></svg>',
    )
    expect(safe).toContain('width="1024"')
    expect(safe).toContain('height="512"')
  })
  it('rejects empty and excessive aspect ratios', () => {
    expect(() => safeLogoSvg(svg(''))).toThrow()
    expect(() => safeLogoSvg(svg('<path d="M0 0h1"/>').replace('100 50', '100000 1'))).toThrow()
  })
})
describe('black / white logo adaptation', () => {
  it.each([0, 255])('removes opaque %i background and trims empty margins', (background) => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = background
      pixels[i + 1] = background
      pixels[i + 2] = background
      pixels[i + 3] = 255
    }
    for (const i of [20, 24, 36, 40]) {
      pixels[i] = 255 - background
      pixels[i + 1] = 255 - background
      pixels[i + 2] = 255 - background
    }
    const box = trimLogoPixels(pixels, 4, 4, 'auto')
    expect(box).toMatchObject({
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      removed: background ? 'white' : 'black',
    })
    expect(pixels[3]).toBe(0)
    expect(pixels[23]).toBe(255)
  })
  it('preserves transparent logos and rejects blank input', () => {
    const pixels = new Uint8ClampedArray(16)
    pixels.set([255, 255, 255, 255], 4)
    expect(trimLogoPixels(pixels, 2, 2, 'auto')).toMatchObject({
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      removed: null,
    })
    expect(() => trimLogoPixels(new Uint8ClampedArray(16), 2, 2, 'auto')).toThrow('no visible')
  })
})

it('Illustrator 简单类填充规则转为安全属性，保留路径孔洞规则', () => {
  const safe = safeLogoSvg(
    svg(
      '<defs><style>.st0 { fill-rule: evenodd; fill: #000; }</style></defs><path class="st0" d="M0 0h40v40z"/>',
    ),
  )
  expect(safe).toContain('fill-rule="evenodd"')
  expect(safe).not.toContain('<style')
})
