/**
 * 面板里的可折叠分组。触发器是一个整行按钮，高度压在 44 px 以上；
 * 箭头旋转在 prefers-reduced-motion 下直接不过渡。
 *
 * 余下的 div 属性透传到 Collapsible 根，`data-slot` 也在内：全站折叠组已有六处，
 * 测试与端到端要指名道姓地找其中一处，靠下标数 trigger 一加组就崩。
 */

import { useState, type ComponentProps, type ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface PanelSectionProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function PanelSection({
  title,
  defaultOpen = true,
  children,
  className,
  ...rest
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible
      {...rest}
      open={open}
      onOpenChange={setOpen}
      className={cn('border-border border-b last:border-b-0', className)}
    >
      <CollapsibleTrigger
        className={cn(
          'hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-between gap-2 px-1 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none',
          'lg:min-h-9 lg:text-xs',
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
      <CollapsibleContent className="flex flex-col gap-2 px-1 pt-1 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
