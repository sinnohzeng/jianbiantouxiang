import type { AvatarConfig } from '@/state/config'
import { releaseCanvas } from './canvas'
import { composeAvatar } from './compose'
import { encodeCanvas, type EncodeResult } from './encode'
import { buildFilename } from './filename'

export interface ExportArtifact extends EncodeResult {
  canvas: HTMLCanvasElement
  filename: string
}

/** 合成并按用户配置编码，调用方负责释放返回的 canvas。 */
export async function createExportArtifact(config: AvatarConfig): Promise<ExportArtifact> {
  const { width, height } = config.canvas
  const canvas = await composeAvatar(config, width, height)
  try {
    const encoded = await encodeCanvas(canvas, config.exportOptions)
    return {
      ...encoded,
      canvas,
      filename: buildFilename(config, config.exportOptions.format),
    }
  } catch (error) {
    releaseCanvas(canvas)
    throw error
  }
}

/** 生成剪贴板专用的 PNG；内部释放画布，调用方只拿 Blob。 */
export async function createClipboardBlob(config: AvatarConfig): Promise<Blob> {
  const { width, height } = config.canvas
  const canvas = await composeAvatar(config, width, height)
  try {
    const encoded = await encodeCanvas(canvas, { ...config.exportOptions, format: 'png' })
    return encoded.blob
  } finally {
    releaseCanvas(canvas)
  }
}
