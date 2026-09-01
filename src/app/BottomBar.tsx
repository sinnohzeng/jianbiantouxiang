/**
 * 主操作条。手机上固定在屏幕底部并让出 safe-area，桌面上就是面板列底部的一行。
 * 触控目标一律 44 px 起，尺寸档参考 `@reactbits-pro/mobile-4`。
 *
 * v4.0 起四个高频动作常驻一级：随机颜色（种子）、随机质感与配色、文字快捷入口、
 * 复制链接，全部图标态加 tooltip；桌面端操作条住在 380 px 面板列里，
 * 带文案排不下，导出是唯一带文案的主行动。
 * 导出按钮带同步锁与三态（idle / working / done）：working 至少 600 ms 可见，
 * 成功后 400 ms 确认态再解锁，连点窗口约一秒，失败立即解锁可重试。
 */

import { useCallback, useRef, useState } from 'react'
import {
  CheckIcon,
  DownloadIcon,
  Link2Icon,
  Loader2Icon,
  SettingsIcon,
  ShuffleIcon,
  SparklesIcon,
  TypeIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/app/clipboard'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { createExportArtifact } from '@/export/action'
import { downloadBlob } from '@/export/download'
import { isWeChat } from '@/export/share'
import { releaseCanvas } from '@/export/canvas'
import { queueHistoryThumbnail } from '@/app/history-thumb'
import { flushConfigSync, useAvatarStore } from '@/state/store'
import { buildShareUrl } from '@/state/url'

/** loading 态最短展示时长：太快完成的导出也看得见状态，吸收补点。 */
const MIN_WORKING_MS = 600
/** 成功确认态时长：勾一下再解锁，连点两下只出一张。 */
const DONE_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function BottomBar() {
  const t = useT()
  const randomize = useAvatarStore((state) => state.randomize)
  const randomizeAll = useAvatarStore((state) => state.randomizeAll)
  const pushHistory = useAvatarStore((state) => state.pushHistory)
  const setUi = useAvatarStore((state) => state.setUi)

  const onShuffle = useCallback(() => {
    randomize()
    pushHistory()
    queueHistoryThumbnail()
  }, [randomize, pushHistory])

  const onShuffleAll = useCallback(() => {
    randomizeAll()
    pushHistory()
    queueHistoryThumbnail()
  }, [randomizeAll, pushHistory])

  const onEditText = useCallback(() => {
    setUi({ activePanel: 'text' })
    // 等页签渲染完再聚焦；手机上输入框在预览下方，顺手滚进视野
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('[data-slot="text-line1"]')
      if (!input) return
      input.focus()
      input.scrollIntoView({ block: 'center' })
    })
  }, [setUi])

  const onCopyLink = useCallback(() => {
    // 先把当前配置落进 URL，再复制，别让用户拿到上一版的链接
    flushConfigSync()
    const url = buildShareUrl(useAvatarStore.getState().config)
    void copyText(url).then((ok) => {
      if (ok) toast.success(t('common.copied'))
      else toast.error(t('common.copyFailed'))
    })
  }, [t])

  // 导出三态：working 期间禁用，done 是成功后的短暂确认态。
  // busyRef 是同步锁：exporting 是渲染闭包，同一帧里的两次点击会都读到 false，
  // 连点两下就下两张；ref 在事件回调里同步置位，第二下当场被挡。
  const [exportPhase, setExportPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const busyRef = useRef(false)

  const onExport = useCallback(async () => {
    if (busyRef.current) return
    // 微信会拦 a[download]，那里只能打开抽屉展示长按保存兜底，不算一次导出
    if (isWeChat()) {
      setUi({ exportOpen: true })
      return
    }

    busyRef.current = true
    setExportPhase('working')
    const startedAt = Date.now()
    flushConfigSync()
    let artifact: Awaited<ReturnType<typeof createExportArtifact>> | null = null
    try {
      artifact = await createExportArtifact(useAvatarStore.getState().config)
      downloadBlob(artifact.blob, artifact.filename)
      pushHistory()
      queueHistoryThumbnail()
      toast.success(t('export.downloaded'))
      // 行业惯例：太快完成的操作用最短 loading 时长兜住，状态看得见，
      // 也吸收「点没点上」的补点；随后 400ms 成功态再解锁，连点窗口约一秒
      await sleep(Math.max(0, MIN_WORKING_MS - (Date.now() - startedAt)))
      setExportPhase('done')
      await sleep(DONE_MS)
    } catch {
      // 失败不拖冷却，让用户立刻能重试
      toast.error(t('export.failed'))
    } finally {
      if (artifact) releaseCanvas(artifact.canvas)
      setExportPhase('idle')
      busyRef.current = false
    }
  }, [pushHistory, setUi, t])

  const onExportOptions = useCallback(() => {
    setUi({ exportOpen: true })
  }, [setUi])

  const exporting = exportPhase !== 'idle'

  return (
    <div
      role="group"
      data-slot="bottom-bar"
      aria-label={t('bottombar.actions')}
      className={cn(
        'bg-background/85 supports-[backdrop-filter]:bg-background/70 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md',
        'safe-bottom lg:static lg:rounded-b-2xl lg:border-t lg:bg-transparent lg:pb-0 lg:backdrop-blur-none',
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3 lg:h-auto lg:px-3 lg:py-3">
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          data-slot="shuffle-color"
          onClick={onShuffle}
          title={t('bottombar.random.hint')}
          aria-label={t('bottombar.random')}
          className="tap-target"
        >
          <ShuffleIcon aria-hidden />
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          data-slot="shuffle-all"
          onClick={onShuffleAll}
          title={t('bottombar.randomAll.hint')}
          aria-label={t('bottombar.randomAll')}
          className="tap-target"
        >
          <SparklesIcon aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          data-slot="edit-text"
          onClick={onEditText}
          aria-label={t('bottombar.text')}
          title={t('bottombar.text.hint')}
          className="tap-target"
        >
          <TypeIcon aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          data-slot="copy-link-action"
          onClick={onCopyLink}
          aria-label={t('bottombar.copyLink')}
          title={t('bottombar.copyLink')}
          className="tap-target"
        >
          <Link2Icon aria-hidden />
        </Button>

        <div className="ml-auto flex min-w-0 flex-1 lg:flex-none">
          <Button
            type="button"
            size="lg"
            data-slot="export-action"
            disabled={exporting}
            onClick={() => void onExport()}
            className="tap-target min-w-0 flex-1 rounded-r-none pr-2 lg:min-w-28 lg:flex-none"
          >
            {exportPhase === 'working' ? (
              <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />
            ) : exportPhase === 'done' ? (
              <CheckIcon aria-hidden />
            ) : (
              <DownloadIcon aria-hidden />
            )}
            <span className="truncate">
              {exportPhase === 'working'
                ? t('export.working')
                : exportPhase === 'done'
                  ? t('export.done')
                  : t('bottombar.export')}
            </span>
          </Button>
          <Button
            type="button"
            size="lg"
            data-slot="export-options"
            onClick={onExportOptions}
            aria-label={t('bottombar.exportOptions')}
            title={t('bottombar.exportOptions')}
            className="tap-target border-background/60 rounded-l-none border-l px-2"
          >
            <SettingsIcon aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
