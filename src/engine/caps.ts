/**
 * 设备渲染上限探测。手机的 WebGL 上限常低于 4096，2D 画布还有独立的面积上限，
 * 导出前必须按两者的较小值限幅，再靠 drawImage 放大。
 */

export interface RenderCaps {
  webgl2: boolean
  /** 单边最大原生渲染像素，已同时考虑 WebGL 与 2D 画布。 */
  maxSize: number
}

const CACHE_KEY = 'gradient-avatar:caps:v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** SSR 与探测全失败时的保守值，1024 的两倍，够覆盖默认导出尺寸。 */
const CONSERVATIVE_MAX_SIZE = 2048

/** 2D 画布面积从大到小试，命中即止。 */
const PROBE_SIZES = [8192, 4096, 2048, 1024, 512] as const

interface CachedCaps extends RenderCaps {
  t: number
}

let memoryCache: RenderCaps | null = null

function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function'
}

function readCache(): RenderCaps | null {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { webgl2, maxSize, t } = parsed as Partial<CachedCaps>
    if (typeof webgl2 !== 'boolean' || typeof maxSize !== 'number' || typeof t !== 'number')
      return null
    if (!Number.isFinite(maxSize) || maxSize < 256) return null
    if (Date.now() - t > CACHE_TTL_MS) return null
    return { webgl2, maxSize }
  } catch {
    return null
  }
}

function writeCache(caps: RenderCaps): void {
  try {
    const payload: CachedCaps = { ...caps, t: Date.now() }
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // 隐私模式下 localStorage 会抛，探测结果留在内存里即可
  }
}

/** 返回 WebGL 上限，无 WebGL2 时返回 0。 */
function probeWebGL(): number {
  if (!hasDom()) return 0
  let canvas: HTMLCanvasElement | null = null
  try {
    canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const gl = canvas.getContext('webgl2')
    if (!gl) return 0
    const renderbuffer = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
    const texture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    const limits = [renderbuffer, texture].filter((value) => Number.isFinite(value) && value > 0)
    return limits.length > 0 ? Math.min(...limits) : 0
  } catch {
    return 0
  } finally {
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}

/** 画一个像素再读回来，能读到不透明像素才算这个尺寸真的分配成功。 */
function probeCanvas2D(): number {
  if (!hasDom()) return 0
  for (const size of PROBE_SIZES) {
    let canvas: HTMLCanvasElement | null = null
    try {
      canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1, 1)
      const pixel = ctx.getImageData(0, 0, 1, 1).data
      if ((pixel[3] ?? 0) > 0) return size
    } catch {
      // 该尺寸分配失败，继续试更小的
    } finally {
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    }
  }
  return 0
}

/** 探测结果按内存与 localStorage 两级缓存，7 天后重探。 */
export function getRenderCaps(): RenderCaps {
  if (memoryCache) return memoryCache

  const cached = readCache()
  if (cached) {
    memoryCache = cached
    return cached
  }

  if (!hasDom()) {
    return { webgl2: false, maxSize: CONSERVATIVE_MAX_SIZE }
  }

  const webglMax = probeWebGL()
  const canvasMax = probeCanvas2D()
  const limits = [webglMax, canvasMax].filter((value) => value > 0)
  const caps: RenderCaps = {
    webgl2: webglMax > 0,
    maxSize: limits.length > 0 ? Math.min(...limits) : CONSERVATIVE_MAX_SIZE,
  }

  memoryCache = caps
  writeCache(caps)
  return caps
}

export function hasWebGL2(): boolean {
  return getRenderCaps().webgl2
}

/** 清缓存重探，供测试与设备状态变化后调用。 */
export function resetRenderCaps(): void {
  memoryCache = null
  try {
    globalThis.localStorage?.removeItem(CACHE_KEY)
  } catch {
    // 同 writeCache
  }
}

/**
 * 探测说有 WebGL2 但运行期真建不出上下文时复核一次。
 * 只重探 WebGL 这一半：2D 面积探测要一路试到 8192²，很贵，也与这次失败无关。
 * 复核仍然失败就把缓存改成不支持，下次进页面直接走兜底并给出提示，
 * 而不是继续拿七天前的探测结果当真。返回复核后 WebGL2 是否仍可用。
 */
export function revalidateWebGL2(): boolean {
  if (probeWebGL() > 0) return true
  const maxSize = memoryCache?.maxSize ?? readCache()?.maxSize ?? CONSERVATIVE_MAX_SIZE
  const caps: RenderCaps = { webgl2: false, maxSize }
  memoryCache = caps
  writeCache(caps)
  return false
}
