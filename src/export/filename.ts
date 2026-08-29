import type { AvatarConfig } from '@/state/config'

/** Windows、macOS 与各家网盘的文件名禁用字符并集。 */
const ILLEGAL_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
/** 取够识别就行，太长的名字在手机下载列表里会被截成一串省略号。 */
const MAX_CHARS = 12
const FALLBACK = 'avatar'

function isDroppable(ch: string): boolean {
  if (ILLEGAL_CHARS.has(ch)) return true
  // 空白（含换行）留在文件名里既难看又容易被下载器改写
  if (/\s/.test(ch)) return true
  const code = ch.codePointAt(0) ?? 0
  return code < 0x20 || code === 0x7f
}

/**
 * 生成 `<文字>_<宽>x<高>.<扩展名>`。文字里的非法字符与空白直接删掉，
 * 清空后回落到 avatar，保证任何输入都能得到一个可落盘的名字。
 */
export function buildFilename(config: AvatarConfig, ext: string): string {
  // 按码点切分，避免把 emoji 与增补平面汉字劈成半个代理对
  const cleaned = [...config.text]
    .slice(0, MAX_CHARS)
    .filter((ch) => !isDroppable(ch))
    .join('')
    // 首尾的点会让 macOS 当成隐藏文件、让 Windows 直接拒收
    .replace(/^\.+|\.+$/g, '')
  const stem = cleaned || FALLBACK
  const suffix = ext.replace(/^\./, '').toLowerCase() || 'png'
  return `${stem}_${config.canvas.width}x${config.canvas.height}.${suffix}`
}
