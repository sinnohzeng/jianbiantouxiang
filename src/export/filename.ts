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

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 设备本地时区的秒级时间戳 `YYYYMMDD-HHmmss`。
 * 同一内容连续导出多张时文件名互不覆盖；导出本身耗时超一秒，同秒重名接受。
 */
function timestamp(now: Date): string {
  return (
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  )
}

/**
 * 生成 `<文字>_<宽>x<高>_<时间戳>.<扩展名>`。文字里的非法字符与空白直接删掉，
 * 清空后回落到 avatar，保证任何输入都能得到一个可落盘的名字。
 * `now` 供测试注入固定时刻，线上取设备本地时间。
 */
export function buildFilename(config: AvatarConfig, ext: string, now: Date = new Date()): string {
  // 顺序按 spec §3.5：先清洗再截断。反过来的话被删掉的空白与非法字符
  // 会白占 12 个名额，“AI 研究院 2026 年度”只剩前半截，全是空格时更是直接退化成 avatar。
  // 按码点切分，避免把 emoji 与增补平面汉字劈成半个代理对
  const cleaned = [...config.text]
    .filter((ch) => !isDroppable(ch))
    .slice(0, MAX_CHARS)
    .join('')
    // 首尾的点会让 macOS 当成隐藏文件、让 Windows 直接拒收
    .replace(/^\.+|\.+$/g, '')
  const stem = cleaned || FALLBACK
  const suffix = ext.replace(/^\./, '').toLowerCase() || 'png'
  return `${stem}_${config.canvas.width}x${config.canvas.height}_${timestamp(now)}.${suffix}`
}
