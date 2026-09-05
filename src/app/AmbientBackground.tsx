/**
 * 页面底色的环境光晕：取当前配色的两三个色，铺成超大半径的模糊径向渐变。
 * 纯装饰，aria-hidden，不接受指针事件；reduced-motion 下由 CSS 冻结不动。
 */

import { useMemo } from 'react'
import { resolveColors } from '@/engine/colors'
import { suppressBlobColor } from '@/app/ambient'
import { useTheme } from '@/app/theme'
import { DEFAULT_CONFIG } from '@/state/config'
import { useAvatarStore } from '@/state/store'

interface Blob {
  color: string
  /** 圆心与直径都用视口百分比，窗口怎么变都不会露出边。 */
  top: string
  left: string
  size: string
  delay: string
}

const SLOTS: readonly Omit<Blob, 'color'>[] = [
  { top: '-18%', left: '-12%', size: '68vmax', delay: '0s' },
  { top: '32%', left: '58%', size: '60vmax', delay: '-9s' },
  { top: '68%', left: '8%', size: '52vmax', delay: '-17s' },
]

export function AmbientBackground() {
  const palette = useAvatarStore((state) => state.config.palette)
  const customColors = useAvatarStore((state) => state.config.customColors)
  const { resolved } = useTheme()

  const blobs = useMemo<Blob[]>(() => {
    const colors = resolveColors({ ...DEFAULT_CONFIG, palette, customColors })
    return SLOTS.map((slot, index) => ({
      ...slot,
      color: suppressBlobColor(colors[index % colors.length] ?? colors[0] ?? '#c7d2fe', resolved),
    }))
  }, [palette, customColors, resolved])

  // 环境光恒定开满。深色底上同样的透明度会显脏，两档分开给
  const opacity = resolved === 'dark' ? 0.56 : 0.9

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((blob, index) => (
        <div
          key={index}
          className="ambient-blob absolute rounded-full"
          style={{
            top: blob.top,
            left: blob.left,
            width: blob.size,
            height: blob.size,
            opacity,
            animationDelay: blob.delay,
            background: `radial-gradient(circle at 50% 50%, ${blob.color} 0%, transparent 68%)`,
            filter: 'blur(90px)',
          }}
        />
      ))}
    </div>
  )
}
