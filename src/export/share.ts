import { downloadBlob } from './download'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** 微信内置浏览器拦截 a[download]，只能提示用户长按图片保存。 */
export function isWeChat(): boolean {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent)
}

/**
 * 能否用 Web Share 分享文件。canShare 要拿一个真实 File 试，
 * 光有 navigator.share 不代表接受 files（桌面 Chrome 就是这种）。
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function')
    return false
  try {
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  )
}

/**
 * 优先走系统分享面板（手机上可以直接分享进微信设头像），
 * 不支持或分享失败就回落到下载；用户主动取消不算失败。
 */
export async function shareBlob(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  if (!canShareFiles()) {
    downloadBlob(blob, filename)
    return 'downloaded'
  }

  const file = new File([blob], filename, { type: blob.type })
  if (!navigator.canShare({ files: [file] })) {
    downloadBlob(blob, filename)
    return 'downloaded'
  }

  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    if (isAbort(error)) return 'cancelled'
    downloadBlob(blob, filename)
    return 'downloaded'
  }
}
