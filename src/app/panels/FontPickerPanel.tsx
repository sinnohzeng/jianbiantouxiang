/**
 * 字体选择器的面板与手机抽屉，按行打开：勾选态看该行的生效字体，选中写该行。
 *
 * 桌面由文字卡片的字体行套一层 Popover 锚在按钮下方，手机用 `FontPickerDrawer` 从底部抽出，
 * 两处共用 `FontPickerPanel`。分组自上而下是已上传、最近使用、精选若干组、全部、系统，最后是上传按钮；
 * 精选按界面语言排组，组内保持 curated.ts 的手工顺序，搜索时才按命中强度排。
 *
 * 过滤交给 searchFonts，关掉 cmdk 自带的过滤。搜索词与上传报错是面板局部状态，
 * 弹层关闭即卸载，重开是干净的。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import {
  displayName,
  findFontEntry,
  searchFonts,
  weightsOf,
  type CjkScript,
  type FontEntry,
} from '@/fonts/catalog'
import { CURATED_FONTS, SYSTEM_FONTS } from '@/fonts/curated'
import { FontUploadError, listUploadedFonts, registerUploadedFont } from '@/fonts/upload'
import { useLocale, useT, type Locale } from '@/i18n'
import {
  lineFont,
  nearestWeight,
  withLine1Font,
  withLine2Font,
  type FontChoice,
  type FontSource,
  type FontWeight,
} from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { ensureCatalog, useFontCatalog } from './font-entries'
import { pushRecentFont, recentFonts } from './recent-fonts'

/** 全库列表一次最多渲染这么多条，再多靠搜索收窄。 */
const ALL_LIMIT = 200

/** 精选每组最多列这么多条。 */
const CURATED_LIMIT = 24

interface CuratedGroup {
  key: string
  cjk: CjkScript | readonly CjkScript[] | 'none'
}

const SC: CuratedGroup = { key: 'font.curated.sc', cjk: 'sc' }
// 繁体组同时收台湾与香港两类
const TC: CuratedGroup = { key: 'font.curated.tc', cjk: ['tc', 'hk'] }
const JP: CuratedGroup = { key: 'font.curated.jp', cjk: 'jp' }
const KR: CuratedGroup = { key: 'font.curated.kr', cjk: 'kr' }
const LATIN: CuratedGroup = { key: 'font.curated.latin', cjk: 'none' }

/** 精选各组按界面语言排：本语言的书写系统在前，日韩界面把拉丁提到第二。 */
const CURATED_ORDER: Record<Locale, readonly CuratedGroup[]> = {
  'zh-CN': [SC, TC, JP, KR, LATIN],
  'zh-HK': [TC, SC, JP, KR, LATIN],
  ja: [JP, LATIN, SC, TC, KR],
  ko: [KR, LATIN, SC, TC, JP],
  en: [LATIN, SC, TC, JP, KR],
}

function uploadErrorKey(error: unknown): string {
  if (error instanceof FontUploadError) {
    if (error.code === 'too-large') return 'font.upload.tooLarge'
    if (error.code === 'unsupported-extension') return 'font.upload.badExt'
  }
  return 'font.upload.failed'
}

function lineLabelKey(line: 1 | 2): string {
  return line === 1 ? 'panel.text.line1Font' : 'panel.text.line2Font'
}

function matches(text: string, query: string): boolean {
  return !query || text.toLowerCase().includes(query)
}

export interface FontPickerPanelProps {
  line: 1 | 2
  /** 选中或点中当前那款之后调用，由外壳关掉弹层。 */
  onDone: () => void
}

export function FontPickerPanel({ line, onDone }: FontPickerPanelProps) {
  const t = useT()
  const { locale } = useLocale()
  const typography = useAvatarStore((state) => state.config.typography)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const current = lineFont(typography, line)

  const [query, setQuery] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recent = recentFonts.useValue()
  const catalog = useFontCatalog()

  useEffect(() => {
    void ensureCatalog()
  }, [])

  const q = query.trim().toLowerCase()

  // 注册表只在本会话内变，面板每次打开都重新挂载，渲染时读一次就够
  const uploaded = listUploadedFonts().filter((item) =>
    matches(displayName(item.family, 'upload'), q),
  )

  const recentEntries = useMemo(
    () =>
      searchFonts(
        recent.map(findFontEntry).filter((entry): entry is FontEntry => entry !== undefined),
        query,
        { keepOrder: true },
      ),
    [recent, query],
  )

  const curated = useMemo(
    () =>
      CURATED_ORDER[locale]
        .map((group) => ({
          key: group.key,
          list: searchFonts(CURATED_FONTS, query, {
            cjk: group.cjk,
            limit: CURATED_LIMIT,
            keepOrder: true,
          }),
        }))
        .filter((group) => group.list.length > 0),
    [locale, query],
  )

  const all = useMemo(() => searchFonts(catalog, query, { limit: ALL_LIMIT }), [catalog, query])

  const systemList = SYSTEM_FONTS.filter((family) => matches(family, q))

  const isCurrent = (family: string, source: FontSource): boolean =>
    current.family === family && current.source === source

  // 打开时高亮当前字体：取它在列表里第一次出现的那一项，cmdk 挂载时把它滚进视口。
  // 只在挂载那一刻取一次，之后高亮跟着键盘与指针走。全库目录还没到时按 family 查出 id 先占上，
  // 目录到货、那一行挂上时它就是高亮项
  const [currentValue] = useState((): string | undefined => {
    if (current.source === 'upload') {
      return uploaded.some((item) => item.family === current.family)
        ? `upload:${current.family}`
        : undefined
    }
    if (current.source === 'system') return `system:${current.family}`
    const inRecent = recentEntries.find((entry) => entry.family === current.family)
    if (inRecent) return `recent:${inRecent.id}`
    for (const group of curated) {
      const entry = group.list.find((item) => item.family === current.family)
      if (entry) return `${group.key}:${entry.id}`
    }
    const entry = findFontEntry(current.family)
    return entry ? `all:${entry.id}` : undefined
  })

  const choose = (family: string, source: FontSource, weights: readonly FontWeight[]): void => {
    const latest = useAvatarStore.getState().config.typography
    const active = lineFont(latest, line)
    // 点中该行当前那款只关弹层，不写配置
    if (active.family === family && active.source === source) {
      onDone()
      return
    }
    const next: FontChoice = { family, source, weight: nearestWeight(weights, active.weight) }
    setTypography(line === 1 ? withLine1Font(latest, next, weights) : withLine2Font(latest, next))
    if (source === 'google') pushRecentFont(family)
    onDone()
  }

  const chooseEntry = (entry: FontEntry): void => {
    choose(
      entry.family,
      'google',
      entry.weights.length > 0 ? entry.weights : weightsOf(entry.family),
    )
  }

  const onUpload = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setUploadError(null)
    try {
      const { family } = await registerUploadedFont(file)
      choose(family, 'upload', weightsOf(family))
    } catch (error) {
      setUploadError(uploadErrorKey(error))
    }
  }

  const currentMark = <span className="sr-only">{t('font.current')}</span>

  const renderItem = (value: string, name: string, checked: boolean, onSelect: () => void) => (
    <CommandItem
      key={value}
      value={value}
      data-checked={checked || undefined}
      className="min-h-11 lg:min-h-9"
      onSelect={onSelect}
    >
      <span className="truncate">{name}</span>
      {checked ? currentMark : null}
    </CommandItem>
  )

  const renderEntry = (entry: FontEntry, groupKey: string) =>
    renderItem(
      `${groupKey}:${entry.id}`,
      displayName(entry.family, 'google'),
      isCurrent(entry.family, 'google'),
      () => chooseEntry(entry),
    )

  return (
    <Command shouldFilter={false} defaultValue={currentValue} className="min-h-0">
      <CommandInput
        className="h-11 text-base md:text-base"
        placeholder={t('font.search')}
        value={query}
        onValueChange={setQuery}
      />
      {/* 桌面弹层给出 --available-height，列表按它封顶；抽屉里没有这个变量，整条声明失效，列表随抽屉撑满 */}
      <CommandList className="max-h-[min(60vh,calc(var(--available-height)-3.5rem))] min-h-0 flex-1">
        <CommandEmpty>{t('font.empty')}</CommandEmpty>

        {uploaded.length > 0 ? (
          <CommandGroup heading={t('font.uploaded')}>
            {uploaded.map((item) =>
              renderItem(
                `upload:${item.family}`,
                displayName(item.family, 'upload'),
                isCurrent(item.family, 'upload'),
                () => choose(item.family, 'upload', weightsOf(item.family)),
              ),
            )}
          </CommandGroup>
        ) : null}

        {recentEntries.length > 0 ? (
          <CommandGroup heading={t('font.recent')}>
            {recentEntries.map((entry) => renderEntry(entry, 'recent'))}
          </CommandGroup>
        ) : null}

        {curated.map((group) => (
          <CommandGroup key={group.key} heading={t(group.key)}>
            {group.list.map((entry) => renderEntry(entry, group.key))}
          </CommandGroup>
        ))}

        <CommandGroup heading={t('font.all')}>
          {all.map((entry) => renderEntry(entry, 'all'))}
        </CommandGroup>
        {all.length >= ALL_LIMIT ? (
          <p className="text-muted-foreground px-3 pb-2 text-xs">{t('font.more')}</p>
        ) : null}

        {systemList.length > 0 ? (
          <CommandGroup heading={t('font.system')}>
            {systemList.map((family) =>
              renderItem(
                `system:${family}`,
                displayName(family, 'system'),
                isCurrent(family, 'system'),
                () => choose(family, 'system', weightsOf(family)),
              ),
            )}
          </CommandGroup>
        ) : null}

        <CommandSeparator />
        <div className="flex flex-col gap-1.5 p-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full lg:h-9"
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon aria-hidden="true" />
            {t('font.upload')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            aria-label={t('font.upload')}
            onChange={(event) => {
              void onUpload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <p className="text-muted-foreground text-xs">{t('font.upload.hint')}</p>
          {uploadError ? (
            <p role="alert" className="text-destructive text-xs">
              {t(uploadError)}
            </p>
          ) : null}
        </div>
      </CommandList>
    </Command>
  )
}

export interface FontPickerDrawerProps {
  line: 1 | 2
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 手机端：底部抽屉，抽屉头写明为哪一行选字体。 */
export function FontPickerDrawer({ line, open, onOpenChange }: FontPickerDrawerProps) {
  const t = useT()
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="h-[85dvh] max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{t(lineLabelKey(line))}</DrawerTitle>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <FontPickerPanel line={line} onDone={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
