/**
 * 导出抽屉：格式、体积档、设备上限提示与导出动作。
 * 手机能用系统分享就走分享面板（可以直接分享进微信设头像），否则回落下载；
 * 微信内置浏览器拦 a[download]，只把结果画成 img 让用户长按保存。
 */

import { useCallback, useEffect, useState } from 'react'
import { DownloadIcon, LinkIcon, Loader2Icon } from 'lucide-react'
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
import { getRenderCaps } from '@/engine/caps'
import { releaseCanvas } from '@/export/canvas'
import { composeAvatar } from '@/export/compose'
import { downloadBlob } from '@/export/download'
import { encodeCanvas, supportsWebP } from '@/export/encode'
import { buildFilename } from '@/export/filename'
import { canShareFiles, isWeChat, shareBlob } from '@/export/share'
import { useT } from '@/i18n'
import { SIZE_TARGETS, type AvatarConfig } from '@/state/config'
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

  const [webp, setWebp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void supportsWebP().then((ok) => {
      if (alive) setWebp(ok)
    })
    return () => {
      alive = false
    }
  }, [])

  // 换了新结果或组件卸载时释放上一张预览图占的 object URL
  useEffect(() => {
    const url = done?.previewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [done])

  const { width, height } = config.canvas
  const caps = getRenderCaps()
  const overCaps = caps.maxSize > 0 && caps.maxSize < Math.max(width, height)
  const isPng = config.exportOptions.format === 'png'

  const formatOptions: SegmentedOption<Format>[] = [
    { value: 'jpg', label: t('export.format.jpg') },
    { value: 'png', label: t('export.format.png') },
    ...(webp ? [{ value: 'webp' as const, label: t('export.format.webp') }] : []),
  ]

  const sizeOptions: SegmentedOption<SizeTarget>[] = SIZE_TARGETS.map((value) => ({
    value,
    label: t(`export.size.${value}`),
  }))

  const copyLink = useCallback(() => {
    flushConfigSync()
    const url = typeof window === 'undefined' ? '' : window.location.href
    void navigator.clipboard
      ?.writeText(url)
      .then(() => setNotice('common.copied'))
      .catch(() => setNotice('common.copyFailed'))
  }, [])

  const run = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    setDone(null)
    flushConfigSync()

    let canvas: HTMLCanvasElement | null = null
    try {
      // 自动底板由 composeAvatar 在读到像素之后自己补，这里不再预判
      canvas = await composeAvatar(config, width, height)
      const encoded = await encodeCanvas(canvas, config.exportOptions)
      const filename = buildFilename(config, config.exportOptions.format)

      let previewUrl: string | null = null
      if (isWeChat()) {
        previewUrl = URL.createObjectURL(encoded.blob)
        setNotice('export.wechat')
      } else if (canShareFiles()) {
        const result = await shareBlob(encoded.blob, filename, config.text)
        setNotice(`export.${result}`)
      } else {
        downloadBlob(encoded.blob, filename)
        setNotice('export.downloaded')
      }

      setDone({
        filename,
        bytes: encoded.blob.size,
        quality: encoded.quality,
        hitTarget: encoded.hitTarget,
        previewUrl,
      })
      pushHistory()
    } catch {
      setNotice('export.failed')
    } finally {
      if (canvas) releaseCanvas(canvas)
      setBusy(false)
    }
  }, [busy, config, height, pushHistory, width])

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{t('export.title')}</DrawerTitle>
          <DrawerDescription>{t('export.dimensions', { width, height })}</DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
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
            <div className="flex flex-col gap-2">
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
                  className="border-border w-full rounded-xl border"
                />
              ) : null}
            </div>
          ) : null}

          {notice ? (
            <p role="status" className="text-muted-foreground text-xs">
              {t(notice)}
            </p>
          ) : null}
        </div>

        <DrawerFooter className="gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" className="h-12 w-full" disabled={busy} onClick={() => void run()}>
            {busy ? (
              <Loader2Icon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <DownloadIcon aria-hidden="true" />
            )}
            {busy ? t('export.working') : t('export.title')}
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={copyLink}>
            <LinkIcon aria-hidden="true" />
            {t('export.copyLink')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
