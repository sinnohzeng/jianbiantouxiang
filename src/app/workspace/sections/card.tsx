/**
 * 挑选栏里的一张卡片。标题常驻、不折叠：一眼看全是 v5 工作台的前提。
 */

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
  title: string
  /** 标题右侧的常驻动作，如图形开关。 */
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, action, children, className }: SectionCardProps) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn('bg-card/60 rounded-2xl border p-3 backdrop-blur-sm', className)}
    >
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2 px-1">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
