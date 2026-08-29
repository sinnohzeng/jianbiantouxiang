/** 判断当前环境能否写入图片剪贴板；不支持时由界面给显式失败提示。 */
export function supportsClipboardImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  )
}

/**
 * 写入 PNG 图片剪贴板。
 *
 * `blob` 可以是 Promise：Safari 要求 ClipboardItem 在用户手势内同步创建，
 * 画布合成耗时较长时必须把 Promise 本身交给 ClipboardItem，不能先 await 成 Blob。
 */
export async function copyImageToClipboard(blob: Blob | Promise<Blob>): Promise<boolean> {
  if (!supportsClipboardImage()) return false
  try {
    const item = new ClipboardItem({ 'image/png': blob })
    await navigator.clipboard.write([item])
    return true
  } catch {
    return false
  }
}
