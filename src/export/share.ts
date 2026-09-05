/**
 * 微信内置浏览器的两条限制：拦截 a[download]，长按只能保存 http(s) 或 data: 地址的图片，
 * blob: 地址的图片长按会报“保存失败”（安卓尤其如此）。所以微信里把结果转成 data URL 再画成 img。
 */

export function isWeChat(): boolean {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent)
}

/** Blob 转 data URL，给微信长按保存用；失败时 reject，由调用方决定怎么提示。 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读不出图片数据'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读不出图片数据'))
    reader.readAsDataURL(blob)
  })
}
