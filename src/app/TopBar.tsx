/**
 * 顶栏：品牌、撤销重做、最近生成、语言、主题、关于。
 *
 * 最近生成跟撤销重做放在一起：三个都是“回到刚才那一版”，同一类动作就该同一处落点。
 * 缩略图条是懒加载的，点开过一次才拉那份 chunk。
 * 半透明加模糊的悬浮壳借 `@shadcnblocks/navbar6` 的写法，让它压在环境光晕上不显得生硬。
 */

import { Suspense, useEffect, useState } from 'react'
import {
  CheckIcon,
  HistoryIcon,
  InfoIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  Redo2Icon,
  SunIcon,
  Undo2Icon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { AboutDialog } from '@/app/AboutDialog'
import { ErrorBoundary } from '@/app/error-boundary'
import { HistoryStripLazy } from '@/app/panels/lazy'
import { BrandMark } from '@/app/BrandMark'
import { BrandTitle } from '@/app/showcase/BrandTitle'
import { useAmbientLevel } from '@/app/ambient'
import { THEME_MODES, useTheme, type ThemeMode } from '@/app/theme'
import { LOCALES, useLocale, useT, type Locale } from '@/i18n'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'

const THEME_ICON: Record<ThemeMode, LucideIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
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
  const undo = useAvatarStore((state) => state.undo)
  const redo = useAvatarStore((state) => state.redo)
  const canUndo = useAvatarStore((state) => state.past.length > 0)
  const canRedo = useAvatarStore((state) => state.future.length > 0)
  // 只订阅有没有历史：0 到 1 才重渲，后面每加一格都重渲顶栏就得不偿失了
  const hasHistory = useAvatarStore((state) => state.history.length > 0)
  const [historyMounted, setHistoryMounted] = useState(false)
  const ThemeIcon = THEME_ICON[mode]
  const [aboutOpen, setAboutOpen] = useState(false)
  const { level: ambient, setLevel: setAmbientLevel } = useAmbientLevel()

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
      <div className="flex min-w-0 items-center gap-2">
        <BrandMark className="size-7 shrink-0 drop-shadow-sm" />
        {/* 全站唯一的 h1。品牌名就是页面主标题，另起一个隐藏标题反而多一层噪音；
            炫技层在跑时它逐字模糊入场，只播一次 */}
        <BrandTitle text={t('app.name')} className="text-sm font-semibold tracking-tight" />
        <span className="text-muted-foreground hidden truncate text-xs xl:inline">
          {t('app.slogan')}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
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
          <DropdownMenuTrigger className={iconButton} aria-label={t('topbar.theme')}>
            <ThemeIcon className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            {THEME_MODES.map((item) => {
              const Icon = THEME_ICON[item]
              return (
                <DropdownMenuItem
                  key={item}
                  onClick={() => setMode(item)}
                  className="min-h-11 justify-between px-2"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden />
                    {t(THEME_LABEL_KEY[item])}
                  </span>
                  {item === mode ? <CheckIcon className="size-4" aria-hidden /> : null}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <div className="px-2 pt-1.5 pb-2">
              <span className="text-muted-foreground mb-1.5 block px-1 text-xs">
                {t('theme.ambient')}
              </span>
              <Slider
                data-slot="ambient-slider"
                aria-label={t('theme.ambient')}
                value={[Math.round(ambient * 100)]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? (value[0] ?? 0) : value
                  setAmbientLevel(next / 100)
                }}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          data-slot="about-action"
          className={iconButton}
          aria-label={t('topbar.about')}
          title={t('topbar.about')}
          onClick={() => setAboutOpen(true)}
        >
          <InfoIcon className="size-5" />
        </button>
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      </div>
    </header>
  )
}
