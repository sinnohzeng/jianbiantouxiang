import { expect, it } from 'vitest'
import { selectInk, luminance, contrastRatio } from '@/automation/contrast'
import { unsupportedCharacters } from '@/automation/glyphs'

it('chooses readable ink against the actual background, not the palette label', () => {
  const context = (value: number) =>
    ({
      canvas: { width: 100, height: 100 },
      getImageData: () => ({ data: [value, value, value, 255] }),
    }) as unknown as CanvasRenderingContext2D
  expect(selectInk(context(240), [{ x: 0, y: 0, width: 100, height: 100 }]).color).toBe('#141413')
  expect(selectInk(context(20), [{ x: 0, y: 0, width: 100, height: 100 }]).color).toBe('#ffffff')
  expect(contrastRatio(luminance(0, 0, 0), luminance(255, 255, 255))).toBe(21)
})

it('reports unsupported bundled glyphs explicitly', () => {
  expect(unsupportedCharacters('研发 Design')).toEqual([])
  expect(unsupportedCharacters(String.fromCodePoint(0x10ffff))).toHaveLength(1)
})
