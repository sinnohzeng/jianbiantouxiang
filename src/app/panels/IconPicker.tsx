import { clientPresetConfig, isClientPreset, isExactBrand } from '@/graphics/client-presets'
import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { SegmentedControl } from '@/components/blocks/segmented-control'
import { CURATED_ICON_CATEGORIES, CURATED_ICONS } from '@/graphics/curated'
import { loadEmojiEntries, type EmojiEntry } from '@/graphics/emoji-index'
import type { BrandCategory, BrandEntry } from '@/graphics/generated/brand-index'
import type { LucideIconNode } from '@/graphics/types'
import { GraphicUploadError, registerUploadedGraphic } from '@/graphics/upload'
import { useIsMobile } from '@/hooks/use-media'
import { useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { IconSource } from '@/state/config'
import { flushConfigSync, useAvatarStore } from '@/state/store'

export interface IconPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMOJI_LIMIT = 240
const FULL_ICON_LIMIT = 200

interface BrandIndex {
  entries: readonly BrandEntry[]
  categories: readonly BrandCategory[]
}

/**
 * 列表里那枚缩略图的地址。单色档有上游单色稿就用它，没有就先摆原色稿，
 * 画面上的压平交给绘制期，列表不必自己再合成一遍。
 */
function brandThumbUrl(entry: BrandEntry, mono: boolean): string {
  const white = mono && entry.white
  const id = white || entry.asset || entry.id
  const ext = white ? 'svg' : entry.ext
  return `${import.meta.env.BASE_URL}brand/${id}.${ext}`
}

/** 存档里落的可能是品牌 id，也可能是旧存档留下的上游单色稿文件名。 */
function isChosen(entry: BrandEntry, iconId: string): boolean {
  return iconId === entry.id || iconId === entry.white
}

function LucideGlyph({ nodes }: { nodes: readonly LucideIconNode[] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      {nodes.map(([tag, attrs], index) => {
        const safe: Record<string, string> = {}
        for (const [name, value] of Object.entries(attrs)) {
          if (name !== 'key') safe[name] = value
        }
        return createElement(tag, { ...safe, key: index })
      })}
    </svg>
  )
}

function uploadErrorKey(error: unknown): string {
  if (error instanceof GraphicUploadError) {
    if (error.code === 'resource-limit') return 'icon.upload.resourceLimit'
    if (error.code === 'too-large') return 'icon.upload.tooLarge'
    if (error.code === 'unsupported-extension') return 'icon.upload.badExt'
    if (error.code === 'invalid-svg' || error.code === 'empty-graphic') return 'icon.upload.badSvg'
  }
  return 'icon.upload.failed'
}

function hit(text: string, query: string): boolean {
  return !query || text.toLowerCase().includes(query)
}

export function IconPicker({ open, onOpenChange }: IconPickerProps) {
  const t = useT()
  const { locale } = useLocale()
  const isMobile = useIsMobile()
  const config = useAvatarStore((state) => state.config)
  const setLayout = useAvatarStore((state) => state.setLayout)

  // upload 与 none 都没有对应的模式页，优先打开客户常用的品牌页
  const iconSource = config.layout.icon.source
  const initialMode: IconSource =
    iconSource === 'emoji' || iconSource === 'builtin' ? iconSource : 'brand'
  const [mode, setMode] = useState<IconSource>(initialMode)
  const [query, setQuery] = useState('')
  const [curatedNodes, setCuratedNodes] = useState<Record<string, LucideIconNode[]> | null>(null)
  const [fullNodes, setFullNodes] = useState<Record<string, LucideIconNode[]> | null>(null)
  const [emojiEntries, setEmojiEntries] = useState<EmojiEntry[] | null>(null)
  const [brandIndex, setBrandIndex] = useState<BrandIndex | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [indexFailed, setIndexFailed] = useState(false)
  const uploadTicket = useRef(0)
  useEffect(() => {
    if (!open) uploadTicket.current += 1
  }, [open])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || mode !== 'builtin' || curatedNodes) return
    let cancelled = false
    void import('@/graphics/generated/lucide-curated')
      .then((module) => {
        if (!cancelled) setCuratedNodes(module.LUCIDE_CURATED)
      })
      .catch(() => {
        if (!cancelled) setIndexFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [curatedNodes, mode, open])

  const curatedResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CURATED_ICON_CATEGORIES.map((category) => ({
      category,
      list: CURATED_ICONS.filter(
        (icon) =>
          icon.category === category && (hit(icon.name, q) || hit(icon.zh, q) || hit(icon.en, q)),
      ),
    })).filter((group) => group.list.length > 0)
  }, [query])
  const curatedCount = curatedResults.reduce((sum, group) => sum + group.list.length, 0)

  useEffect(() => {
    if (!open || mode !== 'builtin' || fullNodes || query.trim().length < 2 || curatedCount >= 12) {
      return
    }
    let cancelled = false
    void import('@/graphics/generated/lucide-full')
      .then((module) => {
        if (!cancelled) setFullNodes(module.LUCIDE_ICONS)
      })
      .catch(() => {
        if (!cancelled) setIndexFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [curatedCount, fullNodes, mode, open, query])

  const fullResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!fullNodes || q === '') return []
    return Object.keys(fullNodes)
      .filter((name) => name.includes(q))
      .slice(0, FULL_ICON_LIMIT)
  }, [fullNodes, query])

  useEffect(() => {
    if (!open || mode !== 'emoji' || emojiEntries) return
    let cancelled = false
    void loadEmojiEntries(locale)
      .then((entries) => {
        if (!cancelled) setEmojiEntries(entries)
      })
      .catch(() => {
        if (!cancelled) setIndexFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [emojiEntries, locale, mode, open])

  const emojiResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!emojiEntries) return []
    return emojiEntries.filter((entry) => {
      if (!q) return true
      return (
        hit(entry.label, q) ||
        hit(entry.emoji, q) ||
        hit(entry.id, q) ||
        entry.tags.some((tag) => hit(tag, q))
      )
    })
  }, [emojiEntries, query])

  const emojiGroups = useMemo(() => {
    const groups: Array<{ group: number; list: EmojiEntry[] }> = []
    for (const entry of emojiResults) {
      const current = groups.at(-1)
      if (current && current.group === entry.group) current.list.push(entry)
      else groups.push({ group: entry.group, list: [entry] })
    }
    if (emojiResults.length <= EMOJI_LIMIT) return groups
    let remaining = EMOJI_LIMIT
    return groups
      .map((group) => {
        const list = group.list.slice(0, Math.max(0, remaining))
        remaining -= list.length
        return { ...group, list }
      })
      .filter((group) => group.list.length > 0)
  }, [emojiResults])

  useEffect(() => {
    if (!open || mode !== 'brand' || brandIndex) return
    let cancelled = false
    void import('@/graphics/generated/brand-index')
      .then((module) => {
        if (!cancelled) {
          setBrandIndex({ entries: module.BRAND_INDEX, categories: module.BRAND_CATEGORIES })
        }
      })
      .catch(() => {
        if (!cancelled) setIndexFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [brandIndex, mode, open])

  const brandResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!brandIndex) return []
    return ['client', ...brandIndex.categories]
      .map((category) => ({
        category,
        list: [...brandIndex.entries]
          .sort((a, b) => Number(isClientPreset(b.id)) - Number(isClientPreset(a.id)))
          .filter(
            (entry) =>
              (category === 'client'
                ? isClientPreset(entry.id) && entry.id.endsWith('-white')
                : entry.category === category && !isClientPreset(entry.id)) &&
              (hit(entry.zh, q) ||
                hit(entry.en, q) ||
                hit(entry.id, q) ||
                entry.aliases.some((alias) => hit(alias, q))),
          ),
      }))
      .filter((group) => group.list.length > 0)
  }, [brandIndex, query])

  const choose = (source: IconSource, id: string): void => {
    uploadTicket.current += 1
    if (source === 'brand' && isClientPreset(id))
      useAvatarStore.getState().setConfig(clientPresetConfig(id))
    else setLayout({ icon: { source, id, mono: false } })
    onOpenChange(false)
  }

  const onUpload = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setUploadError(null)
    const ticket = ++uploadTicket.current
    try {
      const { id } = await registerUploadedGraphic(file)
      if (ticket === uploadTicket.current) choose('upload', id)
    } catch (error) {
      if (ticket === uploadTicket.current) setUploadError(uploadErrorKey(error))
    }
  }

  // 单色档写进配置，与挑选栏的那个分段控件读同一份状态
  const mono = false

  const modeOptions = [
    { value: 'brand' as const, label: t('icon.brand') },
    { value: 'builtin' as const, label: t('icon.builtin') },
    { value: 'emoji' as const, label: t('icon.emoji') },
  ]

  const builtinPanel = (
    <>
      {curatedResults.map((group) => (
        <CommandGroup key={group.category} heading={t(`icon.category.${group.category}`)}>
          {group.list.map((icon) => {
            const nodes = curatedNodes?.[icon.name]
            return (
              <CommandItem
                key={`curated:${icon.name}`}
                value={`curated:${icon.name}`}
                data-checked={
                  (config.layout.icon.source === 'builtin' &&
                    config.layout.icon.id === icon.name) ||
                  undefined
                }
                className="min-h-11"
                onSelect={() => choose('builtin', icon.name)}
              >
                {nodes ? <LucideGlyph nodes={nodes} /> : null}
                <span className="truncate">{locale.startsWith('zh') ? icon.zh : icon.en}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      ))}
      {fullResults.length > 0 ? (
        <CommandGroup heading={t('icon.all')}>
          {fullResults.map((name) => {
            const nodes = fullNodes?.[name]
            return (
              <CommandItem
                key={`all:${name}`}
                value={`all:${name}`}
                data-checked={
                  (config.layout.icon.source === 'builtin' && config.layout.icon.id === name) ||
                  undefined
                }
                className="min-h-11"
                onSelect={() => choose('builtin', name)}
              >
                {nodes ? <LucideGlyph nodes={nodes} /> : null}
                <span className="truncate">{name}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      ) : null}
      {!indexFailed && curatedCount === 0 && fullResults.length === 0 ? (
        <CommandEmpty>{curatedNodes ? t('icon.empty') : t('icon.loading')}</CommandEmpty>
      ) : null}
    </>
  )

  const emojiPanel = (
    <>
      {emojiGroups.map((group) => (
        <CommandGroup key={`emoji:${group.group}`} heading={t(`icon.emoji.group.${group.group}`)}>
          {group.list.map((entry) => (
            <CommandItem
              key={`emoji:${entry.id}`}
              value={`emoji:${entry.id}`}
              data-checked={
                (config.layout.icon.source === 'emoji' && config.layout.icon.id === entry.id) ||
                undefined
              }
              className="min-h-11"
              onSelect={() => choose('emoji', entry.id)}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {entry.emoji}
              </span>
              <span className="truncate">{entry.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
      {!indexFailed && emojiGroups.length === 0 ? (
        <CommandEmpty>{emojiEntries ? t('icon.empty') : t('icon.loading')}</CommandEmpty>
      ) : null}
    </>
  )

  const brandPanel = (
    <>
      {brandResults.map((group) => (
        <CommandGroup
          key={`brand:${group.category}`}
          heading={
            group.category === 'client'
              ? t('icon.brand.category.client')
              : t(`icon.brand.category.${group.category}`)
          }
        >
          {group.list.map((entry) => (
            <CommandItem
              key={`brand:${entry.id}`}
              value={`brand:${entry.id}`}
              data-checked={
                (config.layout.icon.source === 'brand' && isChosen(entry, config.layout.icon.id)) ||
                undefined
              }
              className="min-h-11"
              onSelect={() => choose('brand', entry.id)}
            >
              <span
                className={cn(
                  'flex h-8 w-10 shrink-0 items-center justify-center rounded-sm',
                  // 上游单色稿是纯白的，压在浅色列表上会看不见，给它垫一块深底，观感也贴近渐变底
                  (mono && entry.white) || entry.id.endsWith('-white')
                    ? 'bg-slate-800'
                    : isExactBrand(entry.id)
                      ? 'bg-white'
                      : 'bg-muted',
                )}
              >
                <img
                  src={brandThumbUrl(entry, mono)}
                  alt=""
                  loading="lazy"
                  className="max-h-6 w-9 object-contain"
                />
              </span>
              <span className="truncate">{locale.startsWith('zh') ? entry.zh : entry.en}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
      {!indexFailed && brandResults.length === 0 ? (
        <CommandEmpty>{brandIndex ? t('icon.empty') : t('icon.loading')}</CommandEmpty>
      ) : null}
    </>
  )

  const searchHint =
    mode === 'emoji'
      ? t('icon.search.emoji')
      : mode === 'brand'
        ? t('icon.search.brand')
        : t('icon.search.builtin')

  const panel = (
    <Command shouldFilter={false} className="min-h-0">
      <div className="p-2 pb-0">
        <SegmentedControl
          name="icon-source"
          label={t('icon.source')}
          value={mode}
          options={modeOptions}
          onChange={(next) => setMode(next)}
        />
      </div>
      <CommandInput
        className="h-11 text-base md:text-base"
        placeholder={searchHint}
        value={query}
        onValueChange={setQuery}
      />
      {indexFailed ? (
        <div role="alert" className="p-3 text-sm">
          <p>{t('icon.loadFailed')}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-11"
            onClick={() => {
              flushConfigSync()
              window.location.reload()
            }}
          >
            {t('icon.reload')}
          </Button>
        </div>
      ) : null}
      <CommandList className="max-h-[58vh]">
        {mode === 'builtin' ? builtinPanel : mode === 'emoji' ? emojiPanel : brandPanel}
      </CommandList>
      <CommandSeparator />
      <div className="flex flex-col gap-1.5 p-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon aria-hidden="true" />
          {t('icon.upload')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
          aria-label={t('icon.upload')}
          onChange={(event) => {
            void onUpload(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <p className="text-muted-foreground text-xs">{t('icon.upload.hint')}</p>
        {uploadError ? (
          <p role="alert" className="text-destructive text-xs">
            {t(uploadError)}
          </p>
        ) : null}
      </div>
    </Command>
  )

  const content: ReactNode = panel
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="h-[85dvh] max-h-[85dvh] [--radius:0.375rem]">
          <DrawerHeader className="py-2 text-left">
            <DrawerTitle>{t('icon.title')}</DrawerTitle>
            <DrawerDescription className="sr-only">{searchHint}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('icon.title')}
      description={searchHint}
      className="p-0"
    >
      {content}
    </CommandDialog>
  )
}
