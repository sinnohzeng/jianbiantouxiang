import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@/state/config'
import { createExportArtifact } from '@/export/action'
const mocks = vi.hoisted(() => ({ compose: vi.fn(), encode: vi.fn(), release: vi.fn() }))
vi.mock('@/export/compose', () => ({ composeAvatar: mocks.compose }))
vi.mock('@/export/encode', () => ({ encodeCanvas: mocks.encode }))
vi.mock('@/lib/canvas', () => ({ releaseCanvas: mocks.release }))
afterEach(() => vi.resetAllMocks())
it('WebP 回退 PNG 时文件后缀与实际内容匹配', async () => {
  const canvas = {}
  mocks.compose.mockResolvedValue(canvas)
  mocks.encode.mockResolvedValue({
    blob: new Blob(['png'], { type: 'image/png' }),
    quality: 1,
    hitTarget: true,
  })
  const result = await createExportArtifact({
    ...DEFAULT_CONFIG,
    exportOptions: { ...DEFAULT_CONFIG.exportOptions, format: 'webp' },
  })
  expect(result.filename).toMatch(/\.png$/)
  expect(result.canvas).toBe(canvas)
  expect(mocks.release).not.toHaveBeenCalled()
})
it('编码失败时释放合成画布', async () => {
  const canvas = {}
  mocks.compose.mockResolvedValue(canvas)
  mocks.encode.mockRejectedValue(new Error('encoder failed'))
  await expect(createExportArtifact(DEFAULT_CONFIG)).rejects.toThrow('encoder failed')
  expect(mocks.release).toHaveBeenCalledWith(canvas)
})
