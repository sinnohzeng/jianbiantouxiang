/**
 * 背景的取舍口。
 *
 * 四种情况回落到原来的 CSS 光晕：炫技层关掉、`prefers-reduced-motion: reduce`、
 * 环境光滑杆拉到 0、这台设备起不来 WebGL2。极光那份是懒 chunk，
 * 拉取途中与拉取失败也都由光晕顶上，任何一刻页面都有底色，不会先白一下。
 */

import { Suspense, lazy, useMemo } from 'react'
import { AmbientBackground } from '@/app/AmbientBackground'
import { useAmbientLevel } from '@/app/ambient'
import { ErrorBoundary } from '@/app/error-boundary'
import { useShowcase } from '@/app/showcase/config'
import { getRenderCaps } from '@/engine/caps'

const AuroraBackdrop = lazy(() => import('@/app/showcase/AuroraBackdrop'))

export function ShowcaseBackground() {
  const showcase = useShowcase()
  const { level } = useAmbientLevel()
  const webgl2 = useMemo(() => getRenderCaps().webgl2, [])

  if (!showcase || level <= 0 || !webgl2) return <AmbientBackground />

  return (
    <ErrorBoundary fallback={<AmbientBackground />}>
      <Suspense fallback={<AmbientBackground />}>
        <AuroraBackdrop />
      </Suspense>
    </ErrorBoundary>
  )
}
