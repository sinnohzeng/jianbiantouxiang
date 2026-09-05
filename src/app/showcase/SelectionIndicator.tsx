/**
 * 选中态的共享元素。同一个 `layoutId` 在一组选项里只会存在一份，
 * 选中项一换，motion 就把它从旧位置滑到新位置，而不是两边各闪一下。
 *
 * 调用方要保证：一、外层是 `relative`；二、同一组用同一个 id，不同组的 id 不能撞。
 * 它带 `data-slot="selection-indicator"`，选项内容的选择器可以据此把它排除掉。
 */

import { m } from 'motion/react'
import { useShowcase } from '@/app/showcase/config'
import { cn } from '@/lib/utils'

export interface SelectionIndicatorProps {
  /** 一组选项共用的 id，通常是「用途 + useId」。 */
  id: string
  className?: string
}

export function SelectionIndicator({ id, className }: SelectionIndicatorProps) {
  const active = useShowcase()
  if (!active) return null
  return (
    <m.span
      aria-hidden="true"
      data-slot="selection-indicator"
      layoutId={id}
      transition={{ type: 'spring', stiffness: 460, damping: 38, mass: 0.7 }}
      className={cn('pointer-events-none absolute inset-0', className)}
    />
  )
}
