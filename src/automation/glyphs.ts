import unicode from '@fontsource/noto-sans-sc/unicode.json'

const ranges = Object.values(unicode).flatMap((group) =>
  group.split(',').map((range) => {
    const [start, end] = range.replace(/^U\+/i, '').split('-')
    return [parseInt(start ?? '', 16), parseInt(end ?? start ?? '', 16)] as const
  }),
)

/** Explicitly report missing bundled glyphs instead of silently drawing a system tofu box. */
export function unsupportedCharacters(text: string): string[] {
  return [...new Set([...text])].filter((char) => {
    const cp = char.codePointAt(0) ?? 0
    return !ranges.some(([start, end]) => cp >= start && cp <= end)
  })
}
