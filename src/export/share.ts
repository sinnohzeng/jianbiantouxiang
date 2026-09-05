/** 微信内置浏览器拦截 a[download]，只能提示用户长按图片保存。 */
export function isWeChat(): boolean {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent)
}
