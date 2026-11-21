import type { AvatarConfig } from '@/state/config'
import { releaseCanvas } from '@/lib/canvas'

export interface SmallAvatarImage {
  dataUrl: string
  /** 墨迹高度 / 中心圆裁直径；只是筛查，不是可读性认证。 */
  heights: number[]
  overflow: boolean
}

/** 先按原尺寸和编码参数导出，再由浏览器缩小、中心圆裁，避免小画布重新排版。 */
export async function renderSmallAvatar(config: AvatarConfig): Promise<SmallAvatarImage> {
  const [{ createExportArtifact }, { blobToDataUrl }, { layoutText }, { loadGraphic }] =
    await Promise.all([
      import('@/export/action'),
      import('@/export/share'),
      import('@/text/layout'),
      import('@/graphics/source'),
    ])
  const artifact = await createExportArtifact(config)
  try {
    const graphic = await loadGraphic(config.layout.icon)
    const { width, height } = artifact.canvas
    const layout = layoutText(config, width, height, undefined, graphic)
    return {
      dataUrl: await blobToDataUrl(artifact.blob),
      heights: layout.lines.map((line) => (line.ascent + line.descent) / Math.min(width, height)),
      overflow: layout.overflow,
    }
  } finally {
    releaseCanvas(artifact.canvas)
  }
}
