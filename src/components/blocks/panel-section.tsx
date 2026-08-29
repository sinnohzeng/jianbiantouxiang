/**
 * 面板里的可折叠分组。触发器是一个整行按钮，高度压在 44 px 以上；
 * 箭头旋转在 prefers-reduced-motion 下直接不过渡。
 */

import { useState, type ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface PanelSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function PanelSection({
  title,
  defaultOpen = true,
  children,
  className,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('border-border border-b last:border-b-0', className)}
    >
      <CollapsibleTrigger
        className={cn(
          'hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-between gap-2 px-1 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none',
          'motion-reduce:transition-none',
        )}
      >
        {title}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            'size-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 px-1 pt-1 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
