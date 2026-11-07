/**
 * 同一份数值状态提供两种响应式编辑：桌面用滑块与输入，
 * mobileStepper 开启时手机用 44px 减/数值/加，适合字号与位置精调。
 * 两种输入共享步进网格、自动档与重置；普通连续参数仍保留滑块。
 * 手机输入字号维持 16px，标签允许换行，防止缩小触区或截断多语言。
 * 精调输入显示实际值，不用弹簧动画插值，以免与已提交的数值不一致。
 */

import { useEffect, useId, useRef, useState } from 'react'
import { MinusIcon, PlusIcon, RotateCcwIcon } from 'lucide-react'
import { clamp } from '@/engine/math'
import { AutoToggle } from '@/components/blocks/auto-toggle'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export interface SliderFieldProps {
  label: string
  mobileStepper?: boolean
  increaseLabel?: string
  decreaseLabel?: string
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
  /** 这一项的默认值。给了才有重置钮。 */
  defaultValue?: number
  /** 重置钮的可访问名，形如“把字号重置为默认”。与 defaultValue 一起给。 */
  resetLabel?: string
  /**
   * “自动”档。给了就在标签右侧放一颗 AutoToggle：
   * 自动态点亮，此时 value 是引擎算出来的值；用户拖滑杆或敲数字由调用方切成手动，
   * 手动态点这个按钮回到自动。它住在标签那一格里，不另占列，
   * 数值框的对齐因此与它有无无关。`ariaLabel` 是带行名全称的可访问名。
   */
  auto?: {
    active: boolean
    label: string
    ariaLabel?: string
    hint?: string
    onReset: () => void
  }
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
  mobileStepper = false,
  increaseLabel,
  decreaseLabel,
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
  defaultValue,
  resetLabel,
  auto,
}: SliderFieldProps) {
  const labelId = useId()
  // draft 为 null 就是没在编辑。不另存一份同步态，省掉一个只为对齐外部值的 effect
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = draft !== null
  // 输入框、重置与提交统一显示真实值，避免精调反馈落后。
  const display = toDisplay(value, scale, precision)

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
    <AutoToggle
      slot="slider-auto"
      active={auto.active}
      label={auto.label}
      ariaLabel={auto.ariaLabel}
      hint={auto.hint}
      disabled={disabled}
      onClick={auto.onReset}
    />
  ) : null

  const valueNode = (
    <Input
      ref={inputRef}
      data-slot="slider-number"
      className={cn(
        'h-11 w-full shrink-0 px-1.5 text-right font-mono tabular-nums',
        // Input 基类带 lg:text-sm，tailwind-merge 视二者为同组变体，这里才压得住；
        // 基值留在 16 px 是 iOS 聚焦不缩放的口径
        'lg:h-5 lg:px-1 lg:text-[11px]',
        mobileStepper && 'w-0 min-w-0 flex-1 px-1 lg:w-full',
      )}
      inputMode="decimal"
      value={draft ?? `${display}${unit}`}
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
  )

  // 占位列常留，没给默认值的行也留：它排在数值框左边，缺了这一格数值框会滑进窄列
  const resetNode = (
    <span data-slot="slider-reset-slot" className="flex w-full items-center justify-center">
      {defaultValue !== undefined && resettable ? (
        <button
          type="button"
          data-slot="slider-reset"
          aria-label={resetLabel}
          title={resetLabel}
          disabled={disabled}
          onClick={() => onChange(defaultValue)}
          className={cn(
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex items-center justify-center rounded-md transition-opacity focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
            // 可见尺寸收小，热区靠 after 撑：基值 32+16=48，桌面 20+16=36 已过 WCAG 2.5.8 的 24
            'size-8 after:-inset-2 lg:size-5',
            // 桌面上悬停整行或键盘落进这一行才显形；触控设备没有悬停，常显
            'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100',
            '[@media(hover:none),(pointer:coarse)]:opacity-100',
          )}
        >
          <RotateCcwIcon className="size-4 lg:size-3.5" aria-hidden />
        </button>
      ) : null}
    </span>
  )

  const stepButton = (direction: -1 | 1) => (
    <button
      type="button"
      data-slot={direction < 0 ? 'number-decrease' : 'number-increase'}
      className="flex size-11 shrink-0 items-center justify-center rounded-md border disabled:opacity-30 lg:hidden"
      aria-label={direction < 0 ? (decreaseLabel ?? `${label} −`) : (increaseLabel ?? `${label} +`)}
      disabled={disabled || (direction < 0 ? value <= min : value >= max)}
      onClick={() => {
        setDraft(null)
        onChange(snapToStep(value + direction * step, min, max, step))
      }}
    >
      {direction < 0 ? (
        <MinusIcon className="size-4" aria-hidden />
      ) : (
        <PlusIcon className="size-4" aria-hidden />
      )}
    </button>
  )

  return (
    <div
      data-slot={mobileStepper ? 'precision-field' : 'range-field'}
      className={cn('group flex flex-col gap-0.5', disabled && 'opacity-60', className)}
    >
      <div
        className={cn(
          'grid min-h-11 items-center gap-2',
          mobileStepper
            ? 'grid-cols-[minmax(0,1fr)_2rem_11rem]'
            : 'grid-cols-[minmax(0,1fr)_2rem_5rem]',
          'lg:min-h-5 lg:grid-cols-[minmax(0,1fr)_1.25rem_4rem] lg:gap-1.5',
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            id={labelId}
            title={label}
            className="text-sm font-medium lg:truncate lg:text-[11px]"
          >
            {label}
          </span>
          {autoNode}
        </span>
        {resetNode}
        {mobileStepper ? (
          <div className="flex items-center gap-1 lg:contents">
            {stepButton(-1)}
            {valueNode}
            {stepButton(1)}
          </div>
        ) : (
          valueNode
        )}
      </div>
      <Slider
        // aria-labelledby 会被 Base UI 传到 thumb 里那个 input[type=range] 上，
        // 屏幕阅读器读到的就是左边那行标签，不用再造一个隐藏名字
        aria-labelledby={labelId}
        className={cn(
          mobileStepper && 'hidden lg:flex',
          'min-h-11 py-4 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:after:-inset-3',
          // 桌面整行 16 px：thumb 12 加 after 撑到 28 的命中区，过 WCAG 2.5.8
          'lg:h-4 lg:min-h-4 lg:py-0 lg:[&_[data-slot=slider-thumb]]:size-3 lg:[&_[data-slot=slider-thumb]]:after:-inset-2',
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
    </div>
  )
}
