/**
 * 进场编排：容器负责节拍，子项负责位移。
 *
 * 节拍走 motion 的 `staggerChildren`，间隔 40 ms，子项条件渲染时不用自己算序号。
 * 炫技层关掉时退回同名的裸元素，DOM 结构与类名一模一样，布局不会因为开关而变。
 */

import { m } from 'motion/react'
import type { Variants } from 'motion/react'
import { createElement, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { useShowcase } from '@/app/showcase/config'

/** 相邻两项的间隔，单位秒。 */
export const STAGGER_STEP_S = 0.04

const rootVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER_STEP_S, delayChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: 'easeOut' } },
}

type Tag = 'div' | 'section'

/**
 * motion 把拖拽与动画这几个事件名换了签名，与 React 原生的同名属性冲突，
 * 这里直接摘掉：进场编排用不到它们。
 */
type PassThroughProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>

export interface StaggerProps extends PassThroughProps {
  /** 落到哪个标签上，默认 div。 */
  as?: Tag
  children: ReactNode
}

export function StaggerRoot({ as = 'div', children, ...rest }: StaggerProps) {
  const active = useShowcase()
  if (!active) return createElement(as, rest, children)
  const Node = as === 'section' ? m.section : m.div
  return (
    <Node {...rest} initial="hidden" animate="show" variants={rootVariants}>
      {children}
    </Node>
  )
}

export function StaggerItem({ as = 'div', children, ...rest }: StaggerProps) {
  const active = useShowcase()
  if (!active) return createElement(as, rest, children)
  const Node = as === 'section' ? m.section : m.div
  return (
    <Node {...rest} variants={itemVariants}>
      {children}
    </Node>
  )
}
