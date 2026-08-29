/**
 * 分段控件，范式取自 @reactbits-pro/settings-form-3：
 * role="radiogroup" 包一组 label，真实 input[type=radio] 用 sr-only 藏起来，
 * 选中态靠 peer-checked 切类。比自造按钮组多拿到原生键盘与表单语义。
 */

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** 给了图标就只显示图标，label 退到可访问名。 */
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  /** 控件语义名。同一组件渲染两份时会各自加实例前缀，两边不会抢同一个 radio 组。 */
  name: string
  /** radiogroup 的可访问名。 */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const uid = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn('bg-muted flex w-full gap-1 rounded-lg p-1', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed has-disabled:opacity-50"
        >
          <input
            type="radio"
            className="peer sr-only"
            name={`${name}-${uid}`}
            data-group={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            aria-label={option.icon ? option.label : undefined}
            onChange={(event) => {
              if (event.target.checked) onChange(option.value)
            }}
          />
          <span
            className={cn(
              'text-muted-foreground flex h-full w-full items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors',
              'peer-hover:text-foreground peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-xs',
              'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-3',
              'motion-reduce:transition-none',
            )}
          >
            {option.icon ?? option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
