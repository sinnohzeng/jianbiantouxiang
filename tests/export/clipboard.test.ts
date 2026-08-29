import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyImageToClipboard, supportsClipboardImage } from '@/export/clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyImageToClipboard', () => {
  it('不支持 ClipboardItem 时返回 false，不访问 clipboard', () => {
    const write = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { write } })

    expect(supportsClipboardImage()).toBe(false)
    void copyImageToClipboard(new Blob(['x'], { type: 'image/png' }))
    expect(write).not.toHaveBeenCalled()
  })

  it('把 Blob 交给 ClipboardItem 并写入一次', async () => {
    const write = vi.fn(async () => undefined)
    const constructed: Array<Record<string, Blob>> = []
    class FakeClipboardItem {
      constructor(data: Record<string, Blob>) {
        constructed.push(data)
      }
    }
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    const blob = new Blob(['x'], { type: 'image/png' })

    await expect(copyImageToClipboard(blob)).resolves.toBe(true)
    expect(constructed).toEqual([{ 'image/png': blob }])
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('写入失败时返回 false', async () => {
    const write = vi.fn(async () => {
      throw new Error('denied')
    })
    class FakeClipboardItem {
      constructor(_data: Record<string, Blob>) {}
    }
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)

    await expect(copyImageToClipboard(new Blob(['x']))).resolves.toBe(false)
  })
})
