/**
 * 文字面板：内容、字体与排版、效果三组。
 * 分组用可折叠区块，基础与排版默认展开，效果收起，手机上一屏能看完前两组。
 */

import { Suspense, useId, useMemo, useState } from 'react'
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, TypeIcon } from 'lucide-react'
import { PanelSection } from '@/components/blocks/panel-section'
import { SegmentedControl, type SegmentedOption } from '@/components/blocks/segmented-control'
import { SliderField } from '@/components/blocks/slider-field'
import { ColorField } from '@/components/blocks/color-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n'
import { ANCHORS, TEXT_EFFECTS, type Anchor, type TextEffect } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'
import { weightsOf } from './font-entries'
import { FontPickerLazy } from './lazy'

type Align = 'left' | 'center' | 'right'
type SizeMode = 'auto' | 'manual'
type ColorMode = 'auto' | 'custom'

/** 九宫格按行排布，与 Anchor 的九个取值一一对应。 */
const ANCHOR_GRID: readonly Anchor[] = ANCHORS

/** 小方块里那个点摆在哪，直接对应锚点位置，不用另画图。 */
const ANCHOR_ALIGN: Record<Anchor, string> = {
  tl: 'items-start justify-start',
  t: 'items-start justify-center',
  tr: 'items-start justify-end',
  l: 'items-center justify-start',
  c: 'items-center justify-center',
  r: 'items-center justify-end',
  bl: 'items-end justify-start',
  b: 'items-end justify-center',
  br: 'items-end justify-end',
}

export function TextPanel() {
  const t = useT()
  const uid = useId()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const [fontOpen, setFontOpen] = useState(false)
  // 字体选择器是懒加载的，挂上就等于拉 chunk，所以只在用户点开之后才挂
  const [fontMounted, setFontMounted] = useState(false)

  const type = config.typography
  const weights = useMemo(() => weightsOf(type.fontFamily), [type.fontFamily])

  const alignOptions: SegmentedOption<Align>[] = [
    { value: 'left', label: t('panel.text.align.left'), icon: <AlignLeftIcon /> },
    { value: 'center', label: t('panel.text.align.center'), icon: <AlignCenterIcon /> },
    { value: 'right', label: t('panel.text.align.right'), icon: <AlignRightIcon /> },
  ]

  const effectOptions: SegmentedOption<TextEffect>[] = TEXT_EFFECTS.map((effect) => ({
    value: effect,
    label: t(`panel.text.effect.${effect}`),
  }))

  return (
    <div className="flex flex-col">
      <PanelSection title={t('panel.text.group.basic')}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avatar-text">{t('panel.text.content')}</Label>
          <Textarea
            id="avatar-text"
            className="min-h-24 text-base md:text-base"
            value={config.text}
            placeholder={t('panel.text.placeholder')}
            onChange={(event) => setConfig({ text: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.font')}</Label>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-between px-3"
            onClick={() => {
              setFontMounted(true)
              setFontOpen(true)
            }}
          >
            <span className="truncate">{type.fontFamily}</span>
            <TypeIcon aria-hidden="true" />
          </Button>
          {/* 打开过一次就一直挂着，关闭动画才有得放；没打开过就不拉那份 chunk */}
          {fontMounted ? (
            <Suspense fallback={null}>
              <FontPickerLazy open={fontOpen} onOpenChange={setFontOpen} />
            </Suspense>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.fontWeight')}</Label>
          <div
            role="radiogroup"
            aria-label={t('panel.text.fontWeight')}
            className="flex flex-wrap gap-1.5"
          >
            {weights.map((weight) => (
              <label key={weight} className="relative cursor-pointer">
                <input
                  type="radio"
                  className="peer sr-only"
                  name={`text-weight-${uid}`}
                  data-group="text-weight"
                  value={weight}
                  checked={type.fontWeight === weight}
                  onChange={(event) => {
                    if (event.target.checked) setTypography({ fontWeight: weight })
                  }}
                />
                <span className="border-border peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-ring/50 flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm tabular-nums transition-colors peer-focus-visible:ring-3 motion-reduce:transition-none">
                  {weight}
                </span>
              </label>
            ))}
          </div>
        </div>
      </PanelSection>

      <PanelSection title={t('panel.text.group.type')}>
        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.sizeMode')}</Label>
          <SegmentedControl<SizeMode>
            name="text-size-mode"
            label={t('panel.text.sizeMode')}
            value={type.sizeMode}
            options={[
              { value: 'auto', label: t('panel.text.sizeMode.auto') },
              { value: 'manual', label: t('panel.text.sizeMode.manual') },
            ]}
            onChange={(sizeMode) => setTypography({ sizeMode })}
          />
        </div>

        <SliderField
          label={t('panel.text.fontSize')}
          editLabel={t('panel.common.edit', { name: t('panel.text.fontSize') })}
          value={type.fontSize}
          min={0.04}
          max={0.92}
          step={0.005}
          scale={100}
          unit="%"
          disabled={type.sizeMode === 'auto'}
          onChange={(fontSize) => setTypography({ fontSize })}
        />

        <SliderField
          label={t('panel.text.padding')}
          editLabel={t('panel.common.edit', { name: t('panel.text.padding') })}
          value={type.padding}
          min={0}
          max={0.3}
          step={0.005}
          scale={100}
          unit="%"
          onChange={(padding) => setTypography({ padding })}
        />

        <SliderField
          label={t('panel.text.lineHeight')}
          editLabel={t('panel.common.edit', { name: t('panel.text.lineHeight') })}
          value={type.lineHeight}
          min={0.85}
          max={2}
          step={0.01}
          precision={2}
          onChange={(lineHeight) => setTypography({ lineHeight })}
        />

        <SliderField
          label={t('panel.text.letterSpacing')}
          editLabel={t('panel.common.edit', { name: t('panel.text.letterSpacing') })}
          value={type.letterSpacing}
          min={-0.1}
          max={0.5}
          step={0.01}
          precision={2}
          unit=" em"
          onChange={(letterSpacing) => setTypography({ letterSpacing })}
        />

        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.align')}</Label>
          <SegmentedControl<Align>
            name="text-align"
            label={t('panel.text.align')}
            value={type.align}
            options={alignOptions}
            onChange={(align) => setTypography({ align })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.anchor')}</Label>
          <div
            role="radiogroup"
            aria-label={t('panel.text.anchor')}
            className="grid w-fit grid-cols-3 gap-1"
          >
            {ANCHOR_GRID.map((anchor) => (
              <label key={anchor} className="relative cursor-pointer">
                <input
                  type="radio"
                  className="peer sr-only"
                  name={`text-anchor-${uid}`}
                  data-group="text-anchor"
                  value={anchor}
                  checked={type.anchor === anchor}
                  aria-label={t(`panel.text.anchor.${anchor}`)}
                  onChange={(event) => {
                    if (event.target.checked) setTypography({ anchor })
                  }}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'border-border peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-ring/50 peer-checked:*:bg-primary-foreground flex size-11 rounded-lg border p-2 transition-colors peer-focus-visible:ring-3 motion-reduce:transition-none',
                    ANCHOR_ALIGN[anchor],
                  )}
                >
                  <span className="bg-foreground size-1.5 rounded-full" />
                </span>
              </label>
            ))}
          </div>
        </div>

        <SliderField
          label={t('panel.text.offsetX')}
          editLabel={t('panel.common.edit', { name: t('panel.text.offsetX') })}
          value={type.offsetX}
          min={-0.5}
          max={0.5}
          step={0.005}
          scale={100}
          unit="%"
          precision={1}
          onChange={(offsetX) => setTypography({ offsetX })}
        />

        <SliderField
          label={t('panel.text.offsetY')}
          editLabel={t('panel.common.edit', { name: t('panel.text.offsetY') })}
          value={type.offsetY}
          min={-0.5}
          max={0.5}
          step={0.005}
          scale={100}
          unit="%"
          precision={1}
          onChange={(offsetY) => setTypography({ offsetY })}
        />

        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="text-vertical">{t('panel.text.vertical')}</Label>
          {/* 开关本体只有 32×18，热区靠 ::after 外扩到 44 高 */}
          <Switch
            id="text-vertical"
            className="after:-inset-y-[13px]"
            checked={type.vertical}
            onCheckedChange={(vertical) => setTypography({ vertical })}
          />
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="text-auto-wrap">{t('panel.text.autoWrap')}</Label>
          <Switch
            id="text-auto-wrap"
            className="after:-inset-y-[13px]"
            checked={type.autoWrap}
            onCheckedChange={(autoWrap) => setTypography({ autoWrap })}
          />
        </div>
      </PanelSection>

      <PanelSection title={t('panel.text.group.effect')} defaultOpen={false}>
        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.effect')}</Label>
          <SegmentedControl<TextEffect>
            name="text-effect"
            label={t('panel.text.effect')}
            value={type.effect}
            options={effectOptions}
            onChange={(effect) => setTypography({ effect })}
          />
        </div>

        <SliderField
          label={t('panel.text.effectStrength')}
          editLabel={t('panel.common.edit', { name: t('panel.text.effectStrength') })}
          value={type.effectStrength}
          min={0}
          max={1}
          step={0.01}
          scale={100}
          unit="%"
          disabled={type.effect === 'plain'}
          onChange={(effectStrength) => setTypography({ effectStrength })}
        />

        {type.effect === 'pill' ? (
          <>
            <SliderField
              label={t('panel.text.pill.radius')}
              editLabel={t('panel.common.edit', { name: t('panel.text.pill.radius') })}
              value={type.pill.radius}
              min={0}
              max={0.5}
              step={0.01}
              scale={100}
              unit="%"
              onChange={(radius) => setTypography({ pill: { radius } })}
            />
            <SliderField
              label={t('panel.text.pill.padding')}
              editLabel={t('panel.common.edit', { name: t('panel.text.pill.padding') })}
              value={type.pill.padding}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              unit="%"
              onChange={(padding) => setTypography({ pill: { padding } })}
            />
            <SliderField
              label={t('panel.text.pill.opacity')}
              editLabel={t('panel.common.edit', { name: t('panel.text.pill.opacity') })}
              value={type.pill.opacity}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              unit="%"
              onChange={(opacity) => setTypography({ pill: { opacity } })}
            />
          </>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.text.color')}</Label>
          <SegmentedControl<ColorMode>
            name="text-color-mode"
            label={t('panel.text.color')}
            value={type.colorMode}
            options={[
              { value: 'auto', label: t('panel.text.color.auto') },
              { value: 'custom', label: t('panel.text.color.custom') },
            ]}
            onChange={(colorMode) => setTypography({ colorMode })}
          />
          {type.colorMode === 'custom' ? (
            <ColorField
              label={t('panel.text.color.custom')}
              hexLabel={t('panel.common.hex')}
              value={type.color}
              onChange={(color) => setTypography({ color })}
            />
          ) : (
            <p className="text-muted-foreground text-xs">{t('panel.text.color.auto.hint')}</p>
          )}
        </div>
      </PanelSection>
    </div>
  )
}
