import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePreviewSaveImage, SAVE_IMAGE_DEBOUNCE_MS } from '@/app/preview-save-image'
import { DEFAULT_CONFIG } from '@/state/config'

const exportImage = vi.hoisted(() => vi.fn())
vi.mock('@/export/action', () => ({ createExportArtifact: exportImage }))
vi.mock('@/export/share', () => ({ blobToDataUrl: async (blob: string) => blob }))
vi.mock('@/lib/canvas', () => ({ releaseCanvas: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('改配置立即移除旧保存图，失败时保持实时画布，最新图完成后才覆盖', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  exportImage.mockResolvedValueOnce({ blob: 'first', canvas: {} })
  const { result, rerender } = renderHook(({ config }) => usePreviewSaveImage(config, true), {
    initialProps: { config: DEFAULT_CONFIG },
  })
  await act(() => vi.advanceTimersByTimeAsync(SAVE_IMAGE_DEBOUNCE_MS))
  expect(result.current).toBe('first')
  exportImage.mockRejectedValueOnce(new Error('encode failed'))
  rerender({ config: { ...DEFAULT_CONFIG, text: '新文字' } })
  expect(result.current).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(SAVE_IMAGE_DEBOUNCE_MS))
  expect(result.current).toBeNull()
  exportImage.mockResolvedValueOnce({ blob: 'latest', canvas: {} })
  rerender({ config: { ...DEFAULT_CONFIG, text: '最终文字' } })
  await act(() => vi.advanceTimersByTimeAsync(SAVE_IMAGE_DEBOUNCE_MS))
  expect(result.current).toBe('latest')
})
