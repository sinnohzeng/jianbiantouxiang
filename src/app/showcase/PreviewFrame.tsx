/**
 * 预览画框的进场：从 0.96 加 8 px 模糊化到清晰，500 ms 一次，只在挂载时播。
 * 炫技层关掉时原样返回一个裸 div，属性与类名都不变，量画框尺寸的 ResizeObserver
 * 读的是 contentRect，与这里的 transform 无关，进场不会引起画布反复重建。
 */

import { m } from 'motion/react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { useShowcase } from '@/app/showcase/config'

export interface PreviewFrameProps {
  ref: Ref<HTMLDivElement>
  role: string
  'aria-label': string
  className: string
  style: CSSProperties
  children: ReactNode
}

export function PreviewFrame({ ref, children, ...rest }: PreviewFrameProps) {
  const active = useShowcase()
  if (!active) {
    return (
      <div ref={ref} {...rest}>
        {children}
      </div>
    )
  }
  return (
    <m.div
      ref={ref}
      {...rest}
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  )
}
