/**
 * 微调面板：全部数值滑杆按分组收在这里。画布尺寸与形状归导出抽屉，不在这。
 *
 * 默认收起。桌面打开时在最左侧多开一列，手机上就在挑选栏下面展开。
 * 开合状态由 inspector-open 这个模块级状态持有并落盘，手机与桌面共用同一个开关。
 *
 * 收起时整块不渲染，不是藏起来：Base UI 的滑杆在挂载那一刻量自己有多宽，
 * 在 display:none 里挂上就量到 0，之后即使显示出来滑块也一直是 visibility:hidden，
 * 键盘和拖动全都失灵。开的时候才挂，量到的就是真实宽度。
 */

import { useId, useMemo, type ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { SliderField, type SliderFieldProps } from '@/components/blocks/slider-field'
import { getStyle, type StyleParamKey } from '@/engine/styles'
import { useT } from '@/i18n'
import {
  DEFAULT_CONFIG,
  FONT_SIZE_STEP,
  STATUS_SECOND_LINE_SCALE,
  type PartialConfig,
} from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { useInspectorOpen } from '@/app/inspector-open'
import { StaggerRoot } from '@/app/showcase/stagger'
import { twoLinesOf } from '@/text/wrap'
import { withLineValue } from '@/app/workspace/shared'
import { SectionCard } from './sections/card'
import { cn } from '@/lib/utils'

/** 滑杆的显示口径：0..1 的参数显示成百分数，比例保留两位，角度带度数符号。 */
function displayOf(key: StyleParamKey): { scale: number; precision: number; unit: string } {
  if (key === 'scale') return { scale: 1, precision: 2, unit: '×' }
  if (key === 'rotation') return { scale: 1, precision: 0, unit: '°' }
  return { scale: 100, precision: 0, unit: '%' }
}

type RowProps = Omit<SliderFieldProps, 'editLabel' | 'resetLabel' | 'layout'>

/** 一行参数。编辑名与重置名都由标签派生，调用处只写标签。 */
function Row(props: RowProps) {
  const t = useT()
  return (
    <SliderField
      {...props}
      layout="row"
      editLabel={t('panel.common.edit', { name: props.label })}
      resetLabel={t('panel.common.reset', { name: props.label })}
    />
  )
}

/** 一组参数一张卡片，与挑选栏的节卡片同一套外观。 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SectionCard title={title} className="p-2.5">
      <div className="flex flex-col gap-1">{children}</div>
    </SectionCard>
  )
}

export function Inspector() {
  const t = useT()
  const bodyId = useId()
  const { open, toggle } = useInspectorOpen()

  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const setLayout = useAvatarStore((state) => state.setLayout)
  const setStyleParams = useAvatarStore((state) => state.setStyleParams)
  const setUi = useAvatarStore((state) => state.setUi)
  // 预览排版后回写的自动基准字号，与 fontSize 同一单位（画布短边比例）
  const autoFontSize = useAvatarStore((state) => state.ui.autoFontSize)

  const type = config.typography
  const defaults = DEFAULT_CONFIG.typography
  const [first, second] = useMemo(() => twoLinesOf(config.text), [config.text])
  const hasFirst = first.trim() !== ''
  const hasSecond = second.trim() !== ''
  const iconEnabled = config.layout.icon.source !== 'none'
  const params = getStyle(config.style).params

  return (
    <section
      data-slot="inspector"
      aria-label={t('panel.inspector.title')}
      className="flex flex-col gap-2"
    >
      <button
        type="button"
        data-slot="inspector-header"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        title={open ? t('panel.inspector.close') : t('panel.inspector.open')}
        className="text-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 items-center justify-between gap-2 px-1 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none"
      >
        {t('panel.inspector.title')}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            'size-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <StaggerRoot id={bodyId} className="flex flex-col gap-3 pb-2">
          <Group title={t('panel.text.group.type')}>
            {/* 字号：默认自动。滑杆在自动态显示引擎刚算出的值，一拖就以它为起点切到手动，
                不会从上一次的手动值跳过去。这一行不给默认值：回默认这件事由“自动”按钮承担，
                再挂一个把它按回 42% 的重置钮只会互相打架 */}
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
          </Group>

          {hasFirst || hasSecond ? (
            <Group title={t('panel.inspector.group.line')}>
              {hasFirst && hasSecond ? (
                <Row
                  label={t('panel.layout.scale')}
                  value={type.lineSizeScales[1] ?? STATUS_SECOND_LINE_SCALE}
                  defaultValue={defaults.lineSizeScales[1] ?? STATUS_SECOND_LINE_SCALE}
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
                <Row
                  label={t('panel.text.lineOffset', { index: 1 })}
                  value={type.lineOffsetsX[0] ?? 0}
                  defaultValue={defaults.lineOffsetsX[0] ?? 0}
                  min={-0.25}
                  max={0.25}
                  step={0.0025}
                  scale={100}
                  precision={1}
                  unit="%"
                  onChange={(offset) =>
                    setTypography({ lineOffsetsX: withLineValue(type.lineOffsetsX, 0, offset, 0) })
                  }
                />
              ) : null}
              {hasSecond ? (
                <Row
                  label={t('panel.text.lineOffset', { index: 2 })}
                  value={type.lineOffsetsX[1] ?? 0}
                  defaultValue={defaults.lineOffsetsX[1] ?? 0}
                  min={-0.25}
                  max={0.25}
                  step={0.0025}
                  scale={100}
                  precision={1}
                  unit="%"
                  onChange={(offset) =>
                    setTypography({ lineOffsetsX: withLineValue(type.lineOffsetsX, 1, offset, 0) })
                  }
                />
              ) : null}
            </Group>
          ) : null}

          {iconEnabled ? (
            <Group title={t('panel.graphic.title')}>
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
              <Row
                label={t('panel.graphic.offset')}
                value={config.layout.graphicOffsetX}
                defaultValue={DEFAULT_CONFIG.layout.graphicOffsetX}
                min={-0.25}
                max={0.25}
                step={0.0025}
                scale={100}
                precision={1}
                unit="%"
                onChange={(graphicOffsetX) => setLayout({ graphicOffsetX })}
              />
            </Group>
          ) : null}

          <Group title={t('panel.text.group.effect')}>
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
          </Group>

          <Group title={t('panel.style.title')}>
            {params.map((param) => {
              const view = displayOf(param.key)
              return (
                <Row
                  key={param.key}
                  label={t(param.labelKey)}
                  value={config.styleParams[param.key]}
                  defaultValue={DEFAULT_CONFIG.styleParams[param.key]}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  scale={view.scale}
                  precision={view.precision}
                  unit={view.unit}
                  onChange={(value) => {
                    const patch: NonNullable<PartialConfig['styleParams']> = {}
                    patch[param.key] = value
                    setStyleParams(patch)
                  }}
                />
              )
            })}
            <Row
              label={t('panel.style.highlight')}
              value={config.highlight}
              defaultValue={DEFAULT_CONFIG.highlight}
              min={0}
              max={1}
              step={0.01}
              scale={100}
              unit="%"
              onChange={(highlight) => setConfig({ highlight })}
            />
          </Group>
        </StaggerRoot>
      ) : null}
    </section>
  )
}
