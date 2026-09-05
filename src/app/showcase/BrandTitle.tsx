/**
 * 顶栏应用名的逐字入场，用 `@reactbits-starter/staggered-text-tw`。
 *
 * 组件会给根元素加上 `flex flex-wrap`，而顶栏只有 56 px 高，换行会被裁掉半行，
 * 所以这里强制不换行并裁剪溢出，长语言（ja 的 11 字）在窄屏上截断而不是折行。
 * 炫技层关掉时退回原来那个带 truncate 的裸 h1。
 */

import StaggeredText from '@/components/showcase/staggered-text'
import { useShowcase } from '@/app/showcase/config'
import { cn } from '@/lib/utils'

export interface BrandTitleProps {
  text: string
  className?: string
}

export function BrandTitle({ text, className }: BrandTitleProps) {
  const active = useShowcase()
  if (!active) return <h1 className={cn('truncate', className)}>{text}</h1>
  return (
    <StaggeredText
      as="h1"
      text={text}
      segmentBy="chars"
      delay={26}
      duration={0.5}
      blur
      className={cn('min-w-0 flex-nowrap! overflow-hidden', className)}
    />
  )
}
