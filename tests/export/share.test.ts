import { blobToDataUrl, isWeChat } from '@/export/share'
import { afterEach, describe, expect, it } from 'vitest'

const patched: string[] = []

/** 按用例现场改 userAgent。 */
function stubUserAgent(userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
    writable: true,
  })
  patched.push('userAgent')
}

afterEach(() => {
  for (const key of patched.splice(0)) {
    Reflect.deleteProperty(navigator, key)
  }
})

describe('isWeChat', () => {
  it('识别微信内置浏览器的 UA', () => {
    stubUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.42',
    )
    expect(isWeChat()).toBe(true)
  })

  it('普通浏览器不算微信', () => {
    stubUserAgent('Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36')
    expect(isWeChat()).toBe(false)
  })
})

describe('blobToDataUrl', () => {
  it('把 Blob 读成带 MIME 的 data URL', async () => {
    const url = await blobToDataUrl(new Blob(['hi'], { type: 'image/jpeg' }))
    expect(url).toBe('data:image/jpeg;base64,aGk=')
  })
})
