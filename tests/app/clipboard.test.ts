/**
 * 复制 helper：任何一条失败路径都要回 false，调用方才有得提示。
 * 原来的写法是 `navigator.clipboard?.writeText(x).then().catch()`，
 * 剪贴板 API 不存在时整条链短路，then 与 catch 一起跳过，界面上一个字都不会变。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '@/app/clipboard'

function stubClipboard(value: unknown): void {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value,
    configurable: true,
  })
}

afterEach(() => {
  stubClipboard(undefined)
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('写成功回 true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    await expect(copyText('https://example.test/#c=1')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://example.test/#c=1')
  })

  it('非安全上下文里没有 clipboard，回 false 而不是静默', async () => {
    stubClipboard(undefined)
    await expect(copyText('x')).resolves.toBe(false)
  })

  it('权限被拒也回 false', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    await expect(copyText('x')).resolves.toBe(false)
  })
})
