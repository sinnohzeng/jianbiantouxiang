/**
 * 挑选栏里的一张卡片。标题常驻、不折叠：一眼看全是 v5 工作台的前提。
 * 卡片本身就是进场编排的一项，节拍由外面的 StaggerRoot 给。
 */

import { useId, type ReactNode } from 'react'
import { StaggerItem } from '@/app/showcase/stagger'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
  title: string
  /** 标题右侧的常驻弱信息或动作，如当前选中的配色名。 */
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, action, children, className }: SectionCardProps) {
  const titleId = useId()
  return (
    <StaggerItem
      as="section"
      aria-labelledby={titleId}
      className={cn('bg-card/60 rounded-2xl border p-2.5 backdrop-blur-sm', className)}
    >
      <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2 px-1">
        <h2 id={titleId} className="text-xs font-semibold">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </StaggerItem>
  )
}
