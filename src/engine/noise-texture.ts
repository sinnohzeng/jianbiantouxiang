/**
 * warp 与 grainGradient 用包内自带的噪声贴图作随机源。
 * ShaderMount 在图片没解码完时直接抛错，所以挂载前必须先把它等到位。
 *
 * 贴图是一张内联进包的 base64 图片，二十多 KB，跟着首屏走不值当，因此走 import()。
 */

let pending: Promise<HTMLImageElement | undefined> | null = null
let loaded: HTMLImageElement | undefined

function decode(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => resolve(), { once: true })
  })
}

/** 解码完成后才 resolve；失败时给 undefined，由调用方决定降级。 */
export function ensureNoiseTexture(): Promise<HTMLImageElement | undefined> {
  if (loaded) return Promise.resolve(loaded)
  if (pending) return pending

  pending = import('./shader-noise')
    .then(async ({ getShaderNoiseTexture }) => {
      const image = getShaderNoiseTexture()
      if (!image) return undefined
      await decode(image)
      return image.complete && image.naturalWidth > 0 ? image : undefined
    })
    .catch(() => undefined)
    .then((image) => {
      loaded = image
      return image
    })
  return pending
}

/** 同步取已解码的贴图，挂载路径据此判断能不能马上建 ShaderMount。 */
export function loadedNoiseTexture(): HTMLImageElement | undefined {
  return loaded
}
