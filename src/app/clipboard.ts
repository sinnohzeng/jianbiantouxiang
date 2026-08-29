/**
 * 复制到剪贴板。
 *
 * `navigator.clipboard` 在非安全上下文与部分内置浏览器里是 undefined，
 * 写成 `navigator.clipboard?.writeText(x).then().catch()` 会整条链短路，
 * then 与 catch 一起跳过，调用方于是一个字的反馈都给不出来。
 * 所以统一收在这里：任何失败都回 false，由调用方决定怎么提示。
 */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 权限被拒或非安全上下文，落到下面的 false
  }
  return false
}
