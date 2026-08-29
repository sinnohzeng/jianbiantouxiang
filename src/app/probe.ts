/**
 * 端到端测试用的探针。
 *
 * 预览那张 WebGL 画布没开 preserveDrawingBuffer，读回来是空的，Playwright 没法直接断言画面；
 * 导出走的又是 Web Share 或下载，产物不一定落到文件系统。所以这里把合成与编码这两段
 * 挂到 window 上让测试直接调，走的是与真实导出完全相同的那条链路。
 *
 * 只在开发模式或 URL 带 ?probe=1 时装：main.tsx 用 import() 引，生产 chunk 里没有它，
 * 也没有任何产品代码引用 window.__gradientAvatarProbe。
 */

import { releaseCanvas } from '@/export/canvas'
import { composeAvatar } from '@/export/compose'
import { encodeCanvas } from '@/export/encode'
import { useAvatarStore } from '@/state/store'

/** 统计用的默认边长。够看出画面有没有内容，又不至于让软件渲染跑很久。 */
const STATS_SIZE = 192

/** 颜色去重时的采样步长（像素）。整张图逐点入集合太慢，也没必要。 */
const SAMPLE_STEP = 4

export interface ProbePixelStats {
  width: number
  height: number
  /** alpha 大于 0 的像素数。形状遮罩之外是透明的，所以它小于总像素数属正常。 */
  opaque: number
  /** 采样后的去重颜色数。1 表示一整张平色，说明 shader 没画出来。 */
  colors: number
}

export interface ProbeEncodeResult {
  /** blob 的 MIME，jpg 应当是 image/jpeg。 */
  type: string
  bytes: number
  quality: number
  hitTarget: boolean
}

export interface GradientAvatarProbe {
  /** 按当前配置合成一张小图并统计像素。 */
  stats(size?: number): Promise<ProbePixelStats>
  /** 按当前配置合成并编码，返回产物的类型与体积。 */
  encode(size?: number): Promise<ProbeEncodeResult>
}

declare global {
  interface Window {
    __gradientAvatarProbe?: GradientAvatarProbe
  }
}

async function stats(size = STATS_SIZE): Promise<ProbePixelStats> {
  const config = useAvatarStore.getState().config
  const canvas = await composeAvatar(config, size, size)
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('probe: 拿不到 2D 上下文')
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let opaque = 0
    const seen = new Set<number>()
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] ?? 0) > 0) opaque += 1
      if ((i / 4) % SAMPLE_STEP !== 0) continue
      seen.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0))
    }
    return { width: canvas.width, height: canvas.height, opaque, colors: seen.size }
  } finally {
    releaseCanvas(canvas)
  }
}

async function encode(size?: number): Promise<ProbeEncodeResult> {
  const config = useAvatarStore.getState().config
  const width = size ?? config.canvas.width
  const height = size ?? config.canvas.height
  const canvas = await composeAvatar(config, width, height)
  try {
    const result = await encodeCanvas(canvas, config.exportOptions)
    return {
      type: result.blob.type,
      bytes: result.blob.size,
      quality: result.quality,
      hitTarget: result.hitTarget,
    }
  } finally {
    releaseCanvas(canvas)
  }
}

export function installProbe(): void {
  window.__gradientAvatarProbe = { stats, encode }
}
