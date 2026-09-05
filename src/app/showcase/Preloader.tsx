/**
 * 首屏加载动画，用 `@reactbits-starter/preloader-tw` 的 stairs 档：
 * 十条与页面同色的竖幕盖住视口，就绪后从中间往两边依次抽走，界面一条条露出来。
 *
 * 收场条件是「字体就绪且下一帧已经画出来」，最长 2500 ms 封顶，最短 700 ms 兜底，
 * 免得本地秒开时只看见一闪。会话内只播一次，记在 sessionStorage 里，
 * 刷新页面不再重播；炫技层关掉或用户要求减少动效时整块不挂。
 */

import { useEffect, useState } from 'react'
import Preloader from '@/components/showcase/preloader'
import { useShowcase } from '@/app/showcase/config'
import { useT } from '@/i18n'

const SESSION_KEY = 'gradient-avatar:showcase-intro'

/** 封顶时长：再慢也不让它挡在前面。 */
const MAX_MS = 2500
/** 兜底时长：秒开时也要看得清这是一次有意的进场，而不是闪屏。 */
const MIN_MS = 700

function playedThisSession(): boolean {
  try {
    // 读不到 sessionStorage 就当已经播过，宁可不播也不要每次导航都来一遍
    return globalThis.sessionStorage?.getItem(SESSION_KEY) === '1'
  } catch {
    return true
  }
}

function markPlayed(): void {
  try {
    globalThis.sessionStorage?.setItem(SESSION_KEY, '1')
  } catch {
    // 隐私模式下存不下，本次会话内可能多播一次，不影响功能
  }
}

/** 字体就绪，再等一帧，确保界面真的画出来了才收场。 */
function firstPaintReady(): Promise<void> {
  const fonts: Promise<unknown> =
    typeof document !== 'undefined' && 'fonts' in document
      ? document.fonts.ready
      : Promise.resolve()
  return fonts.then(
    () =>
      new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame !== 'function') {
          resolve()
          return
        }
        requestAnimationFrame(() => resolve())
      }),
  )
}

export function ShowcasePreloader() {
  const active = useShowcase()
  const t = useT()
  const [mounted, setMounted] = useState(() => active && !playedThisSession())
  const [loading, setLoading] = useState(mounted)

  useEffect(() => {
    if (!mounted) return
    markPlayed()

    const startedAt = Date.now()
    let settled = false
    let floor: ReturnType<typeof setTimeout> | null = null
    const finish = (): void => {
      if (settled) return
      settled = true
      setLoading(false)
    }

    const cap = setTimeout(finish, MAX_MS)
    void firstPaintReady().then(() => {
      if (settled) return
      floor = setTimeout(finish, Math.max(0, MIN_MS - (Date.now() - startedAt)))
    })

    return () => {
      clearTimeout(cap)
      if (floor !== null) clearTimeout(floor)
    }
  }, [mounted])

  if (!mounted) return null

  return (
    // 外面这层做两件事：给端到端一个稳定的选择器，以及在幕布开始抽走的那一刻停止吃指针事件。
    // 抽走要放完整段动画，期间界面已经露出来了，这时还挡着点击就成了假死
    <div
      data-slot="preloader"
      data-loading={loading ? 'true' : 'false'}
      className={loading ? undefined : 'pointer-events-none'}
    >
      <Preloader
        loading={loading}
        variant="stairs"
        stairCount={10}
        stairsRevealFrom="center"
        stairsRevealDirection="up"
        position="fixed"
        zIndex={9999}
        duration={MAX_MS}
        bgColor="var(--background)"
        loadingText={t('app.name')}
        textClassName="text-2xl text-foreground tracking-tight"
        ariaLabel={t('app.name')}
        onComplete={() => setMounted(false)}
      />
    </div>
  )
}
