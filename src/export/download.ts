/** 立刻 revoke 会让部分浏览器（Safari、微信内置）还没读到数据就断流。 */
const REVOKE_DELAY_MS = 1000

/** 用一次性的 object URL 触发浏览器下载，用完释放。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
