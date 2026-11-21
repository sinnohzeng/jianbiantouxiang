import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useT } from '@/i18n'
import { twoLinesOf, type AvatarConfig } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { getUploadedFontRevision, subscribeUploadedFonts } from '@/fonts/upload'
import { createSaveImageScheduler } from '@/app/preview-save-image'
import { renderSmallAvatar, type SmallAvatarImage } from '@/app/small-avatar-image'

type Result = { image: SmallAvatarImage } | { error: true }

function SmallAvatarContent({ onAdjust }: { onAdjust: () => void }) {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const [size, setSize] = useState(48)
  const [retry, setRetry] = useState(0)
  const revision = useSyncExternalStore(subscribeUploadedFonts, getUploadedFontRevision)
  const [done, setDone] = useState<{
    config: AvatarConfig
    revision: number
    result: Result
    retry: number
  } | null>(null)
  const schedulerRef = useRef<ReturnType<typeof createSaveImageScheduler> | null>(null)
  useEffect(() => {
    const scheduler = createSaveImageScheduler<Result>({
      render: async (next) => {
        try {
          return { image: await renderSmallAvatar(next) }
        } catch {
          return { error: true }
        }
      },
      onImage: (result, rendered) => setDone({ config: rendered, revision, result, retry }),
    })
    schedulerRef.current = scheduler
    return () => {
      scheduler.dispose()
      schedulerRef.current = null
    }
  }, [revision, retry])
  useEffect(() => {
    const request = () => schedulerRef.current?.request(config)
    request()
    document.addEventListener('visibilitychange', request)
    return () => document.removeEventListener('visibilitychange', request)
  }, [config, revision, retry])
  const result =
    done?.config === config && done.revision === revision && done.retry === retry
      ? done.result
      : null
  const image = result && 'image' in result ? result.image : null
  const [first, second] = twoLinesOf(config.text)
  const primarySmall = image && (image.heights[0] ?? 1) * size < 6
  const secondarySmall = image && image.heights.slice(1).some((height) => height * size < 6)
  return (
    <>
      <div className="grid grid-cols-3 gap-2" data-slot="small-avatar-sizes">
        {[32, 48, 64].map((value) => (
          <Button
            key={value}
            variant={size === value ? 'secondary' : 'ghost'}
            className="h-auto min-h-32 min-w-0 flex-col gap-3 px-1 py-3"
            aria-pressed={size === value}
            onClick={() => setSize(value)}
          >
            <span className="flex h-16 items-center justify-center" aria-hidden>
              {image ? (
                <img
                  src={image.dataUrl}
                  alt=""
                  data-slot="small-avatar-image"
                  className="shrink-0 rounded-full object-cover object-center"
                  style={{ width: value, height: value }}
                />
              ) : (
                <span className="bg-muted rounded-full" style={{ width: value, height: value }} />
              )}
            </span>
            {value}px
          </Button>
        ))}
      </div>
      {!result ? (
        <p role="status" className="text-muted-foreground">
          {t('smallAvatar.loading')}
        </p>
      ) : 'error' in result ? (
        <div role="alert">
          <p>{t('smallAvatar.failed')}</p>
          <Button
            className="mt-2 min-h-11"
            variant="outline"
            onClick={() => setRetry((n) => n + 1)}
          >
            {t('smallAvatar.retry')}
          </Button>
        </div>
      ) : (
        <>
          {image?.overflow ? <p className="text-destructive">{t('preview.overflow')}</p> : null}
          {primarySmall ? (
            <p className="text-muted-foreground" data-slot="small-avatar-risk">
              {t('smallAvatar.primaryRisk')}
            </p>
          ) : secondarySmall ? (
            <p className="text-muted-foreground" data-slot="small-avatar-risk">
              {t('smallAvatar.secondaryRisk')}
            </p>
          ) : null}
        </>
      )}
      {first && second ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" onClick={onAdjust}>
            {t('smallAvatar.adjust')}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setConfig({ text: first })}>
            {t('smallAvatar.hide')}
          </Button>
        </div>
      ) : null}
      <DialogClose render={<Button variant="outline" className="min-h-11" />}>
        {t('smallAvatar.close')}
      </DialogClose>
    </>
  )
}

export function SmallAvatarPreview() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const adjustFocus = useRef(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" className="min-h-11 text-xs" data-slot="small-avatar-open" />
        }
        onClick={() => {
          adjustFocus.current = false
        }}
      >
        {t('smallAvatar.title')}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        finalFocus={() => {
          if (!adjustFocus.current) return true
          const target = document.querySelector<HTMLElement>('[data-slot="text-line2-size"]')
          target?.scrollIntoView({ block: 'center', behavior: 'instant' })
          return target ?? true
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('smallAvatar.title')}</DialogTitle>
          <DialogDescription>{t('smallAvatar.description')}</DialogDescription>
        </DialogHeader>
        {open ? (
          <SmallAvatarContent
            onAdjust={() => {
              adjustFocus.current = true
              setOpen(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
