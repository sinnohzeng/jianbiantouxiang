/**
 * 文字节：两行输入、字体、字重、效果与文字色。全是“挑”的动作，
 * 数值微调（字号、行距、字距、边距、效果强度、胶囊三参）在检查器带里。
 */

import { Suspense, useId, useMemo, useState } from 'react'
import { TypeIcon } from 'lucide-react'
import { ColorField } from '@/components/blocks/color-field'
import { SegmentedControl, type SegmentedOption } from '@/components/blocks/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { TEXT_EFFECTS, type TextEffect } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { twoLinesOf } from '@/text/wrap'
import { weightsOf } from '@/app/panels/font-entries'
import { FontPickerLazy } from '@/app/panels/lazy'
import { joinLines, stripBreaks } from '@/app/workspace/shared'
import { SectionCard } from './card'

type ColorMode = 'auto' | 'custom'

/** 常用文字色预设：白、黑、米白、明黄，配投影反色适配逐一验过。 */
const COLOR_PRESETS: readonly { hex: string; key: 'white' | 'black' | 'cream' | 'yellow' }[] = [
  { hex: '#FFFFFF', key: 'white' },
  { hex: '#141413', key: 'black' },
  { hex: '#F5F1E8', key: 'cream' },
  { hex: '#FFD34D', key: 'yellow' },
]

export function TextSection() {
  const t = useT()
  const uid = useId()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const [fontOpen, setFontOpen] = useState(false)
  // 字体选择器是懒加载的，挂上就等于拉 chunk，所以只在用户点开之后才挂
  const [fontMounted, setFontMounted] = useState(false)

  const type = config.typography
  const [first, second] = useMemo(() => twoLinesOf(config.text), [config.text])
  const weights = useMemo(() => weightsOf(type.fontFamily), [type.fontFamily])

  const effectOptions: SegmentedOption<TextEffect>[] = TEXT_EFFECTS.map((effect) => ({
    value: effect,
    label: t(`panel.text.effect.${effect}`),
  }))

  return (
    <SectionCard title={t('panel.text.title')}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avatar-text-first">{t('panel.text.line1')}</Label>
        <Input
          id="avatar-text-first"
          data-slot="text-line1"
          className="h-11"
          value={first}
          placeholder={t('panel.text.line1.placeholder')}
          onChange={(event) =>
            setConfig({ text: joinLines(stripBreaks(event.target.value), second) })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avatar-text-second">{t('panel.text.line2')}</Label>
        <Input
          id="avatar-text-second"
          data-slot="text-line2"
          className="h-11"
          value={second}
          placeholder={t('panel.text.line2.placeholder')}
          onChange={(event) =>
            setConfig({ text: joinLines(first, stripBreaks(event.target.value)) })
          }
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
            presets={COLOR_PRESETS.map((preset) => ({
              hex: preset.hex,
              label: t(`panel.text.color.preset.${preset.key}`),
            }))}
            onChange={(color) => setTypography({ color })}
          />
        ) : (
          <p className="text-muted-foreground text-xs">{t('panel.text.color.auto.hint')}</p>
        )}
      </div>
    </SectionCard>
  )
}
