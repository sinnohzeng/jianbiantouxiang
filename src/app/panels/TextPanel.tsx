/**
 * 文字面板：用途与内容、字体与排版、效果三组。
 * 分组用可折叠区块，基础与排版默认展开，效果收起，手机上一屏能看完前两组。
 *
 * 用途分段控件放在最上面：它决定下面露出哪些控件，先选用途再填内容，顺序与人的想法一致。
 */

import { Suspense, useId, useMemo, useState } from 'react'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  TypeIcon,
} from 'lucide-react'
import { PanelSection } from '@/components/blocks/panel-section'
import { SegmentedControl, type SegmentedOption } from '@/components/blocks/segmented-control'
import { SliderField } from '@/components/blocks/slider-field'
import { ColorField } from '@/components/blocks/color-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n'
import {
  LINE_OVERRIDE_MAX,
  ANCHORS,
  TEXT_EFFECTS,
  type Anchor,
  type LayoutKind,
  type TextEffect,
} from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'
import { splitParagraphs } from '@/text/wrap'
import { weightsOf } from './font-entries'
import { FontPickerLazy, IconPickerLazy } from './lazy'
import { GraphicThumb } from './GraphicThumb'

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

/**
 * 状态徽章的两行。按第一个换行切开，其余换行留在次行里，
 * 用户在纯文字用途下打的多段文字切过来不会被砍掉。
 */
function splitStatus(text: string): [string, string] {
  const at = text.indexOf('\n')
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)]
}

/** 次行为空时不留尾随换行，免得切回纯文字用途时多出一个空段。 */
function joinStatus(first: string, second: string): string {
  return second === '' ? first : `${first}\n${second}`
}

function withLineValue(
  values: readonly number[],
  index: number,
  value: number,
  fallback: number,
): number[] {
  const length = Math.min(Math.max(values.length, index + 1), LINE_OVERRIDE_MAX)
  const next = Array.from({ length }, (_, position) => values[position] ?? fallback)
  next[index] = value
  return next
}

export function TextPanel() {
  const t = useT()
  const uid = useId()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const setLayout = useAvatarStore((state) => state.setLayout)
  const [fontOpen, setFontOpen] = useState(false)
  // 字体选择器是懒加载的，挂上就等于拉 chunk，所以只在用户点开之后才挂
  const [fontMounted, setFontMounted] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  // 图形选择器同字体一样：没点开过就不挂，避免把 cmdk 与索引拉进首屏
  const [iconMounted, setIconMounted] = useState(false)

  const type = config.typography
  const kind = config.layout.kind
  // 状态徽章的版式写死在代码里：整块在安全框里居中，逐行横排。
  // 锚点、偏移、对齐、竖排、自动换行在这个用途下都不参与求解，
  // 留在界面上只会让人以为能调，调完发现画面没变
  const freeform = kind === 'text'
  const [first, second] = splitStatus(config.text)
  const weights = useMemo(() => weightsOf(type.fontFamily), [type.fontFamily])
  const paragraphs = useMemo(() => splitParagraphs(config.text), [config.text])
  const lineCount = Math.min(paragraphs.length, LINE_OVERRIDE_MAX)

  // 图标是给名字加个锚，不替代名字：这一档选错，后面填的内容全排在错的版式上
  const kindOptions: SegmentedOption<LayoutKind>[] = [
    {
      value: 'text',
      label: t('panel.text.kind.text'),
      icon: (
        <>
          <TypeIcon aria-hidden="true" />
          <span className="truncate">{t('panel.text.kind.text')}</span>
        </>
      ),
    },
    {
      value: 'status',
      label: t('panel.text.kind.status'),
      icon: (
        <>
          <CalendarClockIcon aria-hidden="true" />
          <span className="truncate">{t('panel.text.kind.status')}</span>
        </>
      ),
    },
    {
      value: 'logo',
      label: t('panel.text.kind.logo'),
      icon: (
        <>
          <BadgeCheckIcon aria-hidden="true" />
          <span className="truncate">{t('panel.text.kind.logo')}</span>
        </>
      ),
    },
  ]

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
          <Label>{t('panel.text.kind')}</Label>
          <SegmentedControl<LayoutKind>
            name="text-kind"
            label={t('panel.text.kind')}
            value={kind}
            options={kindOptions}
            onChange={(next) => setLayout({ kind: next })}
          />
          {kind === 'status' ? (
            <p className="text-muted-foreground text-xs">{t('panel.text.kind.status.hint')}</p>
          ) : null}
          {kind === 'logo' ? (
            <p className="text-muted-foreground text-xs">{t('panel.text.kind.logo.hint')}</p>
          ) : null}
          {kind === 'status' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avatar-text-first">{t('panel.text.line1')}</Label>
              <Input
                id="avatar-text-first"
                className="h-11"
                value={first}
                placeholder={t('panel.text.line1.placeholder')}
                onChange={(event) => setConfig({ text: joinStatus(event.target.value, second) })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avatar-text-second">{t('panel.text.line2')}</Label>
              <Input
                id="avatar-text-second"
                className="h-11"
                value={second}
                placeholder={t('panel.text.line2.placeholder')}
                onChange={(event) => setConfig({ text: joinStatus(first, event.target.value) })}
              />
            </div>

            <SliderField
              label={t('panel.layout.scale')}
              editLabel={t('panel.common.edit', { name: t('panel.layout.scale') })}
              value={type.lineSizeScales[1] ?? 0.62}
              min={0.2}
              max={0.8}
              step={0.01}
              scale={100}
              unit="%"
              onChange={(scale) =>
                setTypography({
                  lineSizeScales: withLineValue(type.lineSizeScales, 1, scale, 1),
                })
              }
            />
          </>
        ) : (
          <>
            {kind === 'logo' ? (
              <div className="flex flex-col gap-1.5">
                <Label>{t('panel.graphic.title')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  data-slot="graphic-picker"
                  className="h-11 w-full justify-start gap-2 px-2"
                  onClick={() => {
                    setIconMounted(true)
                    setIconOpen(true)
                  }}
                >
                  <GraphicThumb
                    icon={config.layout.icon}
                    config={config}
                    color={type.colorMode === 'custom' ? type.color : '#ffffff'}
                  />
                  <span className="truncate">
                    {config.layout.icon.source === 'none'
                      ? t('panel.graphic.empty')
                      : config.layout.icon.id || t('panel.graphic.current')}
                  </span>
                </Button>
                {iconMounted ? (
                  <Suspense fallback={null}>
                    <IconPickerLazy open={iconOpen} onOpenChange={setIconOpen} />
                  </Suspense>
                ) : null}
              </div>
            ) : null}

            {kind === 'logo' ? (
              <SliderField
                label={t('panel.graphic.scale')}
                editLabel={t('panel.common.edit', { name: t('panel.graphic.scale') })}
                value={config.layout.graphic}
                min={0.3}
                max={0.8}
                step={0.01}
                scale={100}
                unit="%"
                onChange={(graphic) => setLayout({ graphic })}
              />
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avatar-text">{t('panel.text.content')}</Label>
              <Textarea
                id="avatar-text"
                className="min-h-24"
                value={config.text}
                placeholder={t('panel.text.placeholder')}
                onChange={(event) => setConfig({ text: event.target.value })}
              />
            </div>
          </>
        )}
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

        {freeform && !type.vertical && lineCount > 1
          ? Array.from({ length: lineCount }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <SliderField
                  label={`${t('panel.text.lineSize', { index: index + 1 })} · ${paragraphs[index] ?? ''}`}
                  editLabel={t('panel.common.edit', {
                    name: t('panel.text.lineSize', { index: index + 1 }),
                  })}
                  showInput
                  value={type.lineSizeScales[index] ?? 1}
                  min={0.2}
                  max={2}
                  step={0.01}
                  scale={100}
                  precision={0}
                  unit="%"
                  onChange={(scale) =>
                    setTypography({
                      lineSizeScales: withLineValue(type.lineSizeScales, index, scale, 1),
                    })
                  }
                />
                <SliderField
                  label={t('panel.text.lineOffset', { index: index + 1 })}
                  editLabel={t('panel.common.edit', {
                    name: t('panel.text.lineOffset', { index: index + 1 }),
                  })}
                  value={type.lineOffsetsX[index] ?? 0}
                  min={-0.25}
                  max={0.25}
                  step={0.0025}
                  scale={100}
                  precision={1}
                  unit="%"
                  onChange={(offset) =>
                    setTypography({
                      lineOffsetsX: withLineValue(type.lineOffsetsX, index, offset, 0),
                    })
                  }
                />
              </div>
            ))
          : null}

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

        {freeform ? (
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
        ) : null}

        {freeform ? (
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
        ) : null}

        {freeform ? (
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
        ) : null}

        {freeform ? (
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
        ) : null}

        {freeform ? (
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
        ) : null}

        {freeform ? (
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="text-auto-wrap">{t('panel.text.autoWrap')}</Label>
            <Switch
              id="text-auto-wrap"
              className="after:-inset-y-[13px]"
              checked={type.autoWrap}
              onCheckedChange={(autoWrap) => setTypography({ autoWrap })}
            />
          </div>
        ) : null}
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
