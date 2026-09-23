/**
 * 画布小工具：合成、编码与引擎离屏渲染三条链路都要新建、取上下文、释放画布，集中在这里。
 * 放在 lib 而不是 export：engine/render 也要用，让 engine 反向 import 装配层会把两目录接成环。
 * 画布属性的像素串 `cssPx` 也在这里，文字排版与字体两个目录共用。
 */

/** 可编码的画布来源，离屏画布在 worker 与新浏览器上都比 DOM 画布省一次合成。 */
export type EncodableCanvas = HTMLCanvasElement | OffscreenCanvas

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 2D 画布上下文')
  return ctx
}

/**
 * 把画布缩到 1×1 触发显存回收。导出 4096 时一张中间画布就是 64 MB，
 * 靠 GC 回收得太晚，移动端会直接崩。
 */
export function releaseCanvas(canvas: EncodableCanvas): void {
  canvas.width = 1
  canvas.height = 1
}

/** toBlob 与 convertToBlob 的统一 Promise 封装。 */
export function canvasToBlob(
  canvas: EncodableCanvas,
  type: string,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality })
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error(`画布编码失败：${type}`))
      },
      type,
      quality,
    )
  })
}

/** 把像素值写成合法 CSS 长度，canvas 的 font 与 letterSpacing 都收它；极小数不会被序列化成科学计数法。 */
export function cssPx(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${Math.round(safe * 1000) / 1000}px`
}
