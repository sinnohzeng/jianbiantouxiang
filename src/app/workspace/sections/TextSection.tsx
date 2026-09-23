/**
 * 文字节：两行输入、字体、字重、样式、文字色，以及跟着它们的数值滑杆。
 *
 * 参数跟着它所修饰的东西走：字号紧跟自己那一行输入，强度紧跟文字样式。
 * 低频的两组收在末尾的折叠组里，默认收起：“版面”是边距行高字距，
 * “位置微调”是逐行的水平与垂直补偿。
 */

import { Suspense, useId, useMemo, useState } from 'react'
import { TypeIcon } from 'lucide-react'
import { ColorField } from '@/components/blocks/color-field'
import { PanelSection } from '@/components/blocks/panel-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { displayName, weightsOf } from '@/fonts/catalog'
import {
  DEFAULT_CONFIG,
  FONT_SIZE_STEP,
  LINE2_FOLLOW_SCALE,
  LINE2_SIZE_MIN,
  LINE_OFFSET_MAX,
  LINE_SIZE_MAX,
  LINE_SIZE_MIN,
  TEXT_EFFECTS,
  snapFontRatio,
  twoLinesOf,
  withLine1Font,
} from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { FontPickerLazy } from '@/app/panels/lazy'
import { joinLines, stripBreaks } from '@/app/workspace/shared'
import { clamp } from '@/engine/math'
import { SectionCard } from './card'
import { Row } from './row'

/**
 * 常用文字色预设：一档白、三档灰、一档黑，从纯白一路走到纯黑。
 *
 * 头像上的文字色实际只在这条明度轴上挑，彩色文字压在彩色渐变上几乎必然脏。
 * 想要别的颜色仍可以拧右边的取色器，这排色块只是把高频的那几档摆出来。
 */
const COLOR_PRESETS: readonly {
  hex: string
  key: 'white' | 'silver' | 'gray' | 'ink' | 'black'
}[] = [
  { hex: '#FFFFFF', key: 'white' },
  { hex: '#D4D4D8', key: 'silver' },
  { hex: '#9CA3AF', key: 'gray' },
  { hex: '#141413', key: 'ink' },
  { hex: '#000000', key: 'black' },
]

/** 逐行补偿四条共用：量程取契约上限，步进 0.25%，显示一位小数。 */
const OFFSET_RANGE = {
  min: -LINE_OFFSET_MAX,
  max: LINE_OFFSET_MAX,
  step: 0.0025,
  scale: 100,
  precision: 1,
  unit: '%',
} as const

/**
 * 一排可换行的 radio chips，字重与文字样式共用。
 * 分段控件在 250–300 px 的列里会把选项文案截成「Shad…」：它的选项等分容器宽，
 * 文案长度不由自己决定。chips 按内容自适应、放不下就换行，永不截断。
 */
function ChipGroup<T extends string | number>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const uid = useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5 lg:gap-1">
      {options.map((option) => (
        <label key={String(option.value)} className="relative cursor-pointer">
          <input
            type="radio"
            className="peer sr-only"
            name={`${name}-${uid}`}
            data-group={name}
            value={String(option.value)}
            checked={value === option.value}
            onChange={(event) => {
              if (event.target.checked) onChange(option.value)
            }}
          />
          <span className="border-border peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-ring/50 flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm tabular-nums transition-colors peer-focus-visible:ring-3 motion-reduce:transition-none lg:h-7 lg:min-w-7 lg:px-2 lg:text-xs">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}

export function TextSection() {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const setUi = useAvatarStore((state) => state.setUi)
  // 预览排版后回写的自动基准字号，与 line1.size 同一单位（画布短边比例）
  const autoFontSize = useAvatarStore((state) => state.ui.autoFontSize)
  const [fontOpen, setFontOpen] = useState(false)
  // 字体选择器是懒加载的，挂上就等于拉 chunk，所以只在用户点开之后才挂
  const [fontMounted, setFontMounted] = useState(false)

  const type = config.typography
  const { line1, line2 } = type
  const defaults = DEFAULT_CONFIG.typography
  const [first, second] = useMemo(() => twoLinesOf(config.text), [config.text])
  const hasFirst = first.trim() !== ''
  const hasSecond = second.trim() !== ''
  const weights = useMemo(() => weightsOf(line1.font.family), [line1.font.family])
  // 第一行的当前基准：自动态是预览回写的解，定值态是配置值；第二行跟随时取它的 62%。
  // 滑杆显示的自动值向下对齐到步进：值在网格上，轻触滑杆不会被取整到比求解上限更大的一档；
  // 钉住第二行时用未取整的基准，钉完的那一帧一个像素都不动
  const baseFontSize = line1.size ?? autoFontSize ?? LINE_SIZE_MIN
  const shownFontSize = line1.size === null ? snapFontRatio(baseFontSize) : baseFontSize
  const followSize = clamp(baseFontSize * LINE2_FOLLOW_SCALE, LINE2_SIZE_MIN, LINE_SIZE_MAX)

  const effectOptions = TEXT_EFFECTS.map((effect) => ({
    value: effect,
    label: t(`panel.text.effect.${effect}`),
  }))

  return (
    <SectionCard title={t('panel.text.title')}>
      <div className="flex flex-col gap-1">
        <Label htmlFor="avatar-text-first" className="text-muted-foreground text-[11px]">
          {t('panel.text.line1')}
        </Label>
        <Input
          id="avatar-text-first"
          data-slot="text-line1"
          className="h-11 lg:h-9"
          value={first}
          placeholder={t('panel.text.line1.placeholder')}
          onChange={(event) =>
            setConfig({ text: joinLines(stripBreaks(event.target.value), second) })
          }
        />
      </div>

      {/* 字号：默认自动。滑杆在自动态显示引擎刚算出的值，一拖就以它为起点切到手动，
          不会从上一次的手动值跳过去。这一行不给默认值：回默认这件事由“自动”按钮承担，
          再挂一个把它按回 42% 的重置钮只会互相打架 */}
      <div data-slot="text-font-size">
        <Row
          label={t('panel.text.fontSize')}
          value={shownFontSize}
          min={LINE_SIZE_MIN}
          max={LINE_SIZE_MAX}
          step={FONT_SIZE_STEP}
          scale={100}
          unit="%"
          auto={{
            active: line1.size === null,
            label: t('panel.text.fontSize.auto'),
            hint: t('panel.text.fontSize.autoHint'),
            onReset: () => {
              // 用当前定值占位，直到预览回写新解：滑杆原地不动，不会先闪一下上一次的旧解
              if (line1.size !== null) setUi({ autoFontSize: line1.size })
              setTypography({ line1: { size: null } })
            },
          }}
          onChange={(size) =>
            setTypography({
              line1: { size },
              // 第二行还在跟随时先把它钉在此刻的大小：拖第一行只动第一行
              ...(hasFirst && hasSecond && line2.size === null
                ? { line2: { size: followSize } }
                : {}),
            })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="avatar-text-second" className="text-muted-foreground text-[11px]">
          {t('panel.text.line2')}
        </Label>
        <Input
          id="avatar-text-second"
          data-slot="text-line2"
          className="h-11 lg:h-9"
          value={second}
          placeholder={t('panel.text.line2.placeholder')}
          onChange={(event) =>
            setConfig({ text: joinLines(first, stripBreaks(event.target.value)) })
          }
        />
      </div>

      {/* 第二行字号与第一行同一单位。默认跟随第一行取 62%，一拖就钉成自己的值，
          点“自动”回到跟随。两行都有内容才有这一行 */}
      {hasFirst && hasSecond ? (
        <div data-slot="text-line2-size">
          <Row
            label={t('panel.text.line2Size')}
            value={line2.size ?? followSize}
            min={LINE2_SIZE_MIN}
            max={LINE_SIZE_MAX}
            step={FONT_SIZE_STEP}
            scale={100}
            unit="%"
            auto={{
              active: line2.size === null,
              label: t('panel.text.fontSize.auto'),
              hint: t('panel.text.line2Size.autoHint'),
              onReset: () => setTypography({ line2: { size: null } }),
            }}
            onChange={(size) => setTypography({ line2: { size } })}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-[11px]">{t('panel.text.font')}</Label>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-between px-3 lg:h-9"
          onClick={() => {
            setFontMounted(true)
            setFontOpen(true)
          }}
        >
          <span className="truncate">{displayName(line1.font.family, line1.font.source)}</span>
          <TypeIcon aria-hidden="true" />
        </Button>
        {/* 打开过一次就一直挂着，关闭动画才有得放；没打开过就不拉那份 chunk */}
        {fontMounted ? (
          <Suspense fallback={null}>
            <FontPickerLazy open={fontOpen} onOpenChange={setFontOpen} />
          </Suspense>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-[11px]">{t('panel.text.fontWeight')}</Label>
        <ChipGroup
          name="text-weight"
          label={t('panel.text.fontWeight')}
          value={line1.font.weight}
          options={weights.map((weight) => ({ value: weight, label: String(weight) }))}
          onChange={(weight) =>
            setTypography(withLine1Font(type, { ...line1.font, weight }, weights))
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-[11px]">{t('panel.text.effect')}</Label>
        <ChipGroup
          name="text-effect"
          label={t('panel.text.effect')}
          value={type.effect}
          options={effectOptions}
          onChange={(effect) => setTypography({ effect })}
        />
      </div>

      {/* 纯色没有强度可言，禁用而不是抽掉：抽掉会让下面那几行在切样式时上下跳 */}
      <div data-slot="text-effect-strength">
        <Row
          label={t('panel.text.effectStrength')}
          value={type.effectStrength}
          defaultValue={defaults.effectStrength}
          min={0}
          max={1}
          step={0.01}
          scale={100}
          unit="%"
          disabled={type.effect === 'plain'}
          onChange={(effectStrength) => setTypography({ effectStrength })}
        />
      </div>

      {type.effect === 'pill' ? (
        <>
          <Row
            label={t('panel.text.pill.radius')}
            value={type.pill.radius}
            defaultValue={defaults.pill.radius}
            min={0}
            max={0.5}
            step={0.01}
            scale={100}
            unit="%"
            onChange={(radius) => setTypography({ pill: { radius } })}
          />
          <Row
            label={t('panel.text.pill.padding')}
            value={type.pill.padding}
            defaultValue={defaults.pill.padding}
            min={0}
            max={1}
            step={0.01}
            scale={100}
            unit="%"
            onChange={(padding) => setTypography({ pill: { padding } })}
          />
          <Row
            label={t('panel.text.pill.opacity')}
            value={type.pill.opacity}
            defaultValue={defaults.pill.opacity}
            min={0}
            max={1}
            step={0.01}
            scale={100}
            unit="%"
            onChange={(opacity) => setTypography({ pill: { opacity } })}
          />
        </>
      ) : null}

      {/* v5 起没有「自动」：文字色就是这里挑的那一个，预览与导出读同一个字段。
          自动取色要另起一次离屏渲染去采样，结果还会随高光与种子飘，
          用户看到的是「我没动它，颜色自己变了」 */}
      <div data-slot="text-color-row">
        <ColorField
          inline
          rowLabel={t('panel.text.color')}
          label={t('panel.text.color')}
          value={type.color}
          presets={COLOR_PRESETS.map((preset) => ({
            hex: preset.hex,
            label: t(`panel.text.color.preset.${preset.key}`),
          }))}
          onChange={(color) => setTypography({ color })}
        />
      </div>

      <PanelSection
        data-slot="text-group-layout"
        title={t('panel.text.group.layout')}
        defaultOpen={false}
      >
        <Row
          label={t('panel.text.padding')}
          value={type.padding}
          defaultValue={defaults.padding}
          min={0}
          max={0.3}
          step={0.005}
          scale={100}
          unit="%"
          onChange={(padding) => setTypography({ padding })}
        />
        <Row
          label={t('panel.text.lineHeight')}
          value={type.lineHeight}
          defaultValue={defaults.lineHeight}
          min={0.85}
          max={2}
          step={0.01}
          precision={2}
          onChange={(lineHeight) => setTypography({ lineHeight })}
        />
        <Row
          label={t('panel.text.letterSpacing')}
          value={type.letterSpacing}
          defaultValue={defaults.letterSpacing}
          min={-0.1}
          max={0.5}
          step={0.01}
          precision={2}
          unit="em"
          onChange={(letterSpacing) => setTypography({ letterSpacing })}
        />
      </PanelSection>

      {/* 补偿是纯位移，不参与字号求解；哪一行有内容才给哪一行的两条 */}
      {hasFirst || hasSecond ? (
        <PanelSection
          data-slot="text-group-offset"
          title={t('panel.common.group.offset')}
          defaultOpen={false}
        >
          {hasFirst ? (
            <>
              <Row
                label={t('panel.text.lineOffsetX', { index: 1 })}
                value={line1.offsetX}
                defaultValue={defaults.line1.offsetX}
                {...OFFSET_RANGE}
                onChange={(offsetX) => setTypography({ line1: { offsetX } })}
              />
              <Row
                label={t('panel.text.lineOffsetY', { index: 1 })}
                value={line1.offsetY}
                defaultValue={defaults.line1.offsetY}
                {...OFFSET_RANGE}
                onChange={(offsetY) => setTypography({ line1: { offsetY } })}
              />
            </>
          ) : null}
          {hasSecond ? (
            <>
              <Row
                label={t('panel.text.lineOffsetX', { index: 2 })}
                value={line2.offsetX}
                defaultValue={defaults.line2.offsetX}
                {...OFFSET_RANGE}
                onChange={(offsetX) => setTypography({ line2: { offsetX } })}
              />
              <Row
                label={t('panel.text.lineOffsetY', { index: 2 })}
                value={line2.offsetY}
                defaultValue={defaults.line2.offsetY}
                {...OFFSET_RANGE}
                onChange={(offsetY) => setTypography({ line2: { offsetY } })}
              />
            </>
          ) : null}
        </PanelSection>
      ) : null}
    </SectionCard>
  )
}
