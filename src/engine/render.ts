/**
 * 离屏渲染：把一份配置画成指定像素尺寸的 2D 画布，供导出与缩略图使用。
 * 调用方拿到画布后自行释放。
 */

import { ShaderMount } from '@paper-design/shaders'
import type { AvatarConfig } from '@/state/config'
import { getRenderCaps } from './caps'
import { resolveColors } from './colors'
import { fallbackLayers, rgba } from './css-fallback'
import { applyFilmGrain } from './film-grain'
import { ensureNoiseTexture } from './noise-texture'
import { planRender } from './styles'
import { resolveSeed } from './seed'

/** 等待 ResizeObserver 把画布尺寸定下来的上限。 */
const SIZE_TIMEOUT_MS = 2000

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(finish)
    // 后台标签页里 rAF 会停摆，用定时器兜住
    setTimeout(finish, 32)
  })
}

/**
 * 容器放在可视区外但保持真实布局尺寸：ShaderMount 靠 ResizeObserver 定画布像素，
 * display:none 或零尺寸会让它画出 0×0。
 */
function createOffscreenContainer(width: number, height: number): HTMLDivElement {
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-100000px'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.pointerEvents = 'none'
  container.style.overflow = 'hidden'
  document.body.appendChild(container)
  return container
}

async function waitForCanvasSize(canvas: HTMLCanvasElement, expected: number): Promise<void> {
  const deadline = Date.now() + SIZE_TIMEOUT_MS
  while (canvas.width !== expected && Date.now() < deadline) {
    await nextTick()
  }
}

/** 无 WebGL2 时的 2D 近似，与 CSS 兜底同源同种子，构图一致。 */
function paintFallback(
  ctx: CanvasRenderingContext2D,
  config: AvatarConfig,
  colors: readonly string[],
  width: number,
  height: number,
): void {
  ctx.fillStyle = rgba(colors[0] ?? '#c7d2fe', 1)
  ctx.fillRect(0, 0, width, height)

  for (const layer of fallbackLayers(config, colors)) {
    const radiusX = (layer.radiusX / 100) * width
    const radiusY = (layer.radiusY / 100) * height
    if (radiusX <= 0 || radiusY <= 0) continue

    ctx.save()
    ctx.translate((layer.x / 100) * width, (layer.y / 100) * height)
    ctx.scale(1, radiusY / radiusX)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX)
    gradient.addColorStop(0, rgba(layer.color, layer.alpha))
    gradient.addColorStop(1, rgba(layer.color, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(-width * 2, -height * 2, width * 4, height * 4)
    ctx.restore()
  }
}

/**
 * 渲染一张 width×height 的渐变底图。目标超过设备上限时按上限渲染再放大，
 * 因此任何尺寸都能出图，只是超限部分损失锐度。
 */
export async function renderGradient(
  config: AvatarConfig,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const outWidth = Math.max(1, Math.round(width))
  const outHeight = Math.max(1, Math.round(height))

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('renderGradient: 拿不到 2D 上下文')

  const colors = resolveColors(config)
  const caps = getRenderCaps()
  const plan = planRender(config, colors)

  if (!caps.webgl2) {
    paintFallback(ctx, config, colors, outWidth, outHeight)
    return canvas
  }

  const limit = Math.max(64, caps.maxSize)
  const shrink = Math.min(1, limit / Math.max(outWidth, outHeight))
  const renderWidth = Math.max(1, Math.round(outWidth * shrink))
  const renderHeight = Math.max(1, Math.round(outHeight * shrink))

  const uniforms = { ...plan.uniforms }
  if (plan.needsNoiseTexture) {
    const texture = await ensureNoiseTexture()
    if (texture) uniforms.u_noiseTexture = texture
  }

  const container = createOffscreenContainer(renderWidth, renderHeight)
  let mount: ShaderMount | null = null
  try {
    mount = new ShaderMount(
      container,
      plan.fragmentShader,
      uniforms,
      { preserveDrawingBuffer: true, antialias: false },
      0,
      plan.frame,
      // 容器每 1 CSS px 对应 1 个目标像素，maxPixelCount 再把设备像素比抵掉，
      // 得到的画布正好是 renderWidth × renderHeight
      1,
      renderWidth * renderHeight,
    )
    await waitForCanvasSize(mount.canvasElement, renderWidth)
    // frame 决定静态画面，显式再渲一次保证拿到的是这一帧
    mount.setFrame(plan.frame)

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(mount.canvasElement, 0, 0, outWidth, outHeight)
  } catch {
    paintFallback(ctx, config, colors, outWidth, outHeight)
  } finally {
    mount?.dispose()
    container.remove()
  }

  if (!plan.hasShaderGrain) {
    applyFilmGrain(ctx, outWidth, outHeight, config.styleParams.grain, resolveSeed(config))
  }

  return canvas
}
