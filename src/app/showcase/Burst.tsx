/**
 * 随机与导出成功时的一次性粒子，用 `@reactbits-starter/star-burst-tw`。
 *
 * 它是着色器组件，每次挂载起一次 WebGL 上下文、卸载即释放，所以只在触发后的
 * BURST_MS 窗口里存在，平时树里一个都没有。整层 `pointer-events-none`，
 * 盖在按钮上方也不吃点击；颜色取当前配色的第一色，跟着画面走。
 */

import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useShowcase } from '@/app/showcase/config'
import { firePreviewPulse } from '@/app/showcase/pulse'
import { resolveColors } from '@/engine/colors'
import { cn } from '@/lib/utils'
import { DEFAULT_CONFIG } from '@/state/config'
import { useAvatarStore } from '@/state/store'

const StarBurst = lazy(() => import('@/components/showcase/star-burst'))

/** 一次粒子的存活时长，与 index.css 的 showcase-burst 动画对齐。 */
const BURST_MS = 900

export interface BurstControl {
  /** 每触发一次自增，作为 BurstFlash 的 key 与开关。 */
  token: number
  fire: () => void
}

/** 拿到一个触发器。调用 `fire()` 同时会让预览框弹一下。 */
export function useBurst(): BurstControl {
  const [token, setToken] = useState(0)
  const fire = useCallback(() => {
    setToken((value) => value + 1)
    firePreviewPulse()
  }, [])
  return { token, fire }
}

export interface BurstFlashProps {
  token: number
  /** 覆盖默认的尺寸与定位，默认是以父元素中心为圆心的一块方形。 */
  className?: string
}

export function BurstFlash({ token, className }: BurstFlashProps) {
  const active = useShowcase()
  const palette = useAvatarStore((state) => state.config.palette)
  const customColors = useAvatarStore((state) => state.config.customColors)
  // 已经烧完的那一次。存「烧完的」而不是「正在烧的」，渲染期就能直接算出该不该挂，
  // 不用在 effect 里同步 setState
  const [spent, setSpent] = useState(0)
  const live = token !== 0 && token !== spent ? token : 0

  // 首次触发不能等在网络上：粒子只活 900 ms，chunk 现拉就赶不上这一次
  useEffect(() => {
    if (!active) return
    void import('@/components/showcase/star-burst')
  }, [active])

  useEffect(() => {
    if (!active || live === 0) return
    const timer = setTimeout(() => setSpent(live), BURST_MS)
    return () => clearTimeout(timer)
  }, [active, live])

  if (!active || live === 0) return null

  const colors = resolveColors({ ...DEFAULT_CONFIG, palette, customColors })

  return (
    <span
      aria-hidden="true"
      className={cn(
        'showcase-burst pointer-events-none absolute top-1/2 left-1/2 z-30 block size-40 -translate-x-1/2 -translate-y-1/2',
        className,
      )}
    >
      <Suspense fallback={null}>
        {/* 参数是按「按钮大小的一小块」调的：原版默认是整屏背景，那套值放到 160 px 里
            每颗星只有零点几像素，画出来几乎是全透明。星少一点、大一点、亮一点才看得见。
            centerY 传 1 把发散原点摆回方框正中，默认的 0.5 会把它压到底边 */}
        <StarBurst
          key={live}
          color={colors[0] ?? '#e3b3ea'}
          centerY={1}
          speed={1.8}
          density={0.55}
          starCount={90}
          starSize={0.42}
          brightness={1.5}
          flowerIntensity={0.35}
          twinkleSpeed={0.8}
          wobbleAmount={0.85}
          fadeHeight={2.2}
        />
      </Suspense>
    </span>
  )
}
