/**
 * 手机端“长按图片直接存”的那张图。
 *
 * 触屏浏览器的长按保存只认真正的 <img>，而且微信只接受 http(s) 与 data: 地址，
 * blob: 会保存失败。所以预览稳定之后在后台按导出管线合成一张 JPG，转成 data URL 盖在预览上，
 * 用户长按它就走系统的保存图片，不必先点导出再在抽屉里长按。
 *
 * 生成不便宜（合成加编码），所以去抖、页面不可见时不排、新配置来了旧结果作废。
 */

import { useEffect, useRef, useState } from 'react'
import { createExportArtifact } from '@/export/action'
import { releaseCanvas } from '@/export/canvas'
import { blobToDataUrl } from '@/export/share'
import type { AvatarConfig } from '@/state/config'

/** 预览停稳多久才开始合成。手速再快也不会连着触发一串编码。 */
export const SAVE_IMAGE_DEBOUNCE_MS = 600

export interface SaveImageSchedulerOptions {
  /** 把配置合成成 data URL。真实实现是导出管线，测试里换成桩。 */
  render: (config: AvatarConfig) => Promise<string>
  /** 出图后回调；只有最后一次请求的结果会送到这里。 */
  onImage: (dataUrl: string) => void
  /** 页面在后台就不排任务，回到前台由调用方重新 request。 */
  isHidden?: () => boolean
  delayMs?: number
  /** 定时器注入口，测试里换成假时钟。 */
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface SaveImageScheduler {
  /** 请求为这份配置出图。重复调用只有最后一次算数。 */
  request: (config: AvatarConfig) => void
  /** 丢弃待办与在途结果。 */
  dispose: () => void
}

export function createSaveImageScheduler(options: SaveImageSchedulerOptions): SaveImageScheduler {
  const {
    render,
    onImage,
    isHidden = () => typeof document !== 'undefined' && document.hidden,
    delayMs = SAVE_IMAGE_DEBOUNCE_MS,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options

  let timer: unknown = null
  // 每次请求换一张票，在途的旧任务回来时票对不上就丢掉
  let ticket = 0
  let disposed = false

  const request = (config: AvatarConfig): void => {
    if (disposed) return
    if (timer !== null) clearTimer(timer)
    ticket += 1
    const mine = ticket
    timer = setTimer(() => {
      timer = null
      if (disposed || mine !== ticket || isHidden()) return
      void render(config)
        .then((dataUrl) => {
          if (!disposed && mine === ticket) onImage(dataUrl)
        })
        .catch(() => {
          // 合成失败就保持上一张，长按存到旧图也比按不出菜单强
        })
    }, delayMs)
  }

  const dispose = (): void => {
    disposed = true
    ticket += 1
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  return { request, dispose }
}

/**
 * 预览上那张可长按保存的 JPG。触屏才生成，桌面返回 null。
 *
 * 配置每变一次就重新排一张；页面切到后台不排，回到前台补一张。
 */
export function usePreviewSaveImage(config: AvatarConfig, enabled: boolean): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const schedulerRef = useRef<SaveImageScheduler | null>(null)

  useEffect(() => {
    if (!enabled) return
    const scheduler = createSaveImageScheduler({
      render: async (next) => {
        // 相册只认图片内容，扩展名无所谓；JPG 在各家长按保存里最稳
        const artifact = await createExportArtifact({
          ...next,
          exportOptions: { ...next.exportOptions, format: 'jpg' },
        })
        try {
          return await blobToDataUrl(artifact.blob)
        } finally {
          releaseCanvas(artifact.canvas)
        }
      },
      onImage: setDataUrl,
    })
    schedulerRef.current = scheduler
    return () => {
      schedulerRef.current = null
      scheduler.dispose()
      // 关掉时把上一张丢掉：桌面窗口下不该留着一张盖住实时预览的静态图
      setDataUrl(null)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    schedulerRef.current?.request(config)
  }, [config, enabled])

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    const onVisible = (): void => {
      if (!document.hidden) schedulerRef.current?.request(config)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [config, enabled])

  return dataUrl
}
