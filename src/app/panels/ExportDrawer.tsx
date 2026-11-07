/** 导出面板外壳常驻；内容按需加载，首次打开也经过 closed → open。 */
import { lazy, Suspense } from 'react'
import { Loader2Icon } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ErrorBoundary } from '@/app/error-boundary'
import { useAvatarStore } from '@/state/store'
import { useT } from '@/i18n'

const ExportControlsLazy = lazy(() =>
  import('./ExportControls').then((module) => ({ default: module.ExportControls })),
)

export interface ExportDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportDrawer({ open, onOpenChange }: ExportDrawerProps) {
  const t = useT()
  const canvas = useAvatarStore((state) => state.config.canvas)
  const mounted = useAvatarStore((state) => state.ui.exportMounted)
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="mx-auto h-[min(48rem,calc(100dvh-6rem))] max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{t('export.title')}</DrawerTitle>
          <DrawerDescription>
            {t('export.dimensions', { width: canvas.width, height: canvas.height })}
          </DrawerDescription>
        </DrawerHeader>
        <ErrorBoundary
          fallback={
            <p role="alert" className="p-4">
              {t('export.loadFailed')}
            </p>
          }
        >
          <Suspense
            fallback={
              <div role="status" className="flex flex-1 items-center justify-center gap-2 p-4">
                <Loader2Icon
                  aria-hidden
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
                {t('export.loading')}
              </div>
            }
          >
            {open || mounted ? <ExportControlsLazy /> : null}
          </Suspense>
        </ErrorBoundary>
      </DrawerContent>
    </Drawer>
  )
}
