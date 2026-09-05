/**
 * 数值的平滑计数。
 *
 * 只作用于「显示出来的那个数」，真实值一步到位：重置钮出不出现、敲进去提交什么，
 * 读的都还是真实值，动画不参与任何判定。编辑期间直接返回真实值，
 * 光标停在框里时数字自己在跳会打断输入。
 */

import { useEffect, useState } from 'react'
import { useMotionValueEvent, useSpring } from 'motion/react'
import { useShowcase } from '@/app/showcase/config'

/** 弹簧偏硬：这是数值反馈不是装饰，拖滑杆时要跟得上手。 */
const SPRING = { stiffness: 420, damping: 42, mass: 0.6, restDelta: 0.0002 } as const

export function useAnimatedNumber(value: number, enabled = true): number {
  const active = useShowcase() && enabled
  const spring = useSpring(value, SPRING)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    if (!active) return
    spring.set(value)
  }, [active, spring, value])

  useMotionValueEvent(spring, 'change', (next) => {
    setShown(next)
  })

  return active ? shown : value
}
