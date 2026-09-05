/**
 * 检查器带：全部数值微调收在这一条里，一行“标签 | 滑杆 | 数字框”。
 *
 * 桌面是第三列，标题常驻；手机是内容区末尾的“微调”节，默认收起。
 * 收起只是把这块藏起来，不卸载：断点在 1024 处来回穿越时不该把编辑到一半的数字框弄丢。
 */

import { useId, useMemo, useState, type ReactNode } from 'react'
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
import { twoLinesOf } from '@/text/wrap'
import { withLineValue } from '@/app/workspace/shared'
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-muted-foreground px-1 text-xs font-medium">{title}</h3>
      {children}
    </div>
  )
}

export function Inspector() {
  const t = useT()
  const bodyId = useId()
  // 手机上的折叠态。桌面靠 CSS 恒展开，不参与这个状态
  const [open, setOpen] = useState(false)

  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const setLayout = useAvatarStore((state) => state.setLayout)
  const setStyleParams = useAvatarStore((state) => state.setStyleParams)
  const setCanvas = useAvatarStore((state) => state.setCanvas)
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
      {/* 手机上是折叠开关，桌面上换成一行常驻标题 */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 items-center justify-between gap-2 px-1 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none lg:hidden"
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
      <h2 className="text-muted-foreground hidden px-1 text-sm font-semibold lg:block">
        {t('panel.inspector.title')}
      </h2>

      {/* 两列档（1024 到 1279）检查器带落在预览下方，分组按两栏紧凑排，高度减半；
          三列档回到一条竖带 */}
      <div
        id={bodyId}
        className={cn(
          'flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5 xl:grid-cols-1',
          open ? 'flex' : 'hidden',
        )}
      >
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
                  setTypography({ lineSizeScales: withLineValue(type.lineSizeScales, 1, scale, 1) })
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

        {config.canvas.shape === 'rounded' ? (
          <Group title={t('panel.canvas.title')}>
            <Row
              label={t('panel.canvas.radius')}
              value={config.canvas.radius}
              defaultValue={DEFAULT_CONFIG.canvas.radius}
              min={0}
              max={0.5}
              step={0.01}
              scale={100}
              unit="%"
              onChange={(radius) => setCanvas({ radius })}
            />
          </Group>
        ) : null}
      </div>
    </section>
  )
}
