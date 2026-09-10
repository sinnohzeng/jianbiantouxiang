/**
 * 带数值输入的滑杆，范式取自 @shadcnblocks/slider-slider-standard-3：
 * 标签在左、当前值在右。数值框常驻，拖不准的值直接敲；给了 `defaultValue`
 * 的行在偏离默认值时多出一个重置小钮，桌面悬停或聚焦才显形，触控设备常显。
 *
 * 一行两段：第一段是「标签 | 自动档 | 数值框 | 重置占位」的固定列 grid，
 * 第二段滑杆独占一行。数值框与重置占位各占定宽列，位置与兄弟元素有无无关——
 * 早先第一行用 justify-between，字号行多一颗自动钮、又没有重置占位，
 * 它的数值框比其余行右移 28 px，同一组里竖着看是歪的。
 *
 * 致密尺寸一律 lg: 前缀：手机渲染同一棵树，基值要保持本仓 44 px 触控
 * 与 16 px 输入字号的口径，无前缀收小会让 iOS 聚焦缩放与触控热区一起破线。
 *
 * 数值变化时框里的数走一段弹簧过渡，只影响显示，真实值仍然一步到位。
 */

import { useEffect, useId, useRef, useState } from 'react'
import { RotateCcwIcon } from 'lucide-react'
import { clamp } from '@/engine/math'
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
  /** 这一项的默认值。给了才有重置钮。 */
  defaultValue?: number
  /** 重置钮的可访问名，形如“把字号重置为默认”。与 defaultValue 一起给。 */
  resetLabel?: string
  /**
   * “自动”档。给了就在标签右侧放一个 aria-pressed 按钮：
   * 自动态点亮，此时 value 是引擎算出来的值；用户拖滑杆或敲数字由调用方切成手动，
   * 手动态点这个按钮回到自动。它住在标签那一格里，不另占列，
   * 数值框的对齐因此与它有无无关。
   */
  auto?: { active: boolean; label: string; hint?: string; onReset: () => void }
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
  defaultValue,
  resetLabel,
  auto,
}: SliderFieldProps) {
  const labelId = useId()
  // draft 为 null 就是没在编辑。不另存一份同步态，省掉一个只为对齐外部值的 effect
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = draft !== null
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
      className={cn(
        'focus-visible:ring-ring/50 shrink-0 rounded-md border px-2.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
        'lg:h-5 lg:px-1 lg:text-[11px]',
        auto.active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {auto.label}
    </button>
  ) : null

  const valueNode = (
    <Input
      ref={inputRef}
      data-slot="slider-number"
      className={cn(
        'h-11 w-full shrink-0 px-2 text-right font-mono tabular-nums',
        // Input 基类带 lg:text-sm，tailwind-merge 视二者为同组变体，这里才压得住；
        // 基值留在 16 px 是 iOS 聚焦不缩放的口径
        'lg:h-5 lg:px-1 lg:text-[11px]',
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
  )

  const resetNode =
    defaultValue === undefined ? null : (
      // 占位宽度常留：重置钮出现与消失时这一行不跳
      <span className="flex w-full items-center justify-center">
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

  return (
    <div className={cn('group flex flex-col gap-0.5', disabled && 'opacity-60', className)}>
      <div
        className={cn(
          'grid min-h-11 grid-cols-[minmax(0,1fr)_6rem_2rem] items-center gap-2',
          'lg:min-h-5 lg:grid-cols-[minmax(0,1fr)_3.5rem_1.25rem] lg:gap-1.5',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span id={labelId} title={label} className="truncate text-sm font-medium lg:text-[11px]">
            {label}
          </span>
          {autoNode}
        </span>
        {valueNode}
        {resetNode}
      </div>
      <Slider
        // aria-labelledby 会被 Base UI 传到 thumb 里那个 input[type=range] 上，
        // 屏幕阅读器读到的就是左边那行标签，不用再造一个隐藏名字
        aria-labelledby={labelId}
        className={cn(
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
