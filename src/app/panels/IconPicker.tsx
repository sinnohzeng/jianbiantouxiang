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
import { useAvatarStore } from '@/state/store'

export interface IconPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMOJI_LIMIT = 240
const FULL_ICON_LIMIT = 200

/** 渐变底上默认用纯白变体，没有纯白件的品牌退回原色。 */
type BrandVariant = 'color' | 'white'

interface BrandIndex {
  entries: readonly BrandEntry[]
  categories: readonly BrandCategory[]
}

/** 一个品牌在当前变体下真正要用的文件名与静态资源地址。 */
function brandFileOf(entry: BrandEntry, variant: BrandVariant): { id: string; url: string } {
  const id = variant === 'white' && entry.white ? entry.white : entry.id
  const ext = id === entry.id ? entry.ext : 'svg'
  return { id, url: `${import.meta.env.BASE_URL}brand/${id}.${ext}` }
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

  // upload 与 none 都没有对应的模式页，落回内置图标那一页
  const iconSource = config.layout.icon.source
  const initialMode: IconSource =
    iconSource === 'emoji' || iconSource === 'brand' ? iconSource : 'builtin'
  const [mode, setMode] = useState<IconSource>(initialMode)
  const [query, setQuery] = useState('')
  const [curatedNodes, setCuratedNodes] = useState<Record<string, LucideIconNode[]> | null>(null)
  const [fullNodes, setFullNodes] = useState<Record<string, LucideIconNode[]> | null>(null)
  const [emojiEntries, setEmojiEntries] = useState<EmojiEntry[] | null>(null)
  const [brandIndex, setBrandIndex] = useState<BrandIndex | null>(null)
  const [brandVariant, setBrandVariant] = useState<BrandVariant>('white')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || mode !== 'builtin' || curatedNodes) return
    let cancelled = false
    void import('@/graphics/generated/lucide-curated').then((module) => {
      if (!cancelled) setCuratedNodes(module.LUCIDE_CURATED)
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
          icon.category === category &&
          (hit(icon.name, q) || hit(icon.zh, q) || hit(icon.en, q)),
      ),
    })).filter((group) => group.list.length > 0)
  }, [query])
  const curatedCount = curatedResults.reduce((sum, group) => sum + group.list.length, 0)

  useEffect(() => {
    if (!open || mode !== 'builtin' || fullNodes || query.trim().length < 2 || curatedCount >= 12) {
      return
    }
    let cancelled = false
    void import('@/graphics/generated/lucide-full').then((module) => {
      if (!cancelled) setFullNodes(module.LUCIDE_ICONS)
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
        if (!cancelled) setEmojiEntries([])
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
        if (!cancelled) setBrandIndex({ entries: [], categories: [] })
      })
    return () => {
      cancelled = true
    }
  }, [brandIndex, mode, open])

  const brandResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!brandIndex) return []
    return brandIndex.categories
      .map((category) => ({
        category,
        list: brandIndex.entries.filter(
          (entry) =>
            entry.category === category &&
            (hit(entry.zh, q) ||
              hit(entry.en, q) ||
              hit(entry.id, q) ||
              entry.aliases.some((alias) => hit(alias, q))),
        ),
      }))
      .filter((group) => group.list.length > 0)
  }, [brandIndex, query])

  const choose = (source: IconSource, id: string): void => {
    setLayout({ icon: { source, id } })
    onOpenChange(false)
  }

  const onUpload = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setUploadError(null)
    try {
      const { id } = await registerUploadedGraphic(file)
      choose('upload', id)
    } catch (error) {
      setUploadError(uploadErrorKey(error))
    }
  }

  const chooseVariant = (next: BrandVariant): void => {
    setBrandVariant(next)
    const icon = config.layout.icon
    if (icon.source !== 'brand' || !brandIndex) return
    const entry = brandIndex.entries.find((item) => item.id === icon.id || item.white === icon.id)
    if (!entry) return
    const { id } = brandFileOf(entry, next)
    if (id !== icon.id) setLayout({ icon: { source: 'brand', id } })
  }

  const modeOptions = [
    { value: 'builtin' as const, label: t('icon.builtin') },
    { value: 'emoji' as const, label: t('icon.emoji') },
    { value: 'brand' as const, label: t('icon.brand') },
  ]

  const variantOptions = [
    { value: 'color' as const, label: t('icon.brand.variant.color') },
    { value: 'white' as const, label: t('icon.brand.variant.white') },
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
                data-checked={config.layout.icon.source === 'builtin' && config.layout.icon.id === icon.name || undefined}
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
                data-checked={config.layout.icon.source === 'builtin' && config.layout.icon.id === name || undefined}
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
      {curatedCount === 0 && fullResults.length === 0 ? (
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
              data-checked={config.layout.icon.source === 'emoji' && config.layout.icon.id === entry.id || undefined}
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
      {emojiGroups.length === 0 ? (
        <CommandEmpty>{emojiEntries ? t('icon.empty') : t('icon.loading')}</CommandEmpty>
      ) : null}
    </>
  )

  const brandPanel = (
    <>
      {brandResults.map((group) => (
        <CommandGroup
          key={`brand:${group.category}`}
          heading={t(`icon.brand.category.${group.category}`)}
        >
          {group.list.map((entry) => {
            const file = brandFileOf(entry, brandVariant)
            return (
              <CommandItem
                key={`brand:${file.id}`}
                value={`brand:${file.id}`}
                data-checked={
                  (config.layout.icon.source === 'brand' && config.layout.icon.id === file.id) ||
                  undefined
                }
                className="min-h-11"
                onSelect={() => choose('brand', file.id)}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-sm',
                    // 纯白件压在浅色列表上会看不见，给它垫一块深底，观感也贴近渐变底
                    brandVariant === 'white' ? 'bg-foreground/75' : 'bg-muted',
                  )}
                >
                  <img src={file.url} alt="" loading="lazy" className="size-4.5" />
                </span>
                <span className="truncate">{locale.startsWith('zh') ? entry.zh : entry.en}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      ))}
      {brandResults.length === 0 ? (
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
      {mode === 'brand' ? (
        <div data-slot="brand-variant" className="p-2 pb-0">
          <SegmentedControl
            name="brand-variant"
            label={t('icon.brand.variant')}
            value={brandVariant}
            options={variantOptions}
            onChange={chooseVariant}
          />
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
        <DrawerContent className="h-[85dvh] max-h-[85dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t('icon.title')}</DrawerTitle>
            <DrawerDescription>{searchHint}</DrawerDescription>
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
