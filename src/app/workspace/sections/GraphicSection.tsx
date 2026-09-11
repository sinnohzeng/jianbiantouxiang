/**
 * 图标节：一个控件两种状态。
 *
 * 空态是一颗整宽虚线按钮；填充态是缩略图磁贴（点它换）、图形名与移除钮。
 * 早先这里同时有标题开关、磁贴、「挑一个」按钮与清除钮四个入口做同一件事：
 * 开关打开时拉起选择器是个 call to action，而 Switch 的语义是持续开关一个功能，
 * 两者不是一回事。现在选与换都走磁贴，去掉直接叉掉。
 *
 * 磁贴内保留 sr-only 的 id：端到端与单测按磁贴文本断言当前图形，可见名字另在一格。
 * 品牌标志多一档原色 / 单色，那是选中之后的属性而不是入口，留在填充态里。
 * 大小与位置补偿也只在填充态出现：没有图标时它们无处可施，摆出来只是噪音。
 */

import { Suspense, useState } from 'react'
import { ImagePlusIcon, XIcon } from 'lucide-react'
import { PanelSection } from '@/components/blocks/panel-section'
import { SegmentedControl } from '@/components/blocks/segmented-control'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { useGraphicLabel } from '@/graphics/label'
import { GraphicThumb } from '@/app/panels/GraphicThumb'
import { IconPickerLazy } from '@/app/panels/lazy'
import { DEFAULT_CONFIG } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { SectionCard } from './card'
import { Row } from './row'

/** 图标的两条补偿共用：量程 ±25%，步进 0.25%，显示一位小数，基准是安全框。 */
const OFFSET_RANGE = {
  min: -0.25,
  max: 0.25,
  step: 0.0025,
  scale: 100,
  precision: 1,
  unit: '%',
} as const

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
  // 单色只对品牌标志有意义：emoji 与上传的图压成剪影只会糊成一块
  const isBrand = icon.source === 'brand'
  const label = useGraphicLabel(icon.source, icon.id)

  const monoOptions = [
    { value: 'color' as const, label: t('icon.brand.variant.color') },
    { value: 'mono' as const, label: t('icon.brand.variant.mono') },
  ]

  const openPicker = (): void => {
    setIconMounted(true)
    setIconOpen(true)
  }

  const clear = (): void => {
    setLayout({ icon: { source: 'none', id: '' } })
  }

  return (
    <SectionCard title={t('panel.graphic.title')}>
      {enabled ? (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-slot="graphic-picker"
              aria-label={t('icon.title')}
              title={t('icon.title')}
              onClick={openPicker}
              className="hover:border-foreground/40 focus-visible:ring-ring/50 border-border flex size-12 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none lg:size-11"
            >
              <GraphicThumb icon={icon} config={config} color={type.color} />
              <span className="sr-only">{icon.id}</span>
            </button>

            <div className="min-w-0 flex-1">
              <p
                data-slot="graphic-name"
                title={label}
                className="truncate text-[11px] font-medium"
              >
                {label}
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                {t('panel.text.icon.hint')}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              data-slot="icon-clear"
              aria-label={t('panel.text.icon.clear')}
              title={t('panel.text.icon.clear')}
              className="text-muted-foreground hover:text-foreground size-11 shrink-0 lg:size-8"
              onClick={clear}
            >
              <XIcon aria-hidden className="size-4" />
            </Button>
          </div>

          {isBrand ? (
            <div data-slot="brand-mono" className="min-w-0">
              <SegmentedControl
                name="brand-mono"
                label={t('panel.graphic.mono')}
                value={icon.mono ? 'mono' : 'color'}
                options={monoOptions}
                onChange={(next) => setLayout({ icon: { mono: next === 'mono' } })}
              />
            </div>
          ) : null}

          {/* 大小常显，挪位置收进折叠组：换过图标的人多半要调大小，挪位置是少数 */}
          <Row
            label={t('panel.graphic.scale')}
            value={config.layout.graphic}
            defaultValue={DEFAULT_CONFIG.layout.graphic}
            min={0.3}
            max={0.8}
            step={0.01}
            scale={100}
            unit="%"
            onChange={(graphic) => setLayout({ graphic })}
          />

          <PanelSection
            data-slot="graphic-group-offset"
            title={t('panel.common.group.offset')}
            defaultOpen={false}
          >
            <Row
              label={t('panel.graphic.offsetX')}
              value={config.layout.graphicOffsetX}
              defaultValue={DEFAULT_CONFIG.layout.graphicOffsetX}
              {...OFFSET_RANGE}
              onChange={(graphicOffsetX) => setLayout({ graphicOffsetX })}
            />
            <Row
              label={t('panel.graphic.offsetY')}
              value={config.layout.graphicOffsetY}
              defaultValue={DEFAULT_CONFIG.layout.graphicOffsetY}
              {...OFFSET_RANGE}
              onChange={(graphicOffsetY) => setLayout({ graphicOffsetY })}
            />
          </PanelSection>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          data-slot="graphic-pick"
          className="h-11 w-full border-dashed"
          onClick={openPicker}
        >
          <ImagePlusIcon aria-hidden />
          {t('icon.title')}
        </Button>
      )}

      {iconMounted ? (
        <Suspense fallback={null}>
          <IconPickerLazy open={iconOpen} onOpenChange={setIconOpen} />
        </Suspense>
      ) : null}
    </SectionCard>
  )
}
