/**
 * 预览框的两个装饰：桌面指针带来的 3D 倾斜与跟随高光，以及随机、导出成功时的一次弹动。
 *
 * 都写成 CSS 自定义属性，由一条 `transform` 组合，不用 motion 也不占 React 渲染：
 * 拖滑杆时预览本来就每帧重排，再给它加一条受控动画只会互相打架。
 * 倾斜上限 4°，只在真有指针的桌面上生效；触屏没有悬停，长按保存的那张图也不该被转走。
 */

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useShowcase } from '@/app/showcase/config'
import { subscribePreviewPulse } from '@/app/showcase/pulse'
import { useMediaQuery } from '@/hooks/use-media'

/** 倾斜上限，spec 的硬上限就是 4°。 */
const MAX_TILT_DEG = 4

/** 弹一下的幅度与时长。 */
const PULSE_SCALE = 1.02
const PULSE_MS = 220

export interface PreviewFx {
  /** 挂在预览框外层容器上，倾斜与弹动都作用在它身上。 */
  hostRef: React.RefObject<HTMLDivElement | null>
  /** 炫技层在跑时给外层容器加的类名，关掉时是空串。 */
  className: string
  /** 桌面指针可用时才为真，决定要不要画那层跟随高光。 */
  tilt: boolean
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerLeave: () => void
}

export function usePreviewFx(): PreviewFx {
  const active = useShowcase()
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
  const tilt = active && finePointer
  const hostRef = useRef<HTMLDivElement | null>(null)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) return
    const stop = subscribePreviewPulse(() => {
      const host = hostRef.current
      if (!host) return
      host.style.setProperty('--showcase-pulse', String(PULSE_SCALE))
      if (pulseTimer.current !== null) clearTimeout(pulseTimer.current)
      pulseTimer.current = setTimeout(() => {
        pulseTimer.current = null
        host.style.setProperty('--showcase-pulse', '1')
      }, PULSE_MS)
    })
    return () => {
      stop()
      if (pulseTimer.current !== null) clearTimeout(pulseTimer.current)
      pulseTimer.current = null
    }
  }, [active])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const host = hostRef.current
      if (!tilt || !host) return
      const rect = host.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      host.style.setProperty('--showcase-tilt-x', `${((0.5 - y) * 2 * MAX_TILT_DEG).toFixed(2)}deg`)
      host.style.setProperty('--showcase-tilt-y', `${((x - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`)
      host.style.setProperty('--showcase-px', `${(x * 100).toFixed(1)}%`)
      host.style.setProperty('--showcase-py', `${(y * 100).toFixed(1)}%`)
      host.style.setProperty('--showcase-glow', '1')
    },
    [tilt],
  )

  const onPointerLeave = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    host.style.setProperty('--showcase-tilt-x', '0deg')
    host.style.setProperty('--showcase-tilt-y', '0deg')
    host.style.setProperty('--showcase-glow', '0')
  }, [])

  return {
    hostRef,
    className: active ? 'showcase-preview' : '',
    tilt,
    onPointerMove,
    onPointerLeave,
  }
}
