import unicode from '@fontsource/noto-sans-sc/unicode.json'
import serifUnicode from '@fontsource/noto-serif-sc/unicode.json'

const fontRanges = (unicode: Record<string, string>) =>
  Object.values(unicode).flatMap((group) =>
    group.split(',').map((range) => {
      const [start, end] = range.replace(/^U\+/i, '').split('-')
      return [parseInt(start ?? '', 16), parseInt(end ?? start ?? '', 16)] as const
    }),
  )

/** Explicitly report missing bundled glyphs instead of silently drawing a system tofu box. */
const sans = fontRanges(unicode),
  serif = fontRanges(serifUnicode)
export function unsupportedCharacters(text: string, font: 'sans' | 'serif' = 'sans'): string[] {
  const ranges = font === 'serif' ? serif : sans
  return [...new Set([...text])].filter((char) => {
    const cp = char.codePointAt(0) ?? 0
    return !ranges.some(([start, end]) => cp >= start && cp <= end)
  })
}
