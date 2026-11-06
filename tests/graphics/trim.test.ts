import { expect, it } from 'vitest'
import { alphaBounds } from '@/graphics/trim'

it('透明留白不占布局空间，保留黑白和仅有 1/255 透明度的笔画', () => {
  const data = new Uint8ClampedArray(12 * 8 * 4)
  data[(2 * 12 + 1) * 4 + 3] = 255
  data.set([255, 255, 255, 1], (4 * 12 + 10) * 4)
  expect(alphaBounds(data, 12, 8)).toEqual({ x: 1, y: 2, width: 10, height: 3 })
})
it('不透明白底不被当作透明留白删除', () => {
  expect(alphaBounds(new Uint8ClampedArray(4 * 3 * 4).fill(255), 4, 3)).toEqual({
    x: 0,
    y: 0,
    width: 4,
    height: 3,
  })
})
it('全透明图返回空结果', () => {
  expect(alphaBounds(new Uint8ClampedArray(4 * 3 * 4), 4, 3)).toBeNull()
})
