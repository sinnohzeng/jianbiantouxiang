/**
 * 预览用的挂载封装：把 ShaderMount 的生命周期收敛成 update 与 dispose 两个动作。
 * speed 传 0，画面完全由 uniforms 与 frame 决定，不占 rAF。
 *
 * ShaderMount 与 shader 源码都按需下载，所以内部的 apply 是异步的。
 * 一轮没跑完时 update 只记下最新配置并置脏位，跑完再补一次，请求不会积压成队列。
 * 无 WebGL2 的 CSS 兜底走同步分支，挂载当帧就有画面。
 */

import type { ShaderMount } from '@paper-design/shaders'
import type { AvatarConfig, StyleId } from '@/state/config'
import { getRenderCaps } from './caps'
import { resolveColors } from './colors'
import { cssFallbackBackground } from './css-fallback'
import { ensureNoiseTexture, loadedNoiseTexture } from './noise-texture'
import { planRender } from './styles'

export interface GradientMount {
  update(config: AvatarConfig): void
  dispose(): void
}

/** 预览不需要导出那么大的画布，4K 两倍像素比封顶即可。 */
const PREVIEW_MAX_PIXELS = 1920 * 1080 * 4

export function createGradientMount(container: HTMLElement, config: AvatarConfig): GradientMount {
  const caps = getRenderCaps()
  const maxPixelCount = Math.min(caps.maxSize * caps.maxSize, PREVIEW_MAX_PIXELS)

  let current = config
  let mount: ShaderMount | null = null
  let mountedStyle: StyleId | null = null
  let disposed = false
  let running = false
  let dirty = false

  function showFallback(colors: readonly string[]): void {
    container.style.background = cssFallbackBackground(current, colors)
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
        return
      }
      uniforms.u_noiseTexture = texture
    }

    // shader 换了就得重建程序，uniform 名字整套都不一样
    if (mount && mountedStyle !== plan.style) {
      mount.dispose()
      mount = null
      mountedStyle = null
    }

    if (mount) {
      mount.setUniforms(uniforms)
      mount.setFrame(plan.frame)
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
    } catch {
      showFallback(colors)
    }
  }

  function apply(): void {
    if (disposed) return

    if (!caps.webgl2) {
      showFallback(resolveColors(current))
      return
    }

    if (running) {
      dirty = true
      return
    }
    running = true
    void render()
      .catch(() => {
        if (!disposed) showFallback(resolveColors(current))
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
      mount?.dispose()
      mount = null
      mountedStyle = null
      container.style.background = ''
    },
  }
}
