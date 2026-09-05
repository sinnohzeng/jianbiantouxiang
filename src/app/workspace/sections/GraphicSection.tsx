/**
 * 图形节：开关、当前图形磁贴、更换与清除。
 *
 * 开关的语义沿用 v4：开就是拉起选择器去挑一个图形，关就把图形位清空回纯文字。
 * 图形大小在检查器带里，这里只管挑。
 */

import { Suspense, useState } from 'react'
import { ImagePlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/i18n'
import { useAvatarStore } from '@/state/store'
import { GraphicThumb } from '@/app/panels/GraphicThumb'
import { IconPickerLazy } from '@/app/panels/lazy'
import { cn } from '@/lib/utils'
import { SectionCard } from './card'

export function GraphicSection() {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setLayout = useAvatarStore((state) => state.setLayout)
  const [iconOpen, setIconOpen] = useState(false)
  // 图形选择器是懒加载的：没点开过就不挂，避免把 cmdk 与索引拉进首屏
  const [iconMounted, setIconMounted] = useState(false)

  const icon = config.layout.icon
  const enabled = icon.source !== 'none'
  const type = config.typography

  const openPicker = (): void => {
    setIconMounted(true)
    setIconOpen(true)
  }

  return (
    <SectionCard
      title={t('panel.graphic.title')}
      action={
        <Switch
          id="text-icon"
          data-slot="text-icon-switch"
          aria-label={t('panel.text.icon')}
          className="after:-inset-y-[13px]"
          checked={enabled}
          onCheckedChange={(on) => {
            // 开关打开即拉起图形选择器：选完图形开关才算真正点亮，
            // 关掉则清空图标，栈回到纯文字
            if (on) openPicker()
            else setLayout({ icon: { source: 'none', id: '' } })
          }}
        />
      }
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-slot="graphic-picker"
          aria-label={t('icon.title')}
          onClick={openPicker}
          className={cn(
            'hover:border-foreground/40 focus-visible:ring-ring/50 flex size-18 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
            enabled ? 'border-border' : 'border-border/70 text-muted-foreground border-dashed',
          )}
        >
          {enabled ? (
            <GraphicThumb
              icon={icon}
              config={config}
              color={type.colorMode === 'custom' ? type.color : '#ffffff'}
            />
          ) : (
            <ImagePlusIcon className="size-6" aria-hidden />
          )}
          {/* 磁贴上不写字，当前图形标识仍留在无障碍名与端到端断言里 */}
          <span className="sr-only">{enabled ? icon.id : t('panel.graphic.empty')}</span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-muted-foreground truncate text-xs">
            {enabled ? icon.id || t('panel.graphic.current') : t('panel.graphic.empty')}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="outline" className="h-11 px-3" onClick={openPicker}>
              {t('panel.graphic.change')}
            </Button>
            {enabled ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                data-slot="icon-clear"
                aria-label={t('panel.text.icon.clear')}
                title={t('panel.text.icon.clear')}
                className="tap-target"
                onClick={() => setLayout({ icon: { source: 'none', id: '' } })}
              >
                <XIcon aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {enabled ? (
        <p className="text-muted-foreground text-xs">{t('panel.text.icon.hint')}</p>
      ) : null}

      {/* 选择器挂载与 enabled 无关：第一次选图形时开关还没点亮 */}
      {iconMounted ? (
        <Suspense fallback={null}>
          <IconPickerLazy open={iconOpen} onOpenChange={setIconOpen} />
        </Suspense>
      ) : null}
    </SectionCard>
  )
}
