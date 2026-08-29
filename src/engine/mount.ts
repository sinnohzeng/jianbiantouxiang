/**
 * 预览用的挂载封装：把 ShaderMount 的生命周期收敛成 update 与 dispose 两个动作。
 * speed 传 0，画面完全由 uniforms 与 frame 决定，不占 rAF。
 */

import { ShaderMount } from '@paper-design/shaders'
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
  let textureRequested = false
  let textureFailed = false

  function showFallback(colors: readonly string[]): void {
    container.style.background = cssFallbackBackground(current, colors)
  }

  function apply(): void {
    if (disposed) return

    const colors = resolveColors(current)
    const plan = planRender(current, colors)

    if (!caps.webgl2) {
      showFallback(colors)
      return
    }

    const texture = loadedNoiseTexture()
    if (plan.needsNoiseTexture && !texture) {
      if (textureFailed) {
        showFallback(colors)
        return
      }
      if (!textureRequested) {
        textureRequested = true
        void ensureNoiseTexture().then((loaded) => {
          textureFailed = !loaded
          apply()
        })
      }
      return
    }

    const uniforms = { ...plan.uniforms }
    if (plan.needsNoiseTexture && texture) uniforms.u_noiseTexture = texture

    // shader 换了就得重建程序，uniform 名字整套都不一样
    if (mount && mountedStyle !== plan.style) {
      mount.dispose()
      mount = null
      mountedStyle = null
    }

    if (!mount) {
      try {
        mount = new ShaderMount(
          container,
          plan.fragmentShader,
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
      return
    }

    mount.setUniforms(uniforms)
    mount.setFrame(plan.frame)
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
      mount?.dispose()
      mount = null
      mountedStyle = null
      container.style.background = ''
    },
  }
}
