/**
 * 带数值显示的滑杆，范式取自 @shadcnblocks/slider-slider-standard-3：
 * 标签在左、当前值在右。这里多加一步，右侧数值本身是按钮，点开变成数字输入框，
 * 拖不准的值可以直接敲。
 */

import { useEffect, useId, useRef, useState } from 'react'
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
  /** 数值后缀，如 % 或 em。 */
  unit?: string
  /** 数值按钮的可访问名，形如“编辑字号”。 */
  editLabel: string
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  /** 常驻数值输入，适合需要精确修改的行级参数。 */
  showInput?: boolean
  /**
   * 「自动」档。给了就在数值前放一个 aria-pressed 按钮：
   * 自动态点亮，此时 value 是引擎算出来的值；用户拖滑杆或敲数字由调用方切成手动，
   * 手动态点这个按钮回到自动。
   */
  auto?: { active: boolean; label: string; hint?: string; onReset: () => void }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
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
  showInput = false,
  auto,
}: SliderFieldProps) {
  const labelId = useId()
  // draft 为 null 就是没在编辑。不另存一份同步态，省掉一个只为对齐外部值的 effect
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = draft !== null

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = (): void => {
    const raw = draft ?? ''
    setDraft(null)
    const parsed = Number.parseFloat(raw.replace(/[^\d.+-]/g, ''))
    if (!Number.isFinite(parsed)) return
    onChange(clamp(parsed / scale, min, max))
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span id={labelId} className="truncate text-sm font-medium">
          {label}
        </span>
        {auto ? (
          <button
            type="button"
            data-slot="slider-auto"
            aria-pressed={auto.active}
            title={auto.hint}
            disabled={disabled}
            onClick={auto.onReset}
            // 放在标签与数值中间、靠右对齐；高度 44 与数值按钮同行等高，热区不压滑杆
            className={cn(
              'focus-visible:ring-ring/50 ml-auto h-11 min-w-11 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
              auto.active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {auto.label}
          </button>
        ) : null}
        {draft !== null || showInput ? (
          <Input
            ref={inputRef}
            className="h-11 w-24 text-right"
            inputMode="decimal"
            value={draft ?? toDisplay(value, scale, precision)}
            aria-label={editLabel}
            onFocus={() => setDraft(toDisplay(value, scale, precision))}
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
            onClick={() => setDraft(toDisplay(value, scale, precision))}
          >
            {toDisplay(value, scale, precision)}
            {unit}
          </button>
        )}
      </div>
      <Slider
        // aria-labelledby 会被 Base UI 传到 thumb 里那个 input[type=range] 上，
        // 屏幕阅读器读到的就是左边那行标签，不用再造一个隐藏名字
        aria-labelledby={labelId}
        className="min-h-11 py-4 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:after:-inset-3"
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
