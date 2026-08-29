import { canShareFiles, isWeChat, shareBlob } from '@/export/share'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ShareStub {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
  userAgent?: string
}

const patched: string[] = []

/** jsdom 的 navigator 没有 share / canShare，按用例现场装上。 */
function stubNavigator(stub: ShareStub): void {
  for (const [key, value] of Object.entries(stub)) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true })
    patched.push(key)
  }
}

function abortError(): Error {
  const error = new Error('用户取消')
  error.name = 'AbortError'
  return error
}

function pngBlob(): Blob {
  return new Blob(['x'], { type: 'image/png' })
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  for (const key of patched.splice(0)) {
    Reflect.deleteProperty(navigator, key)
  }
  vi.restoreAllMocks()
})

describe('canShareFiles', () => {
  it('没有 share 能力时为 false', () => {
    expect(canShareFiles()).toBe(false)
  })

  it('浏览器拒绝文件分享时为 false', () => {
    stubNavigator({ share: async () => {}, canShare: () => false })
    expect(canShareFiles()).toBe(false)
  })

  it('接受文件分享时为 true', () => {
    stubNavigator({ share: async () => {}, canShare: () => true })
    expect(canShareFiles()).toBe(true)
  })

  it('canShare 抛错时为 false', () => {
    stubNavigator({
      share: async () => {},
      canShare: () => {
        throw new Error('boom')
      },
    })
    expect(canShareFiles()).toBe(false)
  })
})

describe('shareBlob', () => {
  it('分享成功返回 shared，并带上文件与标题', async () => {
    const share = vi.fn(async (_data: ShareData) => {})
    stubNavigator({ share, canShare: () => true })

    const result = await shareBlob(pngBlob(), 'avatar_512x512.png', '渐变头像')

    expect(result).toBe('shared')
    const data = share.mock.calls[0]?.[0] as ShareData | undefined
    expect(data?.title).toBe('渐变头像')
    expect(data?.files?.[0]?.name).toBe('avatar_512x512.png')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('用户取消返回 cancelled，不改走下载', async () => {
    stubNavigator({
      share: async () => {
        throw abortError()
      },
      canShare: () => true,
    })

    const result = await shareBlob(pngBlob(), 'avatar_512x512.png', '渐变头像')

    expect(result).toBe('cancelled')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('不支持分享时回落下载并返回 downloaded', async () => {
    const result = await shareBlob(pngBlob(), 'avatar_512x512.png', '渐变头像')

    expect(result).toBe('downloaded')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
  })

  it('分享报错（非取消）时回落下载', async () => {
    stubNavigator({
      share: async () => {
        throw new Error('NotAllowedError')
      },
      canShare: () => true,
    })

    const result = await shareBlob(pngBlob(), 'avatar_512x512.png', '渐变头像')

    expect(result).toBe('downloaded')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })
})

describe('isWeChat', () => {
  it('识别微信内置浏览器的 UA', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.42',
    })
    expect(isWeChat()).toBe(true)
  })

  it('普通浏览器不算微信', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36' })
    expect(isWeChat()).toBe(false)
  })
})
