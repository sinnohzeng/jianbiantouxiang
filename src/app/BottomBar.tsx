/**
 * 主操作条。手机上固定在屏幕底部并让出 safe-area，桌面上就在预览正下方那一列，
 * 一行三格：换一版、随机配色、导出。
 *
 * 只占预览那一列，不横跨整个工作台：挑选栏底下压一条通栏的操作条，
 * 会让人以为它管的是左边那两列，而它管的其实是画面。
 * 每个按钮都带可见文案：只有图标时没人认得出哪个是哪个，touch target 再大也没用。
 * 手机上是图标在上、11 px 文案在下的三格加一颗导出选项齿轮；桌面是图标加文案的一行三列。
 * 三格全是短文案，一格放得下，不再备长短两版由容器查询挑。
 * 分量按频次给：换一版与导出是实心，随机配色是描边的安静态。
 * 两档随机的边界：换一版只换种子（同配色同质感换一版构图），随机配色只换配色（种子与质感不动）。
 * v7 起主题、参考层与恢复默认都在顶栏齿轮里，操作条不再有「更多」与「微调」两颗；
 * 「复制图片」只在导出抽屉里留一份。
 * v5 起没有「文字」快捷键位：两行输入常驻在挑选栏第一节，一眼就看得见，再给它一个入口是重复。
 * v5 起没有「复制链接」：配置不进 URL，分享靠导出的图。
 * 导出按钮带同步锁与三态（idle / working / done）：working 至少 600 ms 可见，
 * 成功后 400 ms 确认态再解锁，连点窗口约一秒，失败立即解锁可重试。
 * 两个随机按钮点一下，按钮上荡一圈 CSS 涟漪，预览框同时弹一下，都归炫技层管。
 */

import { useCallback, useRef, useState } from 'react'
import {
  CheckIcon,
  DownloadIcon,
  Loader2Icon,
  SettingsIcon,
  ShuffleIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { createExportArtifact } from '@/export/action'
import { downloadBlob } from '@/export/download'
import { isWeChat } from '@/export/share'
import { releaseCanvas } from '@/lib/canvas'
import { queueHistoryThumbnail } from '@/app/history-thumb'
import { Ripple, useRipple } from '@/app/showcase/Ripple'
import { flushConfigSync, useAvatarStore } from '@/state/store'

/** loading 态最短展示时长：太快完成的导出也看得见状态，吸收补点。 */
const MIN_WORKING_MS = 600
/** 成功确认态时长：勾一下再解锁，连点两下只出一张。 */
const DONE_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 一格按钮：手机上图标压文案，桌面上并排。桌面是一行三列 grid 的一格。 */
const item =
  'relative flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] leading-none font-medium transition-colors focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none lg:h-10 lg:min-h-0 lg:flex-row lg:gap-1.5 lg:px-2.5 lg:text-sm'
/** 次级动作：描边加卡片底，与背景拉开一层。 */
const quiet =
  'border-border bg-card/80 text-foreground hover:bg-accent hover:text-accent-foreground'
/** 一级动作：实心。 */
const accent = 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
const iconClass = 'size-5 shrink-0 lg:size-4'
const labelClass = 'w-full truncate text-center'

export function BottomBar() {
  const t = useT()
  const randomize = useAvatarStore((state) => state.randomize)
  const randomizePalette = useAvatarStore((state) => state.randomizePalette)
  const pushHistory = useAvatarStore((state) => state.pushHistory)
  const setUi = useAvatarStore((state) => state.setUi)
  // 两个随机各有一次触发；fire 同时让预览框弹一下
  const colorRipple = useRipple()
  const paletteRipple = useRipple()

  const fireColor = colorRipple.fire
  const firePalette = paletteRipple.fire

  const onShuffle = useCallback(() => {
    randomize()
    pushHistory()
    queueHistoryThumbnail()
    fireColor()
  }, [randomize, pushHistory, fireColor])

  const onShufflePalette = useCallback(() => {
    randomizePalette()
    pushHistory()
    queueHistoryThumbnail()
    firePalette()
  }, [randomizePalette, pushHistory, firePalette])

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
      <div className="flex items-stretch gap-1 px-2 py-1.5 lg:grid lg:grid-cols-3 lg:items-center lg:gap-2 lg:px-3 lg:py-2">
        <button
          type="button"
          data-slot="shuffle-color"
          onClick={onShuffle}
          aria-label={t('bottombar.reroll')}
          title={t('bottombar.reroll.hint')}
          className={cn(item, accent)}
        >
          <ShuffleIcon className={iconClass} aria-hidden />
          <span className={labelClass}>{t('bottombar.reroll')}</span>
          <Ripple token={colorRipple.token} />
        </button>

        <button
          type="button"
          data-slot="shuffle-palette"
          onClick={onShufflePalette}
          aria-label={t('bottombar.randomPalette')}
          title={t('bottombar.randomPalette.hint')}
          className={cn(item, quiet)}
        >
          <SparklesIcon className={iconClass} aria-hidden />
          <span className={labelClass}>{t('bottombar.randomPalette')}</span>
          <Ripple token={paletteRipple.token} />
        </button>

        {/* 导出加选项钮合成一颗分裂按钮，占三格里的最后一格；
            手机上仍是通栏三格里权重稍高的一格 */}
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
            <span className={labelClass}>{exportLabel}</span>
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
    </div>
  )
}
