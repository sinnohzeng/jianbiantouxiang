/**
 * 主操作条。手机上固定在屏幕底部并让出 safe-area，桌面上是预览下方的一行。
 *
 * 每个按钮都带可见文案：只有图标时没人认得出哪个是哪个，touch target 再大也没用。
 * 手机上是图标在上、11 px 短文案在下的五格；桌面换成图标加全称的一行，横跨整个工作台底部。
 * 横跨全宽而不是只占预览那一列：六个带文案的按钮在 300 px 出头的列里必然溢出。
 * 分量按频次给：随机颜色与导出是实心，其余是描边的安静态，微调点亮时换主色。
 * v5 起没有「复制链接」：配置不进 URL，分享靠导出的图。
 * 导出按钮带同步锁与三态（idle / working / done）：working 至少 600 ms 可见，
 * 成功后 400 ms 确认态再解锁，连点窗口约一秒，失败立即解锁可重试。
 * 两个随机按钮点一下，按钮上荡一圈 CSS 涟漪，预览框同时弹一下，都归炫技层管。
 */

import { useCallback, useRef, useState } from 'react'
import {
  CheckIcon,
  DownloadIcon,
  EllipsisIcon,
  Loader2Icon,
  RotateCcwIcon,
  SettingsIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TypeIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { createExportArtifact } from '@/export/action'
import { downloadBlob } from '@/export/download'
import { isWeChat } from '@/export/share'
import { releaseCanvas } from '@/export/canvas'
import { queueHistoryThumbnail } from '@/app/history-thumb'
import { useInspectorOpen } from '@/app/inspector-open'
import { Ripple, useRipple } from '@/app/showcase/Ripple'
import { flushConfigSync, useAvatarStore } from '@/state/store'

/** loading 态最短展示时长：太快完成的导出也看得见状态，吸收补点。 */
const MIN_WORKING_MS = 600
/** 成功确认态时长：勾一下再解锁，连点两下只出一张。 */
const DONE_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 一格按钮：手机上图标压文案，桌面上并排。 */
const item =
  'relative flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] leading-none font-medium transition-colors focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none lg:h-10 lg:min-h-0 lg:flex-none lg:flex-row lg:gap-2 lg:px-3 lg:text-sm'
/** 次级动作：描边加卡片底，与背景拉开一层。 */
const quiet = 'border-border bg-card/80 text-foreground hover:bg-accent hover:text-accent-foreground'
/** 一级动作：实心。 */
const accent = 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
/** 点亮态：主色描边加淡底再套一圈环，与未点亮一眼分得开，又不跟两个实心按钮抢分量。 */
const lit =
  'border-primary ring-primary/60 bg-primary/12 text-primary ring-1 hover:bg-primary/20'
const iconClass = 'size-5 shrink-0 lg:size-4'
const labelClass = 'w-full truncate text-center'

export function BottomBar() {
  const t = useT()
  const randomize = useAvatarStore((state) => state.randomize)
  const randomizeAll = useAvatarStore((state) => state.randomizeAll)
  const pushHistory = useAvatarStore((state) => state.pushHistory)
  const reset = useAvatarStore((state) => state.reset)
  const setUi = useAvatarStore((state) => state.setUi)
  const { open: inspectorOpen, toggle: toggleInspector } = useInspectorOpen()
  const [resetOpen, setResetOpen] = useState(false)
  // 两个随机各有一次触发；fire 同时让预览框弹一下
  const colorRipple = useRipple()
  const allRipple = useRipple()

  const fireColor = colorRipple.fire
  const fireAll = allRipple.fire

  const onShuffle = useCallback(() => {
    randomize()
    pushHistory()
    queueHistoryThumbnail()
    fireColor()
  }, [randomize, pushHistory, fireColor])

  const onShuffleAll = useCallback(() => {
    randomizeAll()
    pushHistory()
    queueHistoryThumbnail()
    fireAll()
  }, [randomizeAll, pushHistory, fireAll])

  const onEditText = useCallback(() => {
    // v5 起没有页签，两行输入常驻在挑选栏第一节；手机上它在预览下方，顺手滚进视野
    const input = document.querySelector<HTMLInputElement>('[data-slot="text-line1"]')
    if (!input) return
    input.focus()
    input.scrollIntoView({ block: 'center' })
  }, [])

  const onReset = useCallback(() => {
    reset()
    setResetOpen(false)
    toast.success(t('about.resetDone'))
  }, [reset, t])

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
        // 桌面上它是工作台底部横跨全宽的一条，不再钉在屏幕底
        'safe-bottom lg:bg-card/60 lg:static lg:col-span-full lg:col-start-1 lg:row-start-2 lg:rounded-2xl lg:border lg:pb-0 lg:backdrop-blur-sm',
      )}
    >
      <div className="flex items-stretch gap-1 px-2 py-1.5 lg:items-center lg:gap-2 lg:px-3 lg:py-2">
        <button
          type="button"
          data-slot="shuffle-color"
          onClick={onShuffle}
          title={t('bottombar.random.hint')}
          className={cn(item, accent)}
        >
          <ShuffleIcon className={iconClass} aria-hidden />
          {/* 手机那格只有七十来像素宽，全称塞不下会截成一半，两处各给一版 */}
          <span className={cn(labelClass, 'lg:hidden')}>{t('bottombar.random.short')}</span>
          <span className={cn(labelClass, 'hidden lg:block')}>{t('bottombar.random')}</span>
          <Ripple token={colorRipple.token} />
        </button>

        <button
          type="button"
          data-slot="shuffle-all"
          onClick={onShuffleAll}
          title={t('bottombar.randomAll.hint')}
          className={cn(item, quiet)}
        >
          <SparklesIcon className={iconClass} aria-hidden />
          <span className={cn(labelClass, 'lg:hidden')}>{t('bottombar.randomAll.short')}</span>
          <span className={cn(labelClass, 'hidden lg:block')}>{t('bottombar.randomAll')}</span>
          <Ripple token={allRipple.token} />
        </button>

        {/* 文字入口只在桌面留：手机上两行输入就在预览正下方，再放一个快捷键位不划算 */}
        <button
          type="button"
          data-slot="edit-text"
          onClick={onEditText}
          title={t('bottombar.text.hint')}
          className={cn(item, quiet, 'hidden lg:inline-flex')}
        >
          <TypeIcon className={iconClass} aria-hidden />
          <span className={labelClass}>{t('bottombar.text')}</span>
        </button>

        <button
          type="button"
          data-slot="inspector-toggle"
          aria-pressed={inspectorOpen}
          onClick={toggleInspector}
          title={inspectorOpen ? t('panel.inspector.close') : t('panel.inspector.open')}
          className={cn(item, inspectorOpen ? lit : quiet)}
        >
          <SlidersHorizontalIcon className={iconClass} aria-hidden />
          <span className={labelClass}>{t('panel.inspector.title')}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            data-slot="more-menu"
            title={t('bottombar.more')}
            className={cn(item, quiet)}
          >
            <EllipsisIcon className={iconClass} aria-hidden />
            <span className={labelClass}>{t('bottombar.more')}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-auto min-w-48">
            <DropdownMenuItem
              data-slot="reset-action"
              onClick={() => setResetOpen(true)}
              className="min-h-11 px-2"
            >
              <RotateCcwIcon className="size-4" aria-hidden />
              {t('about.reset')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex min-w-0 flex-[1.6] lg:ml-auto lg:flex-none">
          <button
            type="button"
            data-slot="export-action"
            disabled={exporting}
            onClick={() => void onExport()}
            className={cn(item, accent, 'rounded-r-none border-r-0 lg:min-w-28')}
          >
            {exportPhase === 'working' ? (
              <Loader2Icon
                className={cn(iconClass, 'animate-spin motion-reduce:animate-none')}
                aria-hidden
              />
            ) : exportPhase === 'done' ? (
              <CheckIcon className={iconClass} aria-hidden />
            ) : (
              <DownloadIcon className={iconClass} aria-hidden />
            )}
            <span className={labelClass}>
              {exportPhase === 'working'
                ? t('export.working')
                : exportPhase === 'done'
                  ? t('export.done')
                  : t('bottombar.export')}
            </span>
          </button>
          <button
            type="button"
            data-slot="export-options"
            onClick={onExportOptions}
            aria-label={t('bottombar.exportOptions')}
            title={t('bottombar.exportOptions')}
            className={cn(
              item,
              accent,
              'border-background/60 grow-0 basis-10 rounded-l-none border-l px-0',
            )}
          >
            <SettingsIcon className="size-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('about.reset')}</DialogTitle>
            <DialogDescription>{t('reset.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              {t('reset.cancel')}
            </Button>
            <Button type="button" data-slot="reset-confirm" onClick={onReset}>
              <RotateCcwIcon aria-hidden />
              {t('about.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
