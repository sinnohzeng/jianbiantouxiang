/**
 * 本地字体上传：用 FontFace 直接注册二进制，不做轮廓解析。
 * 注册表放在模块级，loader 靠它判断某个 family 是不是已注册的上传字体。
 */

export const UPLOAD_FAMILY_SUFFIX = '-upload'
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024
export const UPLOAD_EXTENSIONS: readonly string[] = ['ttf', 'otf', 'woff', 'woff2']

export type FontUploadErrorCode =
  'unsupported-extension' | 'too-large' | 'unsupported-environment' | 'decode-failed'

/** 带 code 的错误，界面据此选 i18n 文案，不依赖 message 文本。 */
export class FontUploadError extends Error {
  readonly code: FontUploadErrorCode

  constructor(code: FontUploadErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'FontUploadError'
    this.code = code
  }
}

export interface UploadedFont {
  family: string
  fileName: string
  bytes: number
  face: FontFace
}

const registry = new Map<string, UploadedFont>()

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase()
}

/**
 * 文件名去扩展名后加后缀作为 family。
 * 引号、逗号与括号会破坏 CSS font-family 语法，先清掉；空名回落到固定名。
 */
export function uploadFamilyName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .replace(/["',();]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${base || 'font'}${UPLOAD_FAMILY_SUFFIX}`
}

export function getUploadedFont(family: string): UploadedFont | undefined {
  return registry.get(family)
}

export function listUploadedFonts(): UploadedFont[] {
  return [...registry.values()]
}

/** 清空注册表并从 document.fonts 摘除，供测试与“重置”入口使用。 */
export function clearUploadedFonts(): void {
  const set = globalThis.document?.fonts
  for (const item of registry.values()) {
    try {
      set?.delete(item.face)
    } catch {
      // 已被浏览器回收时忽略
    }
  }
  registry.clear()
}

/**
 * 校验并注册上传字体。同名重传按新文件覆盖，避免旧字形残留。
 * 校验失败抛 FontUploadError，调用方按 code 提示。
 */
export async function registerUploadedFont(file: File): Promise<{ family: string }> {
  const ext = extensionOf(file.name)
  if (!UPLOAD_EXTENSIONS.includes(ext)) {
    throw new FontUploadError(
      'unsupported-extension',
      `unsupported font extension: ${ext || '(none)'}`,
    )
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new FontUploadError('too-large', `font file exceeds ${MAX_UPLOAD_BYTES} bytes`)
  }

  const FontFaceCtor = globalThis.FontFace
  const set = globalThis.document?.fonts
  if (typeof FontFaceCtor !== 'function' || !set) {
    throw new FontUploadError('unsupported-environment', 'FontFace is unavailable')
  }

  const family = uploadFamilyName(file.name)
  const buffer = await file.arrayBuffer()

  let face: FontFace
  try {
    face = new FontFaceCtor(family, buffer)
    await face.load()
  } catch (cause) {
    throw new FontUploadError('decode-failed', cause instanceof Error ? cause.message : undefined)
  }

  const previous = registry.get(family)
  if (previous) {
    try {
      set.delete(previous.face)
    } catch {
      // 同 clearUploadedFonts
    }
  }
  set.add(face)
  registry.set(family, { family, fileName: file.name, bytes: file.size, face })
  return { family }
}
