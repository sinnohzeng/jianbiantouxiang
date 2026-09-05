/**
 * radio card 组，与 SegmentedControl 同一范式（@reactbits-pro/settings-form-3），
 * 区别只在每张卡多一块示意图与一句说明，用于质感这种需要看图才能选的项。
 * 选中描边同样交给带 layoutId 的共享元素，换卡时滑过去而不是两边各闪一下。
 */

import { useId, type ReactNode } from 'react'
import { useShowcase } from '@/app/showcase/config'
import { SelectionIndicator } from '@/app/showcase/SelectionIndicator'
import { cn } from '@/lib/utils'

export interface RadioCardOption<T extends string> {
  value: T
  title: string
  description?: string
  /** 卡片顶部的示意，通常是一块 CSS 渐变。 */
  preview?: ReactNode
}

export interface RadioCardGroupProps<T extends string> {
  name: string
  label: string
  value: T
  options: readonly RadioCardOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export function RadioCardGroup<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  className,
}: RadioCardGroupProps<T>) {
  const uid = useId()
  const showcase = useShowcase()
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid grid-cols-2 gap-2', className)}>
      {options.map((option) => (
        <label key={option.value} className="relative cursor-pointer">
          <input
            type="radio"
            className="peer sr-only"
            name={`${name}-${uid}`}
            data-group={name}
            value={option.value}
            checked={value === option.value}
            onChange={(event) => {
              if (event.target.checked) onChange(option.value)
            }}
          />
          {value === option.value ? (
            <SelectionIndicator
              id={`radio-card-${name}-${uid}`}
              className="border-primary ring-primary/30 z-10 rounded-xl border ring-2"
            />
          ) : null}
          <span
            className={cn(
              'border-border bg-card flex min-h-11 flex-col gap-2 rounded-xl border p-2 transition-colors',
              'hover:border-foreground/30',
              !showcase && 'peer-checked:border-primary peer-checked:ring-primary/30 peer-checked:ring-2',
              'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-3',
              'motion-reduce:transition-none',
            )}
          >
            {option.preview}
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{option.title}</span>
              {option.description ? (
                <span className="text-muted-foreground text-xs leading-snug">
                  {option.description}
                </span>
              ) : null}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}
