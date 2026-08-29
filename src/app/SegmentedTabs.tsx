/**
 * 四段参数切换。形制借 `@reactbits-pro/navbar-8`：凹槽底 + 滑动药丸 + roving tabindex，
 * 但指示器不用动画库，四段等宽时位置就是 `index / count`，一个 transform 过渡就够。
 */

import type { KeyboardEvent, ReactNode } from 'react'
import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedItem<T extends string> {
  id: T
  label: string
  icon?: ReactNode
}

interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedItem<T>[]
  value: T
  onChange: (next: T) => void
  /** tablist 的可访问名。 */
  label: string
  /** 每个 tab 控制的面板 id 前缀，拼成 `${idPrefix}-${item.id}`。 */
  idPrefix: string
  className?: string
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  className,
}: SegmentedTabsProps<T>) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const count = Math.max(1, items.length)
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === value),
  )

  const focusTab = useCallback((next: number) => {
    const list = listRef.current
    if (!list) return
    const buttons = list.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons[next]?.focus()
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      let next: number
      if (event.key === 'ArrowRight') next = (index + 1) % count
      else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = count - 1
      else return
      event.preventDefault()
      const target = items[next]
      if (!target) return
      onChange(target.id)
      focusTab(next)
    },
    [count, focusTab, index, items, onChange],
  )

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn('bg-muted/70 relative grid w-full gap-0 rounded-xl p-1', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="bg-background pointer-events-none absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${count})`,
          transform: `translateX(calc(${index} * 100%))`,
        }}
      />
      {items.map((item, i) => {
        const active = i === index
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-${item.id}`}
            tabIndex={active ? 0 : -1}
            aria-label={item.label}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium',
              'focus-visible:ring-ring/60 transition-colors focus-visible:ring-3 focus-visible:outline-none',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.icon}
            {/* 380 px 以下四段挤不下文字，只留图标，可访问名由 aria-label 兜住 */}
            <span className="sr-only truncate min-[380px]:not-sr-only">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
