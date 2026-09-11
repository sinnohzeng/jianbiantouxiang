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
import {
  DEFAULT_CONFIG,
  FONT_SIZE_STEP,
  STATUS_SECOND_LINE_SCALE,
  TEXT_EFFECTS,
} from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { twoLinesOf } from '@/text/wrap'
import { weightsOf } from '@/app/panels/font-entries'
import { FontPickerLazy } from '@/app/panels/lazy'
import { joinLines, stripBreaks, withLineValue } from '@/app/workspace/shared'
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

/** 逐行补偿两条共用：量程 ±25%，步进 0.25%，显示一位小数。 */
const OFFSET_RANGE = {
  min: -0.25,
  max: 0.25,
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
  // 预览排版后回写的自动基准字号，与 fontSize 同一单位（画布短边比例）
  const autoFontSize = useAvatarStore((state) => state.ui.autoFontSize)
  const [fontOpen, setFontOpen] = useState(false)
  // 字体选择器是懒加载的，挂上就等于拉 chunk，所以只在用户点开之后才挂
  const [fontMounted, setFontMounted] = useState(false)

  const type = config.typography
  const defaults = DEFAULT_CONFIG.typography
  const [first, second] = useMemo(() => twoLinesOf(config.text), [config.text])
  const hasFirst = first.trim() !== ''
  const hasSecond = second.trim() !== ''
  const weights = useMemo(() => weightsOf(type.fontFamily), [type.fontFamily])

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
              // 先清掉上一次的回写值：否则切回去的那一帧滑杆会先显示旧解再跳到新解
              setUi({ autoFontSize: null })
              setTypography({ sizeMode: 'auto' })
            },
          }}
          onChange={(fontSize) => setTypography({ sizeMode: 'manual', fontSize })}
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

      {/* 第二行字号是相对第一行的百分比，两行都有内容才谈得上比例 */}
      {hasFirst && hasSecond ? (
        <div data-slot="text-line2-size">
          <Row
            label={t('panel.text.line2Size')}
            value={type.lineSizeScales[1] ?? STATUS_SECOND_LINE_SCALE}
            defaultValue={defaults.lineSizeScales[1] ?? STATUS_SECOND_LINE_SCALE}
            min={0.2}
            max={0.8}
            step={0.01}
            scale={100}
            unit="%"
            onChange={(scale) =>
              setTypography({ lineSizeScales: withLineValue(type.lineSizeScales, 1, scale, 1) })
            }
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

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-[11px]">{t('panel.text.fontWeight')}</Label>
        <ChipGroup
          name="text-weight"
          label={t('panel.text.fontWeight')}
          value={type.fontWeight}
          options={weights.map((weight) => ({ value: weight, label: String(weight) }))}
          onChange={(fontWeight) => setTypography({ fontWeight })}
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
                value={type.lineOffsetsX[0] ?? 0}
                defaultValue={defaults.lineOffsetsX[0] ?? 0}
                {...OFFSET_RANGE}
                onChange={(offset) =>
                  setTypography({ lineOffsetsX: withLineValue(type.lineOffsetsX, 0, offset, 0) })
                }
              />
              <Row
                label={t('panel.text.lineOffsetY', { index: 1 })}
                value={type.lineOffsetsY[0] ?? 0}
                defaultValue={defaults.lineOffsetsY[0] ?? 0}
                {...OFFSET_RANGE}
                onChange={(offset) =>
                  setTypography({ lineOffsetsY: withLineValue(type.lineOffsetsY, 0, offset, 0) })
                }
              />
            </>
          ) : null}
          {hasSecond ? (
            <>
              <Row
                label={t('panel.text.lineOffsetX', { index: 2 })}
                value={type.lineOffsetsX[1] ?? 0}
                defaultValue={defaults.lineOffsetsX[1] ?? 0}
                {...OFFSET_RANGE}
                onChange={(offset) =>
                  setTypography({ lineOffsetsX: withLineValue(type.lineOffsetsX, 1, offset, 0) })
                }
              />
              <Row
                label={t('panel.text.lineOffsetY', { index: 2 })}
                value={type.lineOffsetsY[1] ?? 0}
                defaultValue={defaults.lineOffsetsY[1] ?? 0}
                {...OFFSET_RANGE}
                onChange={(offset) =>
                  setTypography({ lineOffsetsY: withLineValue(type.lineOffsetsY, 1, offset, 0) })
                }
              />
            </>
          ) : null}
        </PanelSection>
      ) : null}
    </SectionCard>
  )
}
