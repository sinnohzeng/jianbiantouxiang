/**
 * motion 的特性提供者。
 *
 * 全仓只用 `m` 这套精简组件，特性从 `LazyMotion` 一处注入；选中态用了 `layoutId`，
 * 而布局动画不在 `domAnimation` 里，所以这里给的是 `domMax`。
 * 炫技层关掉时连提供者一起不挂：那种情况下没有任何 `m` 组件会被渲染。
 */

import { LazyMotion, domMax } from 'motion/react'
import type { ReactNode } from 'react'
import { useShowcase } from '@/app/showcase/config'

export function ShowcaseMotionProvider({ children }: { children: ReactNode }) {
  const active = useShowcase()
  if (!active) return <>{children}</>
  return <LazyMotion features={domMax}>{children}</LazyMotion>
}
