/**
 * WebGL 画布的显式释放。
 *
 * @paper-design/shaders 的 dispose 只删 program 与贴图，既不丢上下文也不缩画布，
 * 上下文与绘图缓冲要等画布被 GC 才还给浏览器。浏览器对同时活着的上下文数有硬上限，
 * 顶到上限就强制判掉一个已有的，页面上常驻的预览正是最容易被判掉的那个。
 * 所以用完即弃的离屏渲染都得在这里显式还回去，caps.ts 的探测画布也是这么做的。
 */

/** 丢掉画布持有的 WebGL 上下文，并把画布缩到 1×1 触发显存回收。 */
export function releaseGlCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return
  try {
    const lose = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context') as
      WEBGL_lose_context | null | undefined
    lose?.loseContext()
  } catch {
    // 宿主没有 WebGL 或上下文已经没了，缩画布这一步照样要做
  }
  canvas.width = 1
  canvas.height = 1
}
