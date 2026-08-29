/**
 * 预览用的挂载封装：把 ShaderMount 的生命周期收敛成 update 与 dispose 两个动作。
 * speed 传 0，画面完全由 uniforms 与 frame 决定，不占 rAF。
 *
 * ShaderMount 与 shader 源码都按需下载，所以内部的 apply 是异步的。
 * 一轮没跑完时 update 只记下最新配置并置脏位，跑完再补一次，请求不会积压成队列。
 * 无 WebGL2 的 CSS 兜底走同步分支，挂载当帧就有画面。
 *
 * 两件在预览里容易被忽略的事也归这里：
 * silk 的颗粒不在 shader 里，得另叠一张 2D 画布，否则拖颗粒滑杆预览毫无反应；
 * 上下文被浏览器判掉之后 setUniforms 是静默 no-op，得监听、重建并把降级原因报上去。
 */

import type { ShaderMount } from '@paper-design/shaders'
import type { AvatarConfig, StyleId } from '@/state/config'
import { getRenderCaps, revalidateWebGL2 } from './caps'
import { resolveColors } from './colors'
import { cssFallbackBackground } from './css-fallback'
import type { FallbackOptions, FallbackReason } from './fallback'
import { notifyFallback } from './fallback'
import { applyFilmGrain } from './film-grain'
import { releaseGlCanvas } from './gl-context'
import { ensureNoiseTexture, loadedNoiseTexture } from './noise-texture'
import { resolveSeed } from './seed'
import { getStyle, planRender } from './styles'

export interface GradientMount {
  update(config: AvatarConfig): void
  dispose(): void
}

/** 预览不需要导出那么大的画布，4K 两倍像素比封顶即可。 */
const PREVIEW_MAX_PIXELS = 1920 * 1080 * 4

/** 颗粒层的像素比上限，与 PreviewStage 的两张 2D 画布对齐。 */
const MAX_GRAIN_DPR = 2

/** 上下文被判掉后自动重建的次数上限，超了就停在 CSS 近似上，免得反复重建把上下文耗光。 */
const CONTEXT_RETRY_LIMIT = 2

/** GPU 进程刚崩时立刻重建多半还是失败，隔一会儿再试。 */
const CONTEXT_RETRY_DELAY_MS = 300

export function createGradientMount(
  container: HTMLElement,
  config: AvatarConfig,
  options: FallbackOptions = {},
): GradientMount {
  const caps = getRenderCaps()
  const maxPixelCount = Math.min(caps.maxSize * caps.maxSize, PREVIEW_MAX_PIXELS)

  let current = config
  let webgl2 = caps.webgl2
  let mount: ShaderMount | null = null
  let mountedStyle: StyleId | null = null
  let grainCanvas: HTMLCanvasElement | null = null
  let disposed = false
  let running = false
  let dirty = false
  let retries = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let reported: FallbackReason | null = null

  /** 同一个原因只报一次，挂载成功后清零，再降级才会再报。 */
  function report(reason: FallbackReason): void {
    // 回落只通告一次。几种原因对用户是同一件事，拿到的都是近似图，
    // 建不出来之后每次改参数再报一遍 no-webgl2 就成了噪声。
    // 成功挂载会把 reported 归零，之后再失败仍会重新通告。
    if (reported !== null) return
    reported = reason
    notifyFallback(options, reason)
  }

  function showFallback(colors: readonly string[]): void {
    container.style.background = cssFallbackBackground(current, colors)
  }

  function removeGrainLayer(): void {
    if (!grainCanvas) return
    grainCanvas.remove()
    grainCanvas.width = 1
    grainCanvas.height = 1
    grainCanvas = null
  }

  /**
   * silk 没有颗粒 uniform，导出那份由 render.ts 在 2D 阶段补，预览这层补的是同一份。
   * 混合走 CSS 的 mix-blend-mode: overlay，与导出那次 overlay 合成等价，
   * 所以画布本身只按 alpha 铺一层噪声图，不在画布内做混合。
   */
  function paintGrainLayer(): void {
    if (disposed) return
    const amount = current.styleParams.grain
    if (getStyle(current.style).hasShaderGrain || amount <= 0) {
      removeGrainLayer()
      return
    }

    const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_GRAIN_DPR)
    const width = Math.round(container.clientWidth * dpr)
    const height = Math.round(container.clientHeight * dpr)
    if (width < 1 || height < 1) {
      removeGrainLayer()
      return
    }

    if (!grainCanvas) {
      const canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      canvas.dataset.slot = 'preview-grain'
      // 行内样式，不依赖 @paper-design/shaders 注入的那段画布样式：兜底路径下它不存在
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.zIndex = '0'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.borderRadius = 'inherit'
      canvas.style.pointerEvents = 'none'
      canvas.style.mixBlendMode = 'overlay'
      container.append(canvas)
      grainCanvas = canvas
    }

    // 赋宽高即清空画布，不必另外 clearRect
    grainCanvas.width = width
    grainCanvas.height = height
    const ctx = grainCanvas.getContext('2d')
    if (!ctx) {
      removeGrainLayer()
      return
    }
    applyFilmGrain(ctx, width, height, amount, resolveSeed(current))
  }

  /** 画框尺寸变了颗粒层要跟着重画，否则拉伸出来的颗粒会变粗。 */
  const boxObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          paintGrainLayer()
        })
      : null
  boxObserver?.observe(container)

  /**
   * 上下文被浏览器判掉后 setUniforms 与 setFrame 都是静默 no-op，画面停在最后一帧，
   * 不监听就没人知道预览已经不跟配置走了。ShaderMount 自己也不做恢复，
   * 所以这里直接重建一个新的，比在旧画布上等 restore 再补建 program 可靠。
   */
  function handleContextLost(): void {
    if (disposed) return
    releaseMount()
    showFallback(resolveColors(current))
    paintGrainLayer()
    report('context-lost')
    if (retries >= CONTEXT_RETRY_LIMIT) return
    retries += 1
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      apply()
    }, CONTEXT_RETRY_DELAY_MS)
  }

  function releaseMount(): void {
    const active = mount
    mount = null
    mountedStyle = null
    if (!active) return
    const canvas = active.canvasElement
    // 摘监听要在主动丢上下文之前，否则自己触发的那次 lost 会被当成浏览器判掉
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    active.dispose()
    releaseGlCanvas(canvas)
  }

  /**
   * 已挂载且不用等贴图时，这个函数在第一个 return 之前是同步执行的，
   * 拖滑杆的常规路径仍然是一次 setUniforms，没有多余的一帧延迟。
   */
  async function render(): Promise<void> {
    const colors = resolveColors(current)
    const plan = planRender(current, colors)

    const uniforms = { ...plan.uniforms }
    if (plan.needsNoiseTexture) {
      const texture = loadedNoiseTexture() ?? (await ensureNoiseTexture())
      if (disposed) return
      if (!texture) {
        showFallback(colors)
        paintGrainLayer()
        report('mount-failed')
        return
      }
      uniforms.u_noiseTexture = texture
    }

    // shader 换了就得重建程序，uniform 名字整套都不一样
    if (mount && mountedStyle !== plan.style) releaseMount()

    if (mount) {
      mount.setUniforms(uniforms)
      mount.setFrame(plan.frame)
      paintGrainLayer()
      return
    }

    const [{ ShaderMount: Ctor }, fragmentShader] = await Promise.all([
      import('./shader-mount'),
      plan.loadFragmentShader(),
    ])
    if (disposed) return

    try {
      mount = new Ctor(
        container,
        fragmentShader,
        uniforms,
        undefined,
        0,
        plan.frame,
        2,
        maxPixelCount,
      )
      mountedStyle = plan.style
      container.style.background = ''
      reported = null
      mount.canvasElement.addEventListener('webglcontextlost', handleContextLost)
    } catch {
      mount = null
      mountedStyle = null
      // 构造函数先把画布塞进容器再取上下文，失败时那张空画布会留在这里
      for (const stale of [...container.querySelectorAll('canvas')]) {
        if (stale !== grainCanvas) stale.remove()
      }
      // 探测说有 WebGL2 却建不出来：复核一次，确认没有就别再重试，也让下次进页面有提示
      if (!revalidateWebGL2()) webgl2 = false
      showFallback(colors)
      report('mount-failed')
    }
    paintGrainLayer()
  }

  function apply(): void {
    if (disposed) return

    if (!webgl2) {
      showFallback(resolveColors(current))
      paintGrainLayer()
      report('no-webgl2')
      return
    }

    if (running) {
      dirty = true
      return
    }
    running = true
    void render()
      .catch(() => {
        if (disposed) return
        showFallback(resolveColors(current))
        paintGrainLayer()
        report('mount-failed')
      })
      .finally(() => {
        running = false
        if (disposed || !dirty) return
        dirty = false
        apply()
      })
  }

  apply()

  return {
    update(next: AvatarConfig): void {
      if (disposed) return
      current = next
      apply()
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      dirty = false
      if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      boxObserver?.disconnect()
      releaseMount()
      removeGrainLayer()
      container.style.background = ''
    },
  }
}
