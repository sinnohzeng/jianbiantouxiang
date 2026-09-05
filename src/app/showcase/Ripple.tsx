/**
 * 随机与导出成功时的一圈涟漪。
 *
 * 5.0 之前这里是 `@reactbits-starter/star-burst-tw` 的着色器粒子。它铺满自己那块方形画布，
 * 摆在一百多像素的按钮上，边界一览无余，点一下像一团方形色块炸开。
 * 换成纯 CSS 的一圈涟漪：按钮尺寸再小也不会露方形边界，也不必为一次反馈起 WebGL 上下文。
 *
 * `fire()` 除了荡这一圈，还发一次预览脉冲，让画框跟着弹一下。
 */

import { useCallback, useState } from 'react'
import { firePreviewPulse } from '@/app/showcase/pulse'
import { cn } from '@/lib/utils'

export interface RippleControl {
  /** 每触发一次自增，作为 Ripple 的 key 与开关。 */
  token: number
  fire: () => void
}

/** 拿到一个触发器。调用 `fire()` 会荡一圈涟漪并让预览框弹一下。 */
export function useRipple(): RippleControl {
  const [token, setToken] = useState(0)
  const fire = useCallback(() => {
    setToken((value) => value + 1)
    firePreviewPulse()
  }, [])
  return { token, fire }
}

export interface RippleProps {
  /** 每次自增触发一圈。0 表示还没触发过。 */
  token: number
  className?: string
}

/** 挂在 `relative` 的按钮里，圆角随按钮走；整层不吃指针事件。 */
export function Ripple({ token, className }: RippleProps) {
  if (token === 0) return null
  return (
    <span
      key={token}
      aria-hidden="true"
      className={cn(
        'showcase-ripple ring-primary/70 pointer-events-none absolute inset-0 rounded-[inherit] ring-2',
        className,
      )}
    />
  )
}
