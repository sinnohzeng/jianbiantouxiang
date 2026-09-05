/**
 * 页面底色的极光背景，来自 `@reactbits-starter/aurora-blur-tw`。
 *
 * 颜色取当前配色的前三色，第四层回到第一色收口；不透明度恒定开满，没有强度滑杆。
 * 浅色主题下先把颜色压一档再上屏，与 CSS 光晕同一口径，pastel 当背景才不晃眼。
 *
 * 两处省电：手机把渲染分辨率压到 0.5 DPR；标签页切走时 `frameloop` 置 never 停帧。
 * 这份组件只走懒 chunk，three 与 @react-three/fiber 不进 entry。
 */

import { useMemo } from 'react'
import AuroraBlur, { type AuroraLayer, type SkyLayer } from '@/components/showcase/aurora-blur'
import { suppressBlobColor } from '@/app/ambient'
import { usePageVisible } from '@/app/showcase/visibility'
import { useTheme } from '@/app/theme'
import { resolveColors } from '@/engine/colors'
import { useIsMobile } from '@/hooks/use-media'
import { formatHex, oklch } from '@/palettes/culori'
import { DEFAULT_CONFIG } from '@/state/config'
import { useAvatarStore } from '@/state/store'

/** 四层极光的漂移速度与强度。前三层跟着配色走，第四层是收口的暗层。 */
const LAYER_SHAPE: readonly { speed: number; intensity: number }[] = [
  { speed: 0.3, intensity: 0.55 },
  { speed: 0.13, intensity: 0.42 },
  { speed: 0.19, intensity: 0.3 },
  { speed: 0.07, intensity: 0.18 },
]

/** 天光两层压得很暗，只负责上下两端的一点底噪，不跟极光抢亮度。 */
const SKY_DIM = 0.32

/** 深色主题下极光颜色先压暗一档：要的是有色，不是有光，见下面那段取舍。 */
const DARK_DIM = 0.6

function dim(color: string, factor: number): string {
  const parsed = oklch(color)
  if (!parsed) return color
  return (
    formatHex({
      mode: 'oklch',
      l: Math.max(0.04, parsed.l * factor),
      c: parsed.c * factor,
      h: parsed.h ?? 0,
    }) ?? color
  )
}

export default function AuroraBackdrop() {
  const palette = useAvatarStore((state) => state.config.palette)
  const customColors = useAvatarStore((state) => state.config.customColors)
  const { resolved } = useTheme()
  const isMobile = useIsMobile()
  const visible = usePageVisible()

  const { layers, skyLayers } = useMemo(() => {
    const colors = resolveColors({ ...DEFAULT_CONFIG, palette, customColors })
    const pick = (index: number): string => colors[index % colors.length] ?? colors[0] ?? '#c7d2fe'
    const tuned = (index: number): string => {
      const base = suppressBlobColor(pick(index), resolved)
      return resolved === 'dark' ? dim(base, DARK_DIM) : base
    }

    const nextLayers: AuroraLayer[] = LAYER_SHAPE.map((shape, index) => ({
      ...shape,
      color: tuned(index === 3 ? 0 : index),
    }))
    const nextSky: SkyLayer[] = [
      { color: dim(tuned(2), SKY_DIM), blend: 0.55 },
      { color: dim(tuned(1), SKY_DIM), blend: 0.45 },
    ]
    return { layers: nextLayers, skyLayers: nextSky }
  }, [palette, customColors, resolved])

  /*
   * 深浅两套参数不是简单的强弱之分，方向正好相反。
   *
   * 浅色底上极光越亮越接近白，反而看不见，所以留住辉光、把不透明度给足。
   * 深色底上界面文字本身是浅色，一块亮到发白的背景会把「第 1 行水平补偿」这种次级标签直接糊掉，
   * 所以先把颜色压暗再上屏，不透明度反而给满：要的是把底色染上一层，而不是打一束光。
   */
  const dark = resolved === 'dark'
  const opacity = dark ? 1 : 0.88

  return (
    <div
      aria-hidden="true"
      data-slot="showcase-background"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <AuroraBlur
        layers={layers}
        skyLayers={skyLayers}
        opacity={opacity}
        speed={0.42}
        noiseScale={2.6}
        movementX={-1.1}
        movementY={-1.3}
        verticalFade={0.3}
        bloomIntensity={dark ? 1.5 : 1.35}
        brightness={dark ? 0.85 : 0.85}
        saturation={dark ? 1.25 : 0.9}
        dpr={isMobile ? 0.5 : [1, 2]}
        frameloop={visible ? 'always' : 'never'}
      />
    </div>
  )
}
