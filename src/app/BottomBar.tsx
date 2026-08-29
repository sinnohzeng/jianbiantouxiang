/**
 * 主操作条。手机上固定在屏幕底部并让出 safe-area，桌面上就是面板列底部的一行。
 * 触控目标一律 44 px 起，尺寸档参考 `@reactbits-pro/mobile-4`。
 *
 * 四个控件在 320 px 的日文界面下排不开（随机 98 + 箭头 44 + 复制 44 + 导出 112 加间距超出屏宽），
 * 所以按钮都允许收缩、文案 truncate，宽松的最小宽度只在桌面档给。
 */

import { useCallback } from 'react'
import { ChevronUpIcon, DownloadIcon, Link2Icon, ShuffleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/app/clipboard'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { flushConfigSync, useAvatarStore } from '@/state/store'
import { buildShareUrl } from '@/state/url'

export function BottomBar() {
  const t = useT()
  const randomize = useAvatarStore((state) => state.randomize)
  const randomizeAll = useAvatarStore((state) => state.randomizeAll)
  const pushHistory = useAvatarStore((state) => state.pushHistory)
  const setUi = useAvatarStore((state) => state.setUi)

  const onShuffle = useCallback(() => {
    randomize()
    pushHistory()
  }, [randomize, pushHistory])

  const onShuffleAll = useCallback(() => {
    randomizeAll()
    pushHistory()
  }, [randomizeAll, pushHistory])

  const onCopyLink = useCallback(() => {
    // 先把当前配置落进 URL，再复制，别让用户拿到上一版的链接
    flushConfigSync()
    const url = buildShareUrl(useAvatarStore.getState().config)
    void copyText(url).then((ok) => {
      if (ok) toast.success(t('common.copied'))
      else toast.error(t('common.copyFailed'))
    })
  }, [t])

  const onExport = useCallback(() => {
    setUi({ exportOpen: true })
  }, [setUi])

  return (
    <div
      role="group"
      data-slot="bottom-bar"
      aria-label={t('bottombar.actions')}
      className={cn(
        'bg-background/85 supports-[backdrop-filter]:bg-background/70 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md',
        'safe-bottom lg:static lg:rounded-b-2xl lg:border-t lg:bg-transparent lg:pb-0 lg:backdrop-blur-none',
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3 lg:h-auto lg:px-3 lg:py-3">
        <div className="flex min-w-0 items-stretch">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onShuffle}
            title={t('bottombar.random.hint')}
            className="tap-target min-w-0 shrink rounded-r-none pr-2"
          >
            <ShuffleIcon aria-hidden />
            <span className="truncate">{t('bottombar.random')}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('bottombar.randomAll')}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'tap-target border-background/60 rounded-l-none border-l px-2',
              )}
            >
              <ChevronUpIcon className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-auto min-w-52">
              <DropdownMenuItem onClick={onShuffle} className="min-h-11 gap-2 px-2">
                <ShuffleIcon className="size-4" aria-hidden />
                {t('bottombar.random')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShuffleAll} className="min-h-11 gap-2 px-2">
                <ShuffleIcon className="size-4" aria-hidden />
                {t('bottombar.randomAll')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          data-slot="copy-link-action"
          onClick={onCopyLink}
          aria-label={t('bottombar.copyLink')}
          title={t('bottombar.copyLink')}
          className="tap-target"
        >
          <Link2Icon aria-hidden />
        </Button>

        <Button
          type="button"
          size="lg"
          data-slot="export-action"
          onClick={onExport}
          className="tap-target ml-auto min-w-0 flex-1 lg:min-w-28 lg:flex-none"
        >
          <DownloadIcon aria-hidden />
          <span className="truncate">{t('bottombar.export')}</span>
        </Button>
      </div>
    </div>
  )
}
