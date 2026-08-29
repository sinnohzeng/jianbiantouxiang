/**
 * 字体选择器：command 面板，分组与键盘交互参考 @reactbits-pro/command-menu-1，
 * 组件底子用已装的 shadcn Command（cmdk），分组顺序是最近使用、精选、全部、系统、上传。
 *
 * 过滤交给 searchFonts（它按命中强度排序并把最近使用置顶），所以关掉 cmdk 自带的过滤。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { searchFonts, type CjkScript, type FontEntry } from '@/fonts/catalog'
import { CURATED_FONTS } from '@/fonts/curated'
import { nearestWeight } from '@/fonts/loader'
import { FontUploadError, registerUploadedFont } from '@/fonts/upload'
import { useT } from '@/i18n'
import { useAvatarStore } from '@/state/store'
import { ensureCatalog, useFontCatalog } from './font-entries'
import { loadRecentFonts, pushRecentFont } from './recent-fonts'

export interface FontPickerProps {
  /** 不传就是非受控，自己管开合并渲染 trigger。 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 非受控时的触发器，缺省是一颗显示当前字体名的按钮。 */
  trigger?: ReactNode
}

/** 全库列表一次最多渲染这么多条，再多靠搜索收窄。 */
const ALL_LIMIT = 200

/** 系统字体不走网络，直接用本机已有的字形。 */
const SYSTEM_FAMILIES: readonly string[] = [
  'system-ui',
  'PingFang SC',
  'Microsoft YaHei',
  'Hiragino Sans',
  'Apple SD Gothic Neo',
]

const CURATED_GROUPS: readonly { key: string; cjk?: CjkScript }[] = [
  { key: 'font.curated.sc', cjk: 'sc' },
  { key: 'font.curated.tc', cjk: 'tc' },
  { key: 'font.curated.jp', cjk: 'jp' },
  { key: 'font.curated.kr', cjk: 'kr' },
  { key: 'font.curated.latin' },
]

function uploadErrorKey(error: unknown): string {
  if (error instanceof FontUploadError) {
    if (error.code === 'too-large') return 'font.upload.tooLarge'
    if (error.code === 'unsupported-extension') return 'font.upload.badExt'
  }
  return 'font.upload.failed'
}

export function FontPicker({ open, onOpenChange, trigger }: FontPickerProps) {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setTypography = useAvatarStore((state) => state.setTypography)

  const controlled = open !== undefined
  const [innerOpen, setInnerOpen] = useState(false)
  const isOpen = controlled ? open : innerOpen

  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>(loadRecentFonts)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const catalog = useFontCatalog(isOpen)

  useEffect(() => {
    if (isOpen) void ensureCatalog()
  }, [isOpen])

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInnerOpen(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange],
  )

  const choose = useCallback(
    (family: string, source: 'google' | 'system' | 'upload', weights?: readonly number[]) => {
      const available = weights ?? []
      setTypography({
        fontFamily: family,
        fontSource: source,
        ...(available.length > 0
          ? { fontWeight: nearestWeight(available, config.typography.fontWeight) }
          : {}),
      })
      setRecent(pushRecentFont(family))
      setOpen(false)
    },
    [config.typography.fontWeight, setOpen, setTypography],
  )

  const recentEntries = useMemo(() => {
    const byFamily = new Map(catalog.map((entry) => [entry.family, entry]))
    return recent
      .map((family) => byFamily.get(family))
      .filter((entry): entry is FontEntry => entry !== undefined)
  }, [catalog, recent])

  const curated = useMemo(
    () =>
      CURATED_GROUPS.map((group) => ({
        key: group.key,
        list: searchFonts(CURATED_FONTS, query, {
          cjk: group.cjk ?? 'none',
          limit: 24,
        }),
      })).filter((group) => group.list.length > 0),
    [query],
  )

  const all = useMemo(() => searchFonts(catalog, query, { limit: ALL_LIMIT }), [catalog, query])

  const systemList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SYSTEM_FAMILIES.filter((family) => !q || family.toLowerCase().includes(q))
  }, [query])

  const onUpload = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setUploadError(null)
    try {
      const { family } = await registerUploadedFont(file)
      choose(family, 'upload')
    } catch (error) {
      setUploadError(uploadErrorKey(error))
    }
  }

  const renderItem = (entry: FontEntry, groupKey: string): ReactNode => (
    <CommandItem
      key={`${groupKey}:${entry.id}`}
      value={`${groupKey}:${entry.id}`}
      data-checked={config.typography.fontFamily === entry.family || undefined}
      className="min-h-11"
      onSelect={() => choose(entry.family, 'google', entry.weights)}
    >
      <span className="truncate">{entry.family}</span>
    </CommandItem>
  )

  const panel = (
    <Command shouldFilter={false} className="min-h-0">
      <CommandInput
        className="h-11 text-base md:text-base"
        placeholder={t('font.search')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>{t('font.empty')}</CommandEmpty>

        {recentEntries.length > 0 ? (
          <CommandGroup heading={t('font.recent')}>
            {recentEntries.map((entry) => renderItem(entry, 'recent'))}
          </CommandGroup>
        ) : null}

        {curated.map((group) => (
          <CommandGroup key={group.key} heading={t(group.key)}>
            {group.list.map((entry) => renderItem(entry, group.key))}
          </CommandGroup>
        ))}

        <CommandGroup heading={t('font.all')}>
          {all.map((entry) => renderItem(entry, 'all'))}
        </CommandGroup>
        {all.length >= ALL_LIMIT ? (
          <p className="text-muted-foreground px-3 pb-2 text-xs">{t('font.more')}</p>
        ) : null}

        <CommandGroup heading={t('font.system')}>
          {systemList.map((family) => (
            <CommandItem
              key={`system:${family}`}
              value={`system:${family}`}
              data-checked={config.typography.fontFamily === family || undefined}
              className="min-h-11"
              onSelect={() => choose(family, 'system')}
            >
              <span className="truncate">{family}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <div className="flex flex-col gap-1.5 p-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
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

  return (
    <>
      {!controlled
        ? (trigger ?? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start"
              onClick={() => setOpen(true)}
            >
              <span className="truncate">{config.typography.fontFamily}</span>
            </Button>
          ))
        : null}
      <CommandDialog
        open={isOpen}
        onOpenChange={(next) => setOpen(next)}
        title={t('font.title')}
        description={t('font.search')}
        className="p-0"
      >
        {panel}
      </CommandDialog>
    </>
  )
}
