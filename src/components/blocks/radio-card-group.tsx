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
    <div role="radiogroup" aria-label={label} className={cn('grid grid-cols-4 gap-1.5', className)}>
      {options.map((option) => (
        <label key={option.value} className="relative cursor-pointer" title={option.description}>
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
              className="border-primary ring-primary/30 z-10 rounded-lg border ring-2"
            />
          ) : null}
          <span
            className={cn(
              'border-border bg-card flex min-h-11 flex-col gap-1 rounded-lg border p-1 transition-colors',
              'hover:border-foreground/30',
              !showcase &&
                'peer-checked:border-primary peer-checked:ring-primary/30 peer-checked:ring-2',
              'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-3',
              'motion-reduce:transition-none',
            )}
          >
            {option.preview}
            {/* 描述在触屏上没有 hover，卡内只留名字；选中项的描述由调用方常显一行。
                名字最多两行：四格并排时一格只有六十多像素，截断会把 Soft Mesh 切成 Soft M… */}
            <span className="line-clamp-2 text-center text-[11px] leading-tight font-medium">
              {option.title}
              {option.description ? <span className="sr-only">：{option.description}</span> : null}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}
