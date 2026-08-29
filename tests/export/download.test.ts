import { downloadBlob } from '@/export/download'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** jsdom 不会真的下载，这里把 object URL 与点击都换成可观测的桩。 */
function setup() {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url')
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const clicked: { anchor: HTMLAnchorElement | null; connected: boolean } = {
    anchor: null,
    connected: false,
  }
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.anchor = this
    clicked.connected = this.isConnected
  })
  return { createObjectURL, revokeObjectURL, click, clicked }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('downloadBlob', () => {
  it('用 object URL 触发一次点击', () => {
    const { createObjectURL, click } = setup()
    const blob = new Blob(['x'], { type: 'image/jpeg' })

    downloadBlob(blob, '猪猪家族_1024x1024.jpg')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('点击时锚点在文档里，带着文件名，点完就移除', () => {
    const { clicked } = setup()

    downloadBlob(new Blob(['x']), 'avatar_512x512.png')

    expect(clicked.connected).toBe(true)
    expect(clicked.anchor?.download).toBe('avatar_512x512.png')
    expect(clicked.anchor?.href).toBe('blob:fake-url')
    expect(clicked.anchor?.isConnected).toBe(false)
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('延迟释放 object URL，点击当下不释放', () => {
    const { revokeObjectURL } = setup()

    downloadBlob(new Blob(['x']), 'avatar_512x512.png')

    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
