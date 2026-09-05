/**
 * 环境光：页面底色的光晕。
 *
 * v5 起没有强度滑杆，也不落盘：它恒定开到最满。
 * 让每个人自己去调一条只影响观感、不影响出图的滑杆，是把选择成本转嫁给用户；
 * 而这条滑杆的最优解对所有人都一样，就是拉满。GPU 那点开销由炫技层的
 * 减少动效与 WebGL 能力两道闸兜住，不需要第三道。
 *
 * 这里只剩浅色主题的压色函数：光晕颜色跟着当前配色走，pastel 直接上屏会晃眼。
 */

import type { ResolvedTheme } from '@/app/theme'
import { formatHex, oklch } from '@/palettes/culori'

/**
 * 浅色主题把光晕颜色压一档：饱和乘 0.55、明度往下压一点，pastel 当背景才不晃眼。
 * 深色主题原色返回：不透明度本来就低，再压会发灰。
 */
export function suppressBlobColor(color: string, resolved: ResolvedTheme): string {
  if (resolved !== 'light') return color
  const parsed = oklch(color)
  if (!parsed) return color
  return (
    formatHex({
      mode: 'oklch',
      l: Math.max(0.5, Math.min(0.88, parsed.l - 0.06)),
      c: parsed.c * 0.55,
      h: parsed.h ?? 0,
    }) ?? color
  )
}
