/**
 * 新版本的发现与应用。
 *
 * Service Worker 默认只在页面加载时查一次更新，标签页开着不关就一直停在旧版本。
 * 这里注册时把 registration 留下来，按 UPDATE_POLL_MS 定时问一次，
 * 回到前台与窗口重新聚焦时再各问一次：部署完不必等用户主动刷新。
 *
 * 发现新版本不闷声重载。当场重载会把正在敲的字打断，所以弹一条不自动消失的提示，
 * 点「刷新」才 skipWaiting 加重载；不点也不影响使用，下次进来自然是新版。
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import { useT } from '@/i18n'

/** 隔多久问一次有没有新版本。 */
export const UPDATE_POLL_MS = 15 * 60 * 1000

export function useServiceWorkerUpdate(): void {
  const t = useT()
  // 语言一变 t 就换一个函数，注册不该跟着重来一遍，所以把它放进 ref，注册那条 effect 依赖为空
  const translate = useRef(t)
  useEffect(() => {
    translate.current = t
  }, [t])

  useEffect(() => {
    // 开发模式没有 SW，注册了只会在控制台留一堆噪音
    if (import.meta.env.DEV) return

    let timer: ReturnType<typeof setInterval> | null = null
    let recheck: (() => void) | null = null

    const updateSW = registerSW({
      onNeedRefresh() {
        toast(translate.current('update.title'), {
          description: translate.current('update.body'),
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: translate.current('update.action'),
            onClick: () => void updateSW(true),
          },
        })
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return
        const check = (): void => {
          void registration.update().catch(() => {
            // 断网或服务端抽风，下一轮再说
          })
        }
        timer = setInterval(check, UPDATE_POLL_MS)
        recheck = (): void => {
          if (!document.hidden) check()
        }
        document.addEventListener('visibilitychange', recheck)
        window.addEventListener('focus', recheck)
      },
    })

    return () => {
      if (timer !== null) clearInterval(timer)
      if (recheck) {
        document.removeEventListener('visibilitychange', recheck)
        window.removeEventListener('focus', recheck)
      }
    }
  }, [])
}
