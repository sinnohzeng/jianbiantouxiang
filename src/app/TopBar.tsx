/**
 * 顶栏：品牌、备案号、撤销重做、最近生成、语言、设置、关于。
 *
 * 最近生成跟撤销重做放在一起：三个都是“回到刚才那一版”，同一类动作就该同一处落点。
 * 缩略图条是懒加载的，点开过一次才拉那份 chunk。
 * 设置齿轮收主题三档、两个预览参考层与恢复默认：它们都是记在本机、跨会话生效的偏好，
 * 不是对着画面的动作，放在操作条里会跟“换一版”“导出”混成一堆。
 * 半透明加模糊的悬浮壳借 `@shadcnblocks/navbar6` 的写法，让它压在环境光晕上不显得生硬。
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import {
  CheckIcon,
  ContrastIcon,
  Grid3x3Icon,
  HistoryIcon,
  InfoIcon,
  LanguagesIcon,
  MoonIcon,
  Redo2Icon,
  RotateCcwIcon,
  ScanIcon,
  SettingsIcon,
  SunIcon,
  Undo2Icon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ErrorBoundary } from '@/app/error-boundary'
import { HistoryStripLazy } from '@/app/panels/lazy'
import { BrandMark } from '@/app/BrandMark'
import { BrandTitle } from '@/app/showcase/BrandTitle'
import { usePreviewOverlays } from '@/app/preview-overlays'
import { THEME_MODES, useTheme, type ThemeMode } from '@/app/theme'
import { LOCALES, useLocale, useT, type Locale } from '@/i18n'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'

/**
 * 「跟随系统」用一枚半明半暗的圆，不用显示器。
 * 显示器画的是设备，读出来是「屏幕设置」；这一档要说的是「深浅由系统定」，
 * 主流做法（GitHub、Notion、Raycast 都是这一路）是一个左右各半的圆。
 */
const THEME_ICON: Record<ThemeMode, LucideIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: ContrastIcon,
}

const THEME_LABEL_KEY = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
} as const

const LOCALE_LABEL_KEY = {
  'zh-CN': 'locale.zh-CN',
  'zh-HK': 'locale.zh-HK',
  en: 'locale.en',
  ja: 'locale.ja',
  ko: 'locale.ko',
} as const satisfies Record<Locale, string>

const iconButton = cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'tap-target rounded-full')

export function TopBar() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const { mode, setMode } = useTheme()
  const { guide, grid, setGuide, setGrid } = usePreviewOverlays()
  const undo = useAvatarStore((state) => state.undo)
  const redo = useAvatarStore((state) => state.redo)
  const reset = useAvatarStore((state) => state.reset)
  const canUndo = useAvatarStore((state) => state.past.length > 0)
  const canRedo = useAvatarStore((state) => state.future.length > 0)
  // 只订阅有没有历史：0 到 1 才重渲，后面每加一格都重渲顶栏就得不偿失了
  const hasHistory = useAvatarStore((state) => state.history.length > 0)
  const [historyMounted, setHistoryMounted] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const onReset = useCallback(() => {
    reset()
    setResetOpen(false)
    toast.success(t('about.resetDone'))
  }, [reset, t])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) return
      if (event.key.toLowerCase() !== 'z') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo])

  return (
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/55 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-md lg:px-6">
      {/* 品牌这一格吃掉剩余宽度，右边的备案号与按钮组才靠得住右缘；
          备案号在手机上不显示，靠它自己的 ml-auto 撑不起这件事 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BrandMark className="size-7 shrink-0 drop-shadow-sm" />
        {/* 全站唯一的 h1。品牌名就是页面主标题，另起一个隐藏标题反而多一层噪音；
            炫技层在跑时它逐字模糊入场，只播一次。
            手机上只留品牌图标：顶栏那点宽度分给六个按钮之后剩不下几十像素，
            名字会被截成半个字，比干脆不显示更糟。用 sr-only 不用 hidden，
            读屏与文档大纲里这条标题还在 */}
        <span className="sr-only sm:not-sr-only sm:flex sm:min-w-0">
          <BrandTitle text={t('app.name')} className="text-sm font-semibold tracking-tight" />
        </span>
      </div>

      {/* 备案号必须在首页可见且链到工信部。手机顶栏放不下，那里改在挑选栏末尾一行 */}
      <a
        data-slot="icp-beian"
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer noopener"
        className="text-muted-foreground/70 hover:text-muted-foreground ml-auto hidden shrink-0 text-[11px] whitespace-nowrap hover:underline sm:inline"
      >
        {t('footer.icp')}
      </a>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          data-slot="undo-action"
          className={iconButton}
          aria-label={t('topbar.undo')}
          title={t('topbar.undo')}
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2Icon className="size-5" />
        </button>
        <button
          type="button"
          data-slot="redo-action"
          className={iconButton}
          aria-label={t('topbar.redo')}
          title={t('topbar.redo')}
          disabled={!canRedo}
          onClick={redo}
        >
          <Redo2Icon className="size-5" />
        </button>

        <Popover>
          <PopoverTrigger
            className={iconButton}
            data-slot="history-menu"
            aria-label={t('history.title')}
            title={t('history.title')}
            onClick={() => setHistoryMounted(true)}
          >
            <HistoryIcon className="size-5" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto max-w-[min(24rem,calc(100vw-1.5rem))]">
            <h2 className="text-muted-foreground px-1 text-xs font-medium">{t('history.title')}</h2>
            {/* 空态就一行字，为它拉一份 chunk 不值当；有历史了才挂懒加载的那份 */}
            {hasHistory && historyMounted ? (
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <HistoryStripLazy />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <p className="text-muted-foreground px-1 pb-1 text-xs">{t('history.empty')}</p>
            )}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={iconButton}
            data-slot="language-menu"
            aria-label={t('topbar.language')}
          >
            <LanguagesIcon className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            {LOCALES.map((item) => (
              <DropdownMenuItem
                key={item}
                onClick={() => setLocale(item)}
                className="min-h-11 justify-between px-2"
              >
                <span>{t(LOCALE_LABEL_KEY[item])}</span>
                {item === locale ? <CheckIcon className="size-4" aria-hidden /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={iconButton}
            data-slot="settings-menu"
            aria-label={t('topbar.settings')}
            title={t('topbar.settings')}
          >
            <SettingsIcon className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {/* Base UI 的 GroupLabel 只能住在 Group 里，裸放会在打开菜单那一刻抛错、整棵树被错误边界卸掉 */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('topbar.theme')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(next: ThemeMode) => setMode(next)}
              >
                {THEME_MODES.map((item) => {
                  const Icon = THEME_ICON[item]
                  return (
                    <DropdownMenuRadioItem
                      key={item}
                      value={item}
                      data-slot="theme-option"
                      data-value={item}
                      className="min-h-11 pl-2"
                    >
                      <Icon className="size-4" aria-hidden />
                      {t(THEME_LABEL_KEY[item])}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* 两个参考层压在作品上，正好挡住要看的那一块，而且只有图标谁也认不出，
                所以从画框角上挪进菜单，带着文案与勾选态；它们记在本机，跨会话生效 */}
            <DropdownMenuCheckboxItem
              data-slot="grid-toggle"
              checked={grid}
              onCheckedChange={setGrid}
              className="min-h-11 px-2 pr-8"
            >
              <Grid3x3Icon className="size-4" aria-hidden />
              {t('preview.grid')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              data-slot="guide-toggle"
              checked={guide}
              onCheckedChange={setGuide}
              className="min-h-11 px-2 pr-8"
            >
              <ScanIcon className="size-4" aria-hidden />
              {t('preview.safeArea')}
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              data-slot="reset-action"
              onClick={() => setResetOpen(true)}
              className="min-h-11 px-2"
            >
              <RotateCcwIcon className="size-4" aria-hidden />
              {t('about.reset')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 关于是一个独立页面，不是浮层：介绍与技术说明有几屏长，塞进对话框既读不下去，
            也没法单独分享一个链接出去 */}
        <a
          href="/about"
          data-slot="about-action"
          className={iconButton}
          aria-label={t('topbar.about')}
          title={t('topbar.about')}
        >
          <InfoIcon className="size-5" />
        </a>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('about.reset')}</DialogTitle>
            <DialogDescription>{t('reset.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              {t('reset.cancel')}
            </Button>
            <Button type="button" data-slot="reset-confirm" onClick={onReset}>
              <RotateCcwIcon aria-hidden />
              {t('about.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
