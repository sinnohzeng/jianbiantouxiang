/**
 * 主操作条。手机上固定在屏幕底部并让出 safe-area，桌面上就在预览正下方那一列。
 *
 * 只占预览那一列，不横跨整个工作台：挑选栏底下压一条通栏的操作条，
 * 会让人以为它管的是左边那两列，而它管的其实是画面。
 * 每个按钮都带可见文案：只有图标时没人认得出哪个是哪个，touch target 再大也没用。
 * 手机上是图标在上、11 px 短文案在下；桌面是图标加文案的一行。
 * 桌面上文案露多少由操作条自己有多宽决定，容器查询写在 index.css，
 * 因为它只有预览那一列宽，微调一开合就换一个量级，视口断点在这里给不出答案。
 * 分量按频次给：随机颜色与导出是实心，其余是描边的安静态，微调点亮时换主色。
 * v5 起没有「文字」快捷键位：两行输入常驻在挑选栏第一节，一眼就看得见，再给它一个入口是重复。
 * v5 起没有「复制链接」：配置不进 URL，分享靠导出的图。
 * 导出按钮带同步锁与三态（idle / working / done）：working 至少 600 ms 可见，
 * 成功后 400 ms 确认态再解锁，连点窗口约一秒，失败立即解锁可重试。
 * 两个随机按钮点一下，按钮上荡一圈 CSS 涟漪，预览框同时弹一下，都归炫技层管。
 */

import { useCallback, useRef, useState } from 'react'
import {
  CheckIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  EllipsisIcon,
  Grid3x3Icon,
  Loader2Icon,
  RotateCcwIcon,
  ScanIcon,
  SettingsIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { createClipboardBlob, createExportArtifact } from '@/export/action'
import { copyImageToClipboard, supportsClipboardImage } from '@/export/clipboard'
import { downloadBlob } from '@/export/download'
import { isWeChat } from '@/export/share'
import { releaseCanvas } from '@/export/canvas'
import { queueHistoryThumbnail } from '@/app/history-thumb'
import { useInspectorOpen } from '@/app/inspector-open'
import { usePreviewOverlays } from '@/app/preview-overlays'
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
  'relative flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] leading-none font-medium transition-colors focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none lg:h-10 lg:min-h-0 lg:flex-auto lg:flex-row lg:gap-1.5 lg:px-2.5 lg:text-sm'
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
  const { guide, grid, setGuide, setGrid } = usePreviewOverlays()
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

  const onCopyImage = useCallback(async () => {
    if (!supportsClipboardImage()) {
      toast.error(t('export.copyUnsupported'))
      return
    }
    flushConfigSync()
    try {
      // Promise 必须在用户手势内交给 ClipboardItem，Safari 才允许稍后完成合成
      const copied = await copyImageToClipboard(createClipboardBlob(useAvatarStore.getState().config))
      if (!copied) {
        toast.error(t('export.copyFailed'))
        return
      }
      toast.success(t('export.copySuccess'))
      pushHistory()
      queueHistoryThumbnail()
    } catch {
      toast.error(t('export.copyFailed'))
    }
  }, [pushHistory, t])

  const onExportOptions = useCallback(() => {
    setUi({ exportOpen: true })
  }, [setUi])

  const exporting = exportPhase !== 'idle'
  const exportLabel =
    exportPhase === 'working'
      ? t('export.working')
      : exportPhase === 'done'
        ? t('export.done')
        : t('bottombar.export')

  return (
    <div
      role="group"
      data-slot="bottom-bar"
      aria-label={t('bottombar.actions')}
      className={cn(
        'bg-background/85 supports-[backdrop-filter]:bg-background/70 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md',
        // 桌面上它落在预览那一列的第二行，落位规则见 index.css 的工作台栅格
        'safe-bottom lg:bg-card/60 lg:static lg:rounded-2xl lg:border lg:pb-0 lg:backdrop-blur-sm',
      )}
    >
      <div className="flex items-stretch gap-1 px-2 py-1.5 lg:items-center lg:gap-2 lg:px-3 lg:py-2">
        <button
          type="button"
          data-slot="shuffle-color"
          onClick={onShuffle}
          aria-label={t('bottombar.random')}
          title={t('bottombar.random.hint')}
          className={cn(item, accent)}
        >
          <ShuffleIcon className={iconClass} aria-hidden />
          {/* 手机那格只有七十来像素宽，桌面上这条也只有预览那一列宽，两处各给一版，
              露哪一版看容器宽度。aria-label 常驻，收到只剩图标也还有可访问名 */}
          <span data-label="short" className={labelClass}>
            {t('bottombar.random.short')}
          </span>
          <span data-label="full" className={cn(labelClass, 'hidden')}>
            {t('bottombar.random')}
          </span>
          <Ripple token={colorRipple.token} />
        </button>

        <button
          type="button"
          data-slot="shuffle-all"
          onClick={onShuffleAll}
          aria-label={t('bottombar.randomAll')}
          title={t('bottombar.randomAll.hint')}
          className={cn(item, quiet)}
        >
          <SparklesIcon className={iconClass} aria-hidden />
          <span data-label="short" className={labelClass}>
            {t('bottombar.randomAll.short')}
          </span>
          <span data-label="full" className={cn(labelClass, 'hidden')}>
            {t('bottombar.randomAll')}
          </span>
          <Ripple token={allRipple.token} />
        </button>

        <button
          type="button"
          data-slot="inspector-toggle"
          aria-pressed={inspectorOpen}
          aria-label={t('panel.inspector.title')}
          onClick={toggleInspector}
          title={inspectorOpen ? t('panel.inspector.close') : t('panel.inspector.open')}
          className={cn(item, inspectorOpen ? lit : quiet)}
        >
          <SlidersHorizontalIcon className={iconClass} aria-hidden />
          <span data-label className={labelClass}>
            {t('panel.inspector.title')}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            data-slot="more-menu"
            aria-label={t('bottombar.more')}
            title={t('bottombar.more')}
            className={cn(item, quiet)}
          >
            <EllipsisIcon className={iconClass} aria-hidden />
            <span data-label className={labelClass}>
              {t('bottombar.more')}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-auto min-w-52">
            <DropdownMenuItem
              data-slot="copy-image-action"
              onClick={() => void onCopyImage()}
              className="min-h-11 px-2"
            >
              <ClipboardCopyIcon className="size-4" aria-hidden />
              {t('export.copyImage')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* 两个参考层从画框角上挪进来：它们压在作品上，正好挡住要看的那一块，
                而且只有图标、谁也认不出。在这里它们带着文案与勾选态 */}
            <DropdownMenuCheckboxItem
              data-slot="grid-toggle"
              checked={grid}
              onCheckedChange={setGrid}
              className="min-h-11 px-2 pr-8"
            >
              <Grid3x3Icon className="size-4" aria-hidden />
              {t('preview.grid')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              data-slot="guide-toggle"
              checked={guide}
              onCheckedChange={setGuide}
              className="min-h-11 px-2 pr-8"
            >
              <ScanIcon className="size-4" aria-hidden />
              {t('preview.safeArea')}
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />

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

        {/* 桌面上每格都是 flex-auto：这条只有预览那一列宽，固定宽度的按钮排不下会溢出到列外，
            而等分（flex-1）又会把四字标签挤到截断，哪怕整行还有富余。
            flex-auto 以内容宽为基准分配富余，宽的时候不截字，窄到极限才按比例收。
            导出这一格再多给一点权重：它是收文案时最后一个让位的 */}
        <div className="flex min-w-0 flex-[1.6] lg:flex-auto">
          <button
            type="button"
            data-slot="export-action"
            disabled={exporting}
            aria-label={exportLabel}
            onClick={() => void onExport()}
            className={cn(item, accent, 'rounded-r-none border-r-0')}
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
            <span data-label className={labelClass}>
              {exportLabel}
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
