/**
 * 画布小工具：合成与编码两条链路都要新建、编码、释放画布，集中在这里。
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
