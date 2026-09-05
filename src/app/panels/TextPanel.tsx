/**
 * 文字面板：内容、字体与排版、效果三组。
 *
 * v4 只有一种版式：图标（可选）→ 第一行 → 第二行的纵向栈。
 * 面板不再有「用途」，用户填三个原料：第一行、第二行、图标开关，
 * 排版由引擎自动适配，怎么填都出图。
 */

import { Suspense, useId, useMemo, useState } from 'react'
import { TypeIcon, XIcon } from 'lucide-react'
import { PanelSection } from '@/components/blocks/panel-section'
import { SegmentedControl, type SegmentedOption } from '@/components/blocks/segmented-control'
import { SliderField } from '@/components/blocks/slider-field'
import { ColorField } from '@/components/blocks/color-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/i18n'
import { FONT_SIZE_STEP, LINE_OVERRIDE_MAX, TEXT_EFFECTS, type TextEffect } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { twoLinesOf } from '@/text/wrap'
import { weightsOf } from './font-entries'
import { FontPickerLazy, IconPickerLazy } from './lazy'
import { GraphicThumb } from './GraphicThumb'

type ColorMode = 'auto' | 'custom'

/** 常用文字色预设：白、黑、米白、明黄，配投影反色适配逐一验过。 */
const COLOR_PRESETS: readonly { hex: string; key: 'white' | 'black' | 'cream' | 'yellow' }[] = [
  { hex: '#FFFFFF', key: 'white' },
  { hex: '#141413', key: 'black' },
  { hex: '#F5F1E8', key: 'cream' },
  { hex: '#FFD34D', key: 'yellow' },
]

/** 单行输入不允许带出换行：粘贴进来的多行在这里并成一行。 */
function stripBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '')
}

/** 第二行为空时不留尾随换行，存储形态与两行模型一一对应。 */
function joinLines(first: string, second: string): string {
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
  const setUi = useAvatarStore((state) => state.setUi)
  // 预览排版后回写的自动基准字号，与 fontSize 同一单位（画布短边比例）
  const autoFontSize = useAvatarStore((state) => state.ui.autoFontSize)
  const [fontOpen, setFontOpen] = useState(false)
  // 字体选择器是懒加载的，挂上就等于拉 chunk，所以只在用户点开之后才挂
  const [fontMounted, setFontMounted] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  // 图形选择器同字体一样：没点开过就不挂，避免把 cmdk 与索引拉进首屏
  const [iconMounted, setIconMounted] = useState(false)

  const type = config.typography
  const [first, second] = useMemo(() => twoLinesOf(config.text), [config.text])
  const hasFirst = first.trim() !== ''
  const hasSecond = second.trim() !== ''
  const iconEnabled = config.layout.icon.source !== 'none'
  const weights = useMemo(() => weightsOf(type.fontFamily), [type.fontFamily])

  const effectOptions: SegmentedOption<TextEffect>[] = TEXT_EFFECTS.map((effect) => ({
    value: effect,
    label: t(`panel.text.effect.${effect}`),
  }))

  return (
    <div className="flex flex-col">
      <PanelSection title={t('panel.text.group.basic')}>
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

        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="text-icon">{t('panel.text.icon')}</Label>
          <Switch
            id="text-icon"
            data-slot="text-icon-switch"
            className="after:-inset-y-[13px]"
            checked={iconEnabled}
            onCheckedChange={(enabled) => {
              // 开关打开即拉起图形选择器：选完图形开关才算真正点亮，
              // 关掉则清空图标，栈回到纯文字
              if (enabled) {
                setIconMounted(true)
                setIconOpen(true)
              } else {
                setLayout({ icon: { source: 'none', id: '' } })
              }
            }}
          />
        </div>
        {iconEnabled ? (
          <>
            <p className="text-muted-foreground text-xs">{t('panel.text.icon.hint')}</p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                data-slot="graphic-picker"
                className="h-11 min-w-0 flex-1 justify-start gap-2 px-2"
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
              {config.layout.icon.source !== 'none' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  data-slot="icon-clear"
                  aria-label={t('panel.text.icon.clear')}
                  title={t('panel.text.icon.clear')}
                  onClick={() => setLayout({ icon: { source: 'none', id: '' } })}
                >
                  <XIcon aria-hidden />
                </Button>
              ) : null}
            </div>
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
          </>
        ) : null}

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
        {/* 选择器挂载与 iconEnabled 无关：第一次选图形时开关还没点亮 */}
        {iconMounted ? (
          <Suspense fallback={null}>
            <IconPickerLazy open={iconOpen} onOpenChange={setIconOpen} />
          </Suspense>
        ) : null}
      </PanelSection>

      <PanelSection title={t('panel.text.group.type')}>
        {/* 字号：默认自动。滑杆在自动态显示引擎刚算出的值，一拖就以它为起点切到手动，
            不会从上一次的手动值跳过去；「自动」按钮点亮表示自动态，手动态点它回去 */}
        <SliderField
          label={t('panel.text.fontSize')}
          editLabel={t('panel.common.edit', { name: t('panel.text.fontSize') })}
          value={type.sizeMode === 'auto' ? (autoFontSize ?? type.fontSize) : type.fontSize}
          min={0.04}
          max={0.92}
          step={FONT_SIZE_STEP}
          scale={100}
          unit="%"
          auto={{
            active: type.sizeMode === 'auto',
            label: t('panel.text.fontSize.auto'),
            hint: t('panel.text.fontSize.autoHint'),
            onReset: () => {
              // 先清掉上一次的回写值：否则切回去的那一帧滑杆会先显示旧解再跳到新解。
              // 清空后滑杆停在当前手动值上，等预览求解完再滑到自动值
              setUi({ autoFontSize: null })
              setTypography({ sizeMode: 'auto' })
            },
          }}
          onChange={(fontSize) => setTypography({ sizeMode: 'manual', fontSize })}
        />

        {hasFirst && hasSecond ? (
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
        ) : null}

        {hasFirst ? (
          <SliderField
            label={t('panel.text.lineOffset', { index: 1 })}
            editLabel={t('panel.common.edit', {
              name: t('panel.text.lineOffset', { index: 1 }),
            })}
            value={type.lineOffsetsX[0] ?? 0}
            min={-0.25}
            max={0.25}
            step={0.0025}
            scale={100}
            precision={1}
            unit="%"
            onChange={(offset) =>
              setTypography({
                lineOffsetsX: withLineValue(type.lineOffsetsX, 0, offset, 0),
              })
            }
          />
        ) : null}

        {hasSecond ? (
          <SliderField
            label={t('panel.text.lineOffset', { index: 2 })}
            editLabel={t('panel.common.edit', {
              name: t('panel.text.lineOffset', { index: 2 }),
            })}
            value={type.lineOffsetsX[1] ?? 0}
            min={-0.25}
            max={0.25}
            step={0.0025}
            scale={100}
            precision={1}
            unit="%"
            onChange={(offset) =>
              setTypography({
                lineOffsetsX: withLineValue(type.lineOffsetsX, 1, offset, 0),
              })
            }
          />
        ) : null}

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
      </PanelSection>
    </div>
  )
}
