/** Illustrator 常见的简单类上色规则转为属性；不执行或保留 CSS。 */
const PAINT = new Set([
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
])

export function inlineSafeClassStyles(document: Document): void {
  const elements = [...document.querySelectorAll('*')]
  if (elements.length > 2000) throw new Error('SVG exceeds 2000 elements')
  for (const style of elements.filter((node) => node.localName === 'style')) {
    const css = (style.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
    if (css.length > 16_384) throw new Error('SVG stylesheet too large')
    let rest = css.trim(),
      count = 0
    while (rest) {
      const rule = /^(\.[\w-]+(?:\s*,\s*\.[\w-]+)*)\s*\{([^{}]*)\}\s*/.exec(rest)
      if (!rule || ++count > 64) throw new Error('SVG supports simple paint classes only')
      const names = (rule[1] ?? '').split(',').map((name) => name.trim().slice(1))
      const declarations = (rule[2] ?? '')
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean)
      for (const declaration of declarations) {
        const pair = /^([a-z-]+)\s*:\s*([#a-zA-Z0-9.,%+\s-]+)$/.exec(declaration)
        if (!pair || !PAINT.has(pair[1] ?? '')) throw new Error('SVG paint declaration unsupported')
        const property = pair[1] ?? '',
          value = (pair[2] ?? '').trim()
        for (const node of elements)
          if (names.some((name) => node.classList.contains(name)))
            node.setAttribute(property, value)
      }
      rest = rest.slice(rule[0].length).trim()
    }
    style.remove()
  }
}
