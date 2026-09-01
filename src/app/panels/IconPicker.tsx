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
import type { LucideIconNode } from '@/graphics/types'
import { GraphicUploadError, registerUploadedGraphic } from '@/graphics/upload'
import { useIsMobile } from '@/hooks/use-media'
import { useLocale, useT } from '@/i18n'
import type { IconSource } from '@/state/config'
import { useAvatarStore } from '@/state/store'

export interface IconPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMOJI_LIMIT = 240
const FULL_ICON_LIMIT = 200

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

  const initialMode: IconSource =
    config.layout.icon.source === 'emoji' ? 'emoji' : config.layout.icon.source === 'none'
      ? 'builtin'
      : config.layout.icon.source
  const [mode, setMode] = useState<IconSource>(initialMode)
  const [query, setQuery] = useState('')
  const [curatedNodes, setCuratedNodes] = useState<Record<string, LucideIconNode[]> | null>(null)
  const [fullNodes, setFullNodes] = useState<Record<string, LucideIconNode[]> | null>(null)
  const [emojiEntries, setEmojiEntries] = useState<EmojiEntry[] | null>(null)
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

  const modeOptions = [
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
        placeholder={mode === 'emoji' ? t('icon.search.emoji') : t('icon.search.builtin')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[58vh]">
        {mode === 'builtin' ? builtinPanel : emojiPanel}
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
            <DrawerDescription>{t('icon.search.builtin')}</DrawerDescription>
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
      description={t('icon.search.builtin')}
      className="p-0"
    >
      {content}
    </CommandDialog>
  )
}
