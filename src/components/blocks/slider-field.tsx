/**
 * 带数值输入的滑杆，范式取自 @shadcnblocks/slider-slider-standard-3：
 * 标签在左、当前值在右。这里数值框常驻，拖不准的值直接敲；给了 `defaultValue`
 * 的行在偏离默认值时多出一个重置小钮，桌面悬停或聚焦才显形，触控设备常显。
 *
 * 两种排布：`stack` 是挑选栏里的上下两行；`row` 是检查器带的
 * “标签 | 滑杆 | 数字框”一行，桌面 32 px 高，手机仍撑到 44 px。
 *
 * 数值变化时框里的数走一段弹簧过渡，只影响显示，真实值仍然一步到位。
 */

import { useEffect, useId, useRef, useState } from 'react'
import { RotateCcwIcon } from 'lucide-react'
import { useAnimatedNumber } from '@/app/showcase/use-animated-number'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** 显示值与真实值的倍数，比例参数传 100 就显示成百分数。 */
  scale?: number
  /** 显示与输入的小数位。 */
  precision?: number
  /** 数值后缀，如 % 或 em。聚焦编辑时让位给纯数字。 */
  unit?: string
  /** 数值框的可访问名，形如“编辑字号”。 */
  editLabel: string
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  /** 数值框常驻。设成 false 就只剩滑杆。 */
  showInput?: boolean
  /** 排布形态：挑选栏用 stack，检查器带用 row。 */
  layout?: 'stack' | 'row'
  /** 这一项的默认值。给了才有重置钮。 */
  defaultValue?: number
  /** 重置钮的可访问名，形如“把字号重置为默认”。与 defaultValue 一起给。 */
  resetLabel?: string
  /**
   * “自动”档。给了就在数值前放一个 aria-pressed 按钮：
   * 自动态点亮，此时 value 是引擎算出来的值；用户拖滑杆或敲数字由调用方切成手动，
   * 手动态点这个按钮回到自动。
   */
  auto?: { active: boolean; label: string; hint?: string; onReset: () => void }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** 步进的小数位，用来把对齐结果的浮点尾巴切掉。 */
function decimalsOf(step: number): number {
  const text = String(step)
  if (text.includes('e') || text.includes('E')) return 10
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

/** 敲进来的值按步进网格对齐，再夹回区间：与拖滑杆得到的取值集合一致。 */
function snapToStep(value: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clamp(value, min, max)
  const snapped = min + Math.round((value - min) / step) * step
  const decimals = Math.min(10, decimalsOf(step) + 2)
  return clamp(Number(snapped.toFixed(decimals)), min, max)
}

function toDisplay(value: number, scale: number, precision: number): string {
  return (value * scale).toFixed(precision)
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 0.01,
  scale = 1,
  precision = 0,
  unit = '',
  editLabel,
  onChange,
  disabled = false,
  className,
  showInput = true,
  layout = 'stack',
  defaultValue,
  resetLabel,
  auto,
}: SliderFieldProps) {
  const labelId = useId()
  // draft 为 null 就是没在编辑。不另存一份同步态，省掉一个只为对齐外部值的 effect
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = draft !== null
  const row = layout === 'row'
  // display 是真实值，重置钮的判定与提交都读它；shown 是平滑过渡中的显示值
  const display = toDisplay(value, scale, precision)
  const shown = toDisplay(useAnimatedNumber(value, !editing), scale, precision)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = (): void => {
    const raw = draft ?? ''
    setDraft(null)
    const parsed = Number.parseFloat(raw.replace(/[^\d.+-]/g, ''))
    // 敲进来的不是数就当没改过：draft 已清空，框里立刻回到当前值
    if (!Number.isFinite(parsed)) return
    onChange(snapToStep(clamp(parsed / scale, min, max), min, max, step))
  }

  // 默认值一致就不占位，偏离了才出现；比较按显示口径，浮点尾巴不会让它常亮
  const resettable =
    defaultValue !== undefined &&
    resetLabel !== undefined &&
    toDisplay(defaultValue, scale, precision) !== display

  const autoNode = auto ? (
    <button
      type="button"
      data-slot="slider-auto"
      aria-pressed={auto.active}
      title={auto.hint}
      disabled={disabled}
      onClick={auto.onReset}
      // 高度与数值框同行等高，热区不压滑杆
      className={cn(
        'focus-visible:ring-ring/50 shrink-0 rounded-md border text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
        row ? 'h-11 px-1.5 lg:h-8' : 'h-11 min-w-11 px-2.5',
        auto.active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {auto.label}
    </button>
  ) : null

  const valueNode =
    editing || showInput ? (
      <Input
        ref={inputRef}
        data-slot="slider-number"
        className={cn(
          'shrink-0 text-right font-mono tabular-nums',
          row ? 'h-11 w-20 px-1.5 lg:h-8' : 'h-11 w-24',
        )}
        inputMode="decimal"
        value={draft ?? `${shown}${unit}`}
        aria-label={editLabel}
        disabled={disabled}
        onFocus={() => setDraft(display)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setDraft(null)
        }}
      />
    ) : (
      <button
        type="button"
        // 数值按钮本身就是触控目标，撑到 44 px；行高跟着一起给到 44，避免热区压到下面的滑杆
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 h-11 min-w-11 rounded-md px-2 font-mono text-sm tabular-nums transition-colors focus-visible:ring-3 focus-visible:outline-none"
        aria-label={editLabel}
        disabled={disabled}
        onClick={() => setDraft(display)}
      >
        {shown}
        {unit}
      </button>
    )

  const resetNode =
    defaultValue === undefined ? null : (
      // 占位宽度常留：重置钮出现与消失时这一行不跳
      <span className={cn('flex shrink-0 items-center justify-center', row ? 'w-6' : 'w-8')}>
        {resettable ? (
          <button
            type="button"
            data-slot="slider-reset"
            aria-label={resetLabel}
            title={resetLabel}
            disabled={disabled}
            onClick={() => onChange(defaultValue)}
            className={cn(
              'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex items-center justify-center rounded-md transition-opacity focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
              row ? 'size-6' : 'size-8',
              // 桌面上悬停整行或键盘落进这一行才显形；触控设备没有悬停，常显
              'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100',
              '[@media(hover:none)]:opacity-100',
            )}
          >
            <RotateCcwIcon className={row ? 'size-3.5' : 'size-4'} aria-hidden />
          </button>
        ) : null}
      </span>
    )

  const sliderNode = (
    <Slider
      // aria-labelledby 会被 Base UI 传到 thumb 里那个 input[type=range] 上，
      // 屏幕阅读器读到的就是左边那行标签，不用再造一个隐藏名字
      aria-labelledby={labelId}
      className={cn(
        'min-h-11',
        row
          ? 'py-4 lg:min-h-6 lg:py-2.5 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:after:-inset-3'
          : 'py-4 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:after:-inset-3',
      )}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={[value]}
      onValueChange={(next) => {
        const raw = Array.isArray(next) ? next[0] : next
        if (typeof raw === 'number') onChange(clamp(raw, min, max))
      }}
    />
  )

  if (row) {
    // 三段挤一行只在很宽的带子里成立：检查器列 360 px 时滑杆会被压到 50 px 上下，
    // Base UI 量到 0 宽还会直接把滑块藏起来。所以这里是紧凑的两行，滑杆独占一整行
    return (
      <div className={cn('group flex flex-col gap-0.5', disabled && 'opacity-60', className)}>
        <div className="flex min-h-11 items-center justify-between gap-2 lg:min-h-8">
          <span id={labelId} title={label} className="truncate text-xs font-medium">
            {label}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {autoNode}
            {valueNode}
            {resetNode}
          </span>
        </div>
        {sliderNode}
      </div>
    )
  }

  return (
    <div className={cn('group flex flex-col gap-1', className)}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span id={labelId} className="truncate text-sm font-medium">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {autoNode}
          {valueNode}
          {resetNode}
        </span>
      </div>
      {sliderNode}
    </div>
  )
}
