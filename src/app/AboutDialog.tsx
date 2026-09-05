/**
 * 关于对话框：简介、版本号与源码链接。
 *
 * 版本号由 vite define 从 package.json 的 version 构建期注入，跟发布不会脱节。
 * 恢复默认在操作条的「更多」菜单里，带一次确认：调乱了的人第一反应是去底栏找，
 * 不是先点开关于。
 */

import { BrandMark } from '@/app/BrandMark'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useT } from '@/i18n'

const REPO_URL = 'https://github.com/sinnohzeng/jianbiantouxiang'

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BrandMark className="size-11 shrink-0 drop-shadow-sm" />
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate">{t('app.name')}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {t('about.version')} {__APP_VERSION__}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>{t('app.slogan')}</DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground text-sm leading-6">{t('about.intro')}</p>

        <div className="flex items-center justify-end gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.23.87 1.23.87.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.36-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.56.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            {t('topbar.github')}
          </a>
        </div>
        <p className="text-muted-foreground text-xs">{t('about.license')}</p>
      </DialogContent>
    </Dialog>
  )
}
