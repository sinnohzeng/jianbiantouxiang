/**
 * 炫技层的统一开关。
 *
 * 两道闸：`prefers-reduced-motion: reduce` 是用户的声明，动效一律不播；
 * `VITE_SHOWCASE=0` 是排查用的一键关闭，生产恒开，不做界面入口。
 * 两道闸都过了才算「炫技层在跑」，背景着色器、进场编排、选中态流动、粒子与加载动画
 * 全都读这一个判据，不各自再写一遍条件。
 */

import { usePrefersReducedMotion } from '@/hooks/use-media'

/** 构建期开关。写成函数而不是常量，测试里 `vi.stubEnv` 才改得动。 */
export function showcaseEnabled(): boolean {
  return import.meta.env.VITE_SHOWCASE !== '0'
}

/** 炫技层此刻是否该跑。组件里一律用它，不要自己拼条件。 */
export function useShowcase(): boolean {
  const reduced = usePrefersReducedMotion()
  return showcaseEnabled() && !reduced
}
