import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider, LOCALE_STORAGE_KEY } from '@/i18n'
import { SmallAvatarPreview } from '@/app/SmallAvatarPreview'
import { renderSmallAvatar, type SmallAvatarImage } from '@/app/small-avatar-image'
import { DEFAULT_CONFIG } from '@/state/config'
import { useAvatarStore } from '@/state/store'

vi.mock('@/app/small-avatar-image', () => ({ renderSmallAvatar: vi.fn() }))
const image = { dataUrl: 'data:image/png;base64,AAAA', heights: [0.16, 0.1], overflow: false }
beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
  useAvatarStore.setState({ config: DEFAULT_CONFIG, past: [], future: [] })
  vi.mocked(renderSmallAvatar).mockReset().mockResolvedValue(image)
})
afterEach(cleanup)
function open() {
  render(
    <I18nProvider>
      <SmallAvatarPreview />
    </I18nProvider>,
  )
  expect(renderSmallAvatar).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '小头像效果' }))
}
it('失败可重试；默认 48px，隐藏副行仅修改文字并可撤销', async () => {
  vi.mocked(renderSmallAvatar).mockRejectedValueOnce(new Error('render'))
  open()
  await screen.findByRole('alert', {}, { timeout: 2000 })
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await screen.findByText('第二行在这个尺寸下可能不易辨认。', {}, { timeout: 2000 })
  expect(screen.getByRole('button', { name: '48px' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '64px' }))
  expect(screen.queryByText('第二行在这个尺寸下可能不易辨认。')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '隐藏第二行（可撤销）' }))
  expect(useAvatarStore.getState().config.text).toBe('工作新习惯')
  expect(useAvatarStore.getState().config.typography).toEqual(DEFAULT_CONFIG.typography)
  act(() => useAvatarStore.getState().undo())
  expect(useAvatarStore.getState().config).toEqual(DEFAULT_CONFIG)
})
it('配置改变立即撤下旧图；在途旧结果不可覆盖新配置', async () => {
  let resolve!: (value: SmallAvatarImage) => void
  vi.mocked(renderSmallAvatar).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  open()
  await waitFor(() => expect(renderSmallAvatar).toHaveBeenCalledTimes(1), { timeout: 2000 })
  act(() => useAvatarStore.getState().setConfig({ text: '更新' }))
  await act(async () => resolve({ ...image, dataUrl: 'old' }))
  expect(document.querySelectorAll('[data-slot="small-avatar-image"]')).toHaveLength(0)
  await waitFor(
    () => expect(document.querySelectorAll('[data-slot="small-avatar-image"]')).toHaveLength(3),
    { timeout: 2000 },
  )
  expect(document.querySelector('img')?.getAttribute('src')).toBe(image.dataUrl)
  act(() => useAvatarStore.getState().setConfig({ text: '再次更新' }))
  expect(document.querySelectorAll('[data-slot="small-avatar-image"]')).toHaveLength(0)
})
