/**
 * 导出抽屉：画布尺寸与形状、格式、体积档、设备上限提示，
 * 加「下载」「复制图片」两个显式动作。
 *
 * 画布在这里而不在微调面板：画多大、什么形状、四周垫什么底色，
 * 三件都是「出什么文件」，跟格式与体积是同一类参数，分两处放只会让人来回找。
 * 微信内置浏览器拦 a[download]，长按也只认 http(s) 与 data: 地址，所以微信里固定出 JPG、
 * 转成 data URL 画成 img 让用户长按保存；格式选择在微信里不显示。
 *
 * 探测到不支持 WebP 编码时不止把选项摘掉，还要把配置里的 format 复位：
 * 存档里留着 format=webp 的话，换到不支持的浏览器会导出一个内容是 PNG 的 .webp。
 *
 * 出图成功时在结果区放一次粒子，预览框同时弹一下，与底栏两个随机同一套。
 */

import { useCallback, useEffect, useState } from 'react'
import { ClipboardCopyIcon, DownloadIcon, Loader2Icon } from 'lucide-react'
import { SegmentedControl, type SegmentedOption } from '@/components/blocks/segmented-control'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { CanvasFields } from '@/app/panels/CanvasFields'
import { getRenderCaps } from '@/engine/caps'
import { createClipboardBlob, createExportArtifact } from '@/export/action'
import { releaseCanvas } from '@/export/canvas'
import { copyImageToClipboard, supportsClipboardImage } from '@/export/clipboard'
import { downloadBlob } from '@/export/download'
import { supportsWebP } from '@/export/encode'
import { blobToDataUrl, isWeChat } from '@/export/share'
import { useT } from '@/i18n'
import { SIZE_TARGETS, type AvatarConfig } from '@/state/config'
import { queueHistoryThumbnail } from '@/app/history-thumb'
import { Ripple, useRipple } from '@/app/showcase/Ripple'
import { flushConfigSync, useAvatarStore } from '@/state/store'

export interface ExportDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Format = AvatarConfig['exportOptions']['format']
type SizeTarget = AvatarConfig['exportOptions']['sizeTarget']

interface Done {
  filename: string
  bytes: number
  quality: number
  hitTarget: boolean
  /** 微信里没法触发下载，只能把结果画出来让用户长按保存。 */
  previewUrl: string | null
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function ExportDrawer({ open, onOpenChange }: ExportDrawerProps) {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setExportOptions = useAvatarStore((state) => state.setExportOptions)
  const pushHistory = useAvatarStore((state) => state.pushHistory)

  // null 表示还没探测完，这时既不给 WebP 选项也不复位，免得白闪一下
  const [webp, setWebp] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // 出图成功时在结果区放一次粒子，预览框同时弹一下
  const burst = useRipple()
  const fireBurst = burst.fire

  useEffect(() => {
    let alive = true
    void supportsWebP().then((ok) => {
      if (!alive) return
      setWebp(ok)
      // toBlob 遇到不支持的 MIME 会静默改吐 PNG，留着 webp 就是一个扩展名对不上内容的文件
      if (!ok && useAvatarStore.getState().config.exportOptions.format === 'webp') {
        setExportOptions({ format: 'png' })
      }
    })
    return () => {
      alive = false
    }
  }, [setExportOptions])

  // 换了新结果或组件卸载时释放上一张预览图占的 object URL；微信里是 data URL，不用管
  useEffect(() => {
    const url = done?.previewUrl
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [done])

  const wechat = isWeChat()

  const { width, height } = config.canvas
  const caps = getRenderCaps()
  const overCaps = caps.maxSize > 0 && caps.maxSize < Math.max(width, height)
  const isPng = config.exportOptions.format === 'png'

  const formatOptions: SegmentedOption<Format>[] = [
    { value: 'jpg', label: t('export.format.jpg') },
    { value: 'png', label: t('export.format.png') },
    ...(webp === true ? [{ value: 'webp' as const, label: t('export.format.webp') }] : []),
  ]

  const sizeOptions: SegmentedOption<SizeTarget>[] = SIZE_TARGETS.map((value) => ({
    value,
    label: t(`export.size.${value}`),
  }))

  const run = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    setDone(null)
    flushConfigSync()

    let artifact: Awaited<ReturnType<typeof createExportArtifact>> | null = null
    try {
      // 微信相册只认图片本身，扩展名无所谓；安卓微信对 PNG 的 base64 长按保存不稳定，固定出 JPG
      artifact = await createExportArtifact(
        wechat ? { ...config, exportOptions: { ...config.exportOptions, format: 'jpg' } } : config,
      )

      let previewUrl: string | null = null
      if (wechat) {
        previewUrl = await blobToDataUrl(artifact.blob)
        setNotice('export.wechat')
      } else {
        downloadBlob(artifact.blob, artifact.filename)
        setNotice('export.downloaded')
      }

      setDone({
        filename: artifact.filename,
        bytes: artifact.blob.size,
        quality: artifact.quality,
        hitTarget: artifact.hitTarget,
        previewUrl,
      })
      pushHistory()
      queueHistoryThumbnail()
      fireBurst()
    } catch {
      setNotice('export.failed')
    } finally {
      if (artifact) releaseCanvas(artifact.canvas)
      setBusy(false)
    }
  }, [busy, config, fireBurst, pushHistory, wechat])

  const copyImage = useCallback(async () => {
    if (busy) return
    if (!supportsClipboardImage()) {
      setNotice('export.copyUnsupported')
      return
    }

    setBusy(true)
    setNotice(null)
    setDone(null)
    flushConfigSync()
    try {
      // Promise 必须在用户手势内交给 ClipboardItem，Safari 才允许稍后完成合成
      const copied = await copyImageToClipboard(createClipboardBlob(config))
      setNotice(copied ? 'export.copySuccess' : 'export.copyFailed')
      if (copied) {
        pushHistory()
        queueHistoryThumbnail()
      }
    } catch {
      setNotice('export.copyFailed')
    } finally {
      setBusy(false)
    }
  }, [busy, config, pushHistory])

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{t('export.title')}</DrawerTitle>
          <DrawerDescription>{t('export.dimensions', { width, height })}</DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
          <CanvasFields />

          {wechat ? null : (
            <div className="flex flex-col gap-1.5">
              <Label>{t('export.format')}</Label>
              <SegmentedControl<Format>
                name="export-format"
                label={t('export.format')}
                value={config.exportOptions.format}
                options={formatOptions}
                onChange={(format) => setExportOptions({ format })}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t('export.size')}</Label>
            <SegmentedControl<SizeTarget>
              name="export-size-target"
              label={t('export.size')}
              value={config.exportOptions.sizeTarget}
              options={sizeOptions}
              disabled={isPng}
              onChange={(sizeTarget) => setExportOptions({ sizeTarget })}
            />
            {isPng ? (
              <p className="text-muted-foreground text-xs">{t('export.format.pngHint')}</p>
            ) : null}
          </div>

          {overCaps ? (
            <p className="text-muted-foreground text-xs">
              {t('export.caps', { size: caps.maxSize })}
            </p>
          ) : null}

          {done ? (
            <div data-slot="export-result" className="relative flex flex-col gap-2">
              <Ripple token={burst.token} className="rounded-xl" />
              <p className="text-sm">{t('export.done', { name: done.filename })}</p>
              <p className="text-muted-foreground text-xs">
                {t('export.result', {
                  size: formatBytes(done.bytes),
                  quality: done.quality.toFixed(2),
                })}
              </p>
              {done.hitTarget ? null : (
                <p className="text-muted-foreground text-xs">{t('export.tooLarge')}</p>
              )}
              {done.previewUrl ? (
                <img
                  src={done.previewUrl}
                  alt={t('export.preview')}
                  data-slot="export-image"
                  className="border-border w-full rounded-xl border select-auto"
                  // 微信与 iOS 的长按菜单靠 touch-callout，抽屉里别被全局样式关掉
                  style={{ WebkitTouchCallout: 'default' }}
                />
              ) : null}
            </div>
          ) : null}

          {notice ? (
            <p role="status" data-slot="export-notice" className="text-muted-foreground text-xs">
              {t(notice)}
            </p>
          ) : null}
        </div>

        <DrawerFooter className="grid gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-2">
          <Button
            type="button"
            data-slot="export-run"
            className="h-12 w-full"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? (
              <Loader2Icon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <DownloadIcon aria-hidden="true" />
            )}
            {busy ? t('export.working') : t('export.download')}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-slot="export-copy"
            className="h-12 w-full"
            disabled={busy}
            onClick={() => void copyImage()}
          >
            {busy ? (
              <Loader2Icon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <ClipboardCopyIcon aria-hidden="true" />
            )}
            {t('export.copyImage')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
