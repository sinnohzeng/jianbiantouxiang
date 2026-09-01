/**
 * 顶栏：品牌、语言、主题、源码链接。
 * 半透明加模糊的悬浮壳借 `@shadcnblocks/navbar6` 的写法，让它压在环境光晕上不显得生硬。
 */

import { useEffect } from 'react'
import {
  CheckIcon,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { THEME_MODES, useTheme, type ThemeMode } from '@/app/theme'
import { LOCALES, useLocale, useT, type Locale } from '@/i18n'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'

const REPO_URL = 'https://github.com/sinnohzeng/jianbiantouxiang'

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
  const ThemeIcon = THEME_ICON[mode]

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
        <span
          aria-hidden
          className="size-7 shrink-0 rounded-[9px] shadow-sm"
          style={{
            background: 'linear-gradient(135deg, #d97757 0%, #8d7cf0 48%, #5fb4f5 100%)',
          }}
        />
        {/* 全站唯一的 h1。品牌名就是页面主标题，另起一个隐藏标题反而多一层噪音 */}
        <h1 className="truncate text-sm font-semibold tracking-tight">{t('app.name')}</h1>
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
          </DropdownMenuContent>
        </DropdownMenu>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('topbar.github')}
          title={t('topbar.github')}
          className={iconButton}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-5" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
      </div>
    </header>
  )
}
