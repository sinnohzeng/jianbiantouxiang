/**
 * 实时预览。
 *
 * 三层叠在一个定长方框里：底下是 ShaderMount 的 WebGL 画布，
 * 中间一张 2D 画布画高光（CSS mix-blend-mode 走 screen，与导出的合成顺序对齐），
 * 上面一张 2D 画布画文字。形状裁切交给 CSS，不在预览里做像素级遮罩。
 *
 * shader 画布的上下文可能被浏览器判掉（显存吃紧、GPU 复位、后台标签页回收），
 * 丢了之后 setUniforms 全是空操作、画面再也不动，所以挂载处监听 webglcontextlost 整块重建。
 *
 * 自动文字色要读“文字下方的画面”，而 WebGL 画布没开 preserveDrawingBuffer 读不回来，
 * 所以另开一条低分辨率探针：用导出同一条 renderGradient 路径画 128 px 的小图，
 * 在上面取色并判断要不要加底板。探针走的是尾沿防抖，比预览再多等一档，拖滑杆时不会每帧起一次 WebGL。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Grid3x3Icon, ScanIcon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getRenderCaps } from '@/engine/caps'
import { resolveColors } from '@/engine/colors'
import { cssFallbackBackground } from '@/engine/css-fallback'
import { drawHighlight } from '@/engine/highlight'
import { createGradientMount, type GradientMount } from '@/engine/mount'
import { renderGradient } from '@/engine/render'
import { resolveSeed } from '@/engine/seed'
import { releaseCanvas } from '@/export/canvas'
import { drawGraphic } from '@/graphics/draw'
import { loadGraphic } from '@/graphics/source'
import type { Graphic } from '@/graphics/types'
import { fetchCatalog } from '@/fonts/catalog'
import type { FontEntry } from '@/fonts/catalog'
import { getCuratedByFamily } from '@/fonts/curated'
import { loadFontForConfig, quoteFamily } from '@/fonts/loader'
import { INK_LIGHT, resolveInk } from '@/text/auto-color'
import { drawText } from '@/text/draw'
import { effectiveConfig } from '@/text/effective'
import { safeArea } from '@/text/fit'
import { layoutText } from '@/text/layout'
import { GRID_DIVISIONS, usePreviewOverlays } from '@/app/preview-overlays'
import { usePreviewSaveImage } from '@/app/preview-save-image'
import { probeKey } from '@/app/probe-key'
import { useThrottled } from '@/app/use-throttled'
import { useIsMobile, useMediaQuery } from '@/hooks/use-media'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { snapFontRatio, type AvatarConfig } from '@/state/config'
import { useAvatarStore } from '@/state/store'

/**
 * 推给 shader 的节流档。拖滑杆时最多每 80 ms 重建一次 uniforms，
 * 但拖动过程中一直在放行，松手前画面不会冻住；停手后再补最后一帧。
 */
const PREVIEW_THROTTLE_MS = 80

/** 取色探针再多等一档：它要起一次离屏 WebGL，比 setUniforms 贵得多。 */
const PROBE_DELAY_MS = 220

/** 探针短边像素。够 resolveInk 的 64×64 采样，又不至于拖慢。 */
const PROBE_SHORT_SIDE = 128

/** 预览画布的像素比上限，2 已经足够，再高只是白白多画像素。 */
const MAX_PREVIEW_DPR = 2

/** 上下文丢失后最多重建几次。反复丢说明这台设备扛不住，再重建也是白搭。 */
const MAX_CONTEXT_RESTARTS = 3

interface ProbeResult {
  color: string
  plate: boolean
}

/** 用导出同一条路径画一张小图，在上面取自动文字色并判断要不要底板。 */
async function probeInk(
  config: AvatarConfig,
  graphic: Graphic | null,
): Promise<ProbeResult | null> {
  const { width, height } = config.canvas
  const ratio = width / height
  const probeWidth = Math.max(
    16,
    Math.round(ratio >= 1 ? PROBE_SHORT_SIDE * ratio : PROBE_SHORT_SIDE),
  )
  const probeHeight = Math.max(
    16,
    Math.round(ratio >= 1 ? PROBE_SHORT_SIDE : PROBE_SHORT_SIDE / ratio),
  )

  const canvas = document.createElement('canvas')
  canvas.width = probeWidth
  canvas.height = probeHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  try {
    const gradient = await renderGradient(config, probeWidth, probeHeight)
    ctx.fillStyle = config.exportOptions.bgColor
    ctx.fillRect(0, 0, probeWidth, probeHeight)
    ctx.drawImage(gradient, 0, 0, probeWidth, probeHeight)
    releaseCanvas(gradient)
    drawHighlight(ctx, probeWidth, probeHeight, config.highlight, resolveSeed(config))

    const layout = layoutText(config, probeWidth, probeHeight, undefined, graphic)
    return resolveInk(ctx, layout, config)
  } catch {
    return null
  } finally {
    releaseCanvas(canvas)
  }
}

/** 目录条目先查精选清单，再查 fontsource 目录的本地缓存，查到才传给加载器。 */
async function resolveFontEntry(family: string, source: string): Promise<FontEntry | undefined> {
  if (source !== 'google') return undefined
  const curated = getCuratedByFamily(family)
  if (curated) return curated
  try {
    const catalog = await fetchCatalog()
    const key = family.trim().toLowerCase()
    return catalog.find((entry) => entry.family.trim().toLowerCase() === key)
  } catch {
    return undefined
  }
}

export function PreviewStage() {
  const t = useT()
  const isMobile = useIsMobile()
  const config = useAvatarStore((state) => state.config)
  const setUi = useAvatarStore((state) => state.setUi)

  const frameRef = useRef<HTMLDivElement | null>(null)
  const mountHostRef = useRef<HTMLDivElement | null>(null)
  const highlightRef = useRef<HTMLCanvasElement | null>(null)
  const textRef = useRef<HTMLCanvasElement | null>(null)
  const gradientRef = useRef<GradientMount | null>(null)
  const initialConfigRef = useRef(config)
  const toastedRef = useRef(new Set<string>())
  const probeChain = useRef<Promise<unknown>>(Promise.resolve())

  const [box, setBox] = useState({ width: 0, height: 0 })
  // 参考层开关记在 localStorage，刷新后还在；它们不属于配置，导出永远不画
  const { guide, grid, setGuide, setGrid } = usePreviewOverlays()
  // 触屏才铺那张可长按保存的图；桌面用下载，叠一张静态图只会挡住实时预览
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const canLongPress = isMobile || coarsePointer
  const saveImage = usePreviewSaveImage(config, canLongPress)
  const [autoInk, setAutoInk] = useState(INK_LIGHT)
  const [autoPlate, setAutoPlate] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [fontTick, setFontTick] = useState(0)
  const [graphic, setGraphic] = useState<Graphic | null>(null)

  const caps = useMemo(() => getRenderCaps(), [])
  const preview = useThrottled(config, PREVIEW_THROTTLE_MS)
  // v4 起图标不属于任何「用途」，设置了就进栈，来源与标识直接读
  const iconSource = preview.layout.icon.source
  const iconId = preview.layout.icon.id
  const safeGuide = useMemo(
    () => safeArea(preview, box.width, box.height),
    [preview, box.width, box.height],
  )
  // 字体状态放 store，面板与预览看同一份，不必各存一份局部状态
  const fontLoading = useAvatarStore((state) => state.ui.fontStatus === 'loading')

  const { fontFamily, fontSource, fontWeight, colorMode, color } = config.typography

  // 取色结果只在 auto 模式下生效；文字清空时底板也跟着撤掉
  const ink = colorMode === 'custom' ? color : autoInk
  const plate = colorMode === 'auto' && preview.text.trim() !== '' && autoPlate

  // 挂载一次，之后只 update。style 换了由 mount 内部重建 shader 程序
  useEffect(() => {
    const host = mountHostRef.current
    if (!host) return

    let restarts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    /**
     * 上下文一丢，后续 setUniforms 与 setFrame 全是空操作，画面停在最后一帧，
     * 界面上却看不出任何异常。这里整块重建，旧画布随 dispose 一起摘掉。
     * webglcontextlost 不冒泡，监听挂在宿主上走捕获阶段，画布是异步建出来的也接得住。
     */
    const onContextLost = (event: Event): void => {
      // 按规范先 preventDefault，浏览器才把这次丢失当成页面已经接手
      event.preventDefault()
      if (restarts >= MAX_CONTEXT_RESTARTS || timer !== null) return
      restarts += 1
      // 退出事件派发再重建，别在浏览器还在处理丢失的当口拆画布
      timer = setTimeout(() => {
        timer = null
        gradientRef.current?.dispose()
        gradientRef.current = createGradientMount(host, useAvatarStore.getState().config)
      }, 0)
    }

    host.addEventListener('webglcontextlost', onContextLost, true)
    gradientRef.current = createGradientMount(host, initialConfigRef.current)

    return () => {
      host.removeEventListener('webglcontextlost', onContextLost, true)
      if (timer !== null) clearTimeout(timer)
      gradientRef.current?.dispose()
      gradientRef.current = null
    }
  }, [])

  useEffect(() => {
    gradientRef.current?.update(preview)
  }, [preview])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setBox({ width: Math.round(rect.width), height: Math.round(rect.height) })
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  // 图形与字体不同，只在来源与 id 变化时加载。配置里其他滑杆不该重复拉网络或索引 chunk。
  useEffect(() => {
    let cancelled = false
    const task =
      iconSource === 'none' || iconId === ''
        ? Promise.resolve(null)
        : loadGraphic({ source: iconSource, id: iconId })
    void task.then((next) => {
      if (!cancelled) setGraphic(next)
    })
    return () => {
      cancelled = true
    }
  }, [iconSource, iconId])

  // 字体：加载完成才重绘，否则 canvas 会先用回退字形画一遍
  useEffect(() => {
    let cancelled = false
    setUi({ fontStatus: 'loading' })

    void resolveFontEntry(fontFamily, fontSource)
      .then((entry) => loadFontForConfig(useAvatarStore.getState().config, { entry }))
      .then((result) => {
        if (cancelled) return
        setUi({ fontStatus: result.ok ? 'ready' : 'fallback' })
        setFontTick((tick) => tick + 1)
        if (result.ok) return
        const key = `${fontSource}|${fontFamily}`
        if (toastedRef.current.has(key)) return
        toastedRef.current.add(key)
        toast.warning(
          fontSource === 'upload' ? t('preview.font.upload') : t('preview.font.fallback'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [fontFamily, fontSource, fontWeight, setUi, t])

  // CJK 字体按 unicode-range 切片下发，新打的字要单独 load 一次才有字形
  useEffect(() => {
    const set = globalThis.document?.fonts
    const sample = preview.text
    if (!set || fontLoading || sample.trim() === '') return
    let cancelled = false
    void set
      .load(`${fontWeight} 32px ${quoteFamily(fontFamily)}`, sample)
      .then(() => {
        if (!cancelled) setFontTick((tick) => tick + 1)
      })
      .catch(() => {
        // 字体没就绪时这里必然失败，回退字形照样能画
      })
    return () => {
      cancelled = true
    }
  }, [preview.text, fontFamily, fontWeight, fontLoading])

  // preview 每次都是新对象，探针只认与取色相关的那部分，改导出格式不该起一次离屏渲染
  const previewRef = useRef(preview)
  useEffect(() => {
    previewRef.current = preview
  }, [preview])

  const probeSignature = useMemo(() => probeKey(preview), [preview])

  // 自动文字色与底板判定
  useEffect(() => {
    if (colorMode !== 'auto' || previewRef.current.text.trim() === '') return
    let cancelled = false
    // 串到上一次探针后面。防抖只挡得住还没起跑的那次，已经在跑的探针照样占着一个离屏
    // WebGL 上下文；连着改配置时它们会并行堆起来，浏览器一旦超过并发上限，
    // 被判掉的往往是常驻预览那个上下文。这里保证同时最多一个在跑、一个在排队。
    const timer = setTimeout(() => {
      probeChain.current = probeChain.current
        .catch(() => {})
        .then(() => (cancelled ? null : probeInk(previewRef.current, graphic)))
        .then((result) => {
          if (cancelled || !result) return
          setAutoInk(result.color)
          setAutoPlate(result.plate)
        })
    }, PROBE_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [probeSignature, colorMode, graphic])

  // 高光与文字。放进 rAF 画，既不挤占布局这一帧，也让排版结果的回写落在回调里
  useEffect(() => {
    const highlight = highlightRef.current
    const text = textRef.current
    if (!highlight || !text || box.width < 2 || box.height < 2) return

    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_PREVIEW_DPR)
      const pixelWidth = Math.max(1, Math.round(box.width * dpr))
      const pixelHeight = Math.max(1, Math.round(box.height * dpr))

      for (const canvas of [highlight, text]) {
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight
      }

      const highlightCtx = highlight.getContext('2d')
      const textCtx = text.getContext('2d')
      if (!highlightCtx || !textCtx) return

      highlightCtx.clearRect(0, 0, pixelWidth, pixelHeight)
      textCtx.clearRect(0, 0, pixelWidth, pixelHeight)
      drawHighlight(highlightCtx, pixelWidth, pixelHeight, preview.highlight, resolveSeed(preview))

      const drawConfig = effectiveConfig(preview, plate)
      const layout = layoutText(drawConfig, pixelWidth, pixelHeight, undefined, graphic)
      if (graphic && layout.graphic) {
        drawGraphic(textCtx, graphic, layout.graphic, drawConfig, ink)
      }
      if (drawConfig.text.trim() === '') {
        setOverflow(layout.overflow)
        return
      }
      drawText(textCtx, layout, drawConfig, ink)
      setOverflow(layout.overflow)

      // 把自动求得的基准字号比例回写给面板：字号滑杆在自动态显示它，
      // 用户一拖就从这个值切到手动。只在 auto 档写，手动档的 fontSizePx 就是用户自己的值。
      // 向下对齐到滑杆步进：值在网格上，轻触滑杆不会被取整到比求解上限更大的一档
      if (drawConfig.typography.sizeMode === 'auto') {
        const snapped = snapFontRatio(layout.fontRatio)
        if (useAvatarStore.getState().ui.autoFontSize !== snapped) {
          setUi({ autoFontSize: snapped })
        }
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [preview, box, ink, plate, fontTick, graphic, setUi])

  const frameStyle = useMemo(() => {
    const { width, height, shape, radius } = preview.canvas
    // 长边贴住上限，短边按比例收窄，正方形与非正方形共用一套算法
    const widthFactor = width >= height ? 1 : width / height
    // 手机上预览区高度由用户拖的 --preview-h 决定；桌面上由外壳按断点给出 --preview-max，
    // 它是这一列留给预览的净空，两列档要给下面的检查器带让位，三列档几乎占满整列
    const edge = isMobile
      ? 'min(calc(100vw - 32px), calc(var(--preview-h) - 40px))'
      : 'min(var(--preview-max, 70vh), 720px)'
    const shortSide = Math.min(box.width, box.height)
    const corner =
      shape === 'circle' ? '50%' : shape === 'rounded' ? `${shortSide * radius}px` : '0px'
    return {
      width: `min(calc(${edge} * ${widthFactor}), 100%)`,
      aspectRatio: `${width} / ${height}`,
      borderRadius: corner,
      background: cssFallbackBackground(preview, resolveColors(preview)),
    }
  }, [preview, box.width, box.height, isMobile])

  /**
   * 网格：正方形格子，边长取画布短边的 1/12，从画框中心铺开，所以横竖各有一条格线正好过中心；
   * 中心十字单独再画一层加粗。白色低透明度加 difference 混合，深浅底都看得见。
   * 全部用 CSS 渐变画，不占 2D 画布，也不进导出。
   */
  const gridStyle = useMemo(() => {
    const cell = Math.min(box.width, box.height) / GRID_DIVISIONS
    if (!(cell > 0)) return undefined
    const line = 'rgba(255, 255, 255, 0.28)'
    const axis = 'rgba(255, 255, 255, 0.6)'
    return {
      backgroundImage: [
        `linear-gradient(to right, ${axis} 0 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${axis} 0 1px, transparent 1px)`,
        `linear-gradient(to right, ${line} 0 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${line} 0 1px, transparent 1px)`,
      ].join(', '),
      backgroundSize: [
        `${box.width}px ${box.height}px`,
        `${box.width}px ${box.height}px`,
        `${cell}px ${cell}px`,
        `${cell}px ${cell}px`,
      ].join(', '),
      // 十字线定在画框正中；格子从中心对齐，格线与十字重合
      backgroundPosition: [
        `${box.width / 2}px 0`,
        `0 ${box.height / 2}px`,
        `${box.width / 2}px ${box.height / 2}px`,
        `${box.width / 2}px ${box.height / 2}px`,
      ].join(', '),
      backgroundRepeat: 'no-repeat, no-repeat, repeat, repeat',
    }
  }, [box.width, box.height])

  // 分隔符用中点而不是中文冒号，五种语言下读起来都不别扭
  const label =
    preview.text.trim() === '' ? t('preview.label') : `${t('preview.label')} · ${preview.text}`

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative w-full max-w-full" style={{ width: frameStyle.width }}>
        <div
          ref={frameRef}
          role="img"
          aria-label={label}
          className="relative isolate w-full overflow-hidden shadow-[0_18px_60px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:ring-white/10"
          style={{
            aspectRatio: frameStyle.aspectRatio,
            borderRadius: frameStyle.borderRadius,
            background: frameStyle.background,
          }}
        >
          <div
            ref={mountHostRef}
            data-slot="preview-shader"
            aria-hidden
            className="absolute inset-0"
          />
          <canvas
            ref={highlightRef}
            aria-hidden
            className="absolute inset-0 h-full w-full"
            style={{ mixBlendMode: 'screen' }}
          />
          <canvas ref={textRef} aria-hidden className="absolute inset-0 h-full w-full" />

          {/* 触屏上盖一张成品 JPG：长按它直接走系统的保存图片，不用先点导出。
              它压在实时画布之上、参考线之下，参考线本身不吃指针事件，长按能穿到这里 */}
          {saveImage ? (
            <img
              src={saveImage}
              alt={t('preview.longPressSave')}
              data-slot="preview-save-image"
              className="absolute inset-0 h-full w-full object-cover"
              // 长按菜单靠它，别被全局的 select-none 一类样式关掉
              style={{ WebkitTouchCallout: 'default' }}
            />
          ) : null}

          {grid && gridStyle ? (
            <div
              aria-hidden
              data-slot="preview-grid"
              className="pointer-events-none absolute inset-0 mix-blend-difference"
              style={gridStyle}
            />
          ) : null}

          {guide ? (
            <div aria-hidden className="absolute inset-0">
              {/* 圆形裁切取内接圆，非正方形画布下是居中的正圆而不是椭圆 */}
              <div
                className="absolute top-1/2 left-1/2 rounded-full border border-dashed border-white/80 mix-blend-difference"
                style={{
                  width: `${Math.min(box.width, box.height)}px`,
                  height: `${Math.min(box.width, box.height)}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* 安全框按形状收过，圆形下比边距画出来的方框小一圈，取的是排版真正用的那个框 */}
              <div
                className="absolute border border-dashed border-white/60 mix-blend-difference"
                style={{
                  left: `${safeGuide.x}px`,
                  top: `${safeGuide.y}px`,
                  width: `${safeGuide.width}px`,
                  height: `${safeGuide.height}px`,
                  borderRadius: '4px',
                }}
              />
            </div>
          ) : null}

          {/* 这条进度条只是装饰：它在 role="img" 的子树里，辅助技术会把整棵子树剥掉，
              播报交给画框外面那条常驻的 role="status" */}
          {fontLoading ? (
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-white/25">
              <div className="progress-indeterminate h-full w-1/5 rounded-full bg-white/95" />
            </div>
          ) : null}
        </div>

        {/* 角标与按钮挂在外层而不是画框里：画框 overflow-hidden 加大圆角，
            圆形与大圆角形状下贴角的元素会被裁掉一半，热区跟着一起没了 */}
        {plate ? (
          <p
            className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-1 text-[11px] leading-none font-medium text-white backdrop-blur-sm"
            title={t('preview.plate.hint')}
          >
            {t('preview.plate.badge')}
          </p>
        ) : null}

        {/* 两个参考层开关竖着排在右上角：网格在上、安全区在下，都是 aria-pressed 的切换钮 */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            type="button"
            data-slot="grid-toggle"
            aria-pressed={grid}
            aria-label={t('preview.grid')}
            title={t('preview.grid.hint')}
            onClick={() => setGrid(!grid)}
            className={cn(
              'tap-target flex items-center justify-center rounded-full backdrop-blur-sm transition-colors',
              'focus-visible:ring-ring/60 focus-visible:ring-3 focus-visible:outline-none',
              grid ? 'bg-white/85 text-neutral-900' : 'bg-black/35 text-white hover:bg-black/50',
            )}
          >
            <Grid3x3Icon className="size-5" />
          </button>
          <button
            type="button"
            data-slot="guide-toggle"
            aria-pressed={guide}
            aria-label={t('preview.safeArea')}
            title={t('preview.safeArea.hint')}
            onClick={() => setGuide(!guide)}
            className={cn(
              'tap-target flex items-center justify-center rounded-full backdrop-blur-sm transition-colors',
              'focus-visible:ring-ring/60 focus-visible:ring-3 focus-visible:outline-none',
              guide ? 'bg-white/85 text-neutral-900' : 'bg-black/35 text-white hover:bg-black/50',
            )}
          >
            <ScanIcon className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-5 w-full max-w-full flex-col items-center gap-1 text-center">
        {canLongPress ? (
          <p className="text-muted-foreground text-xs">{t('preview.longPressSave')}</p>
        ) : null}
        {/* live region 要常驻，内容从空变成有字才播报得出来；
            它也必须待在 role="img" 之外，img 的子树整棵不进无障碍树 */}
        <p role="status" className="sr-only">
          {fontLoading ? t('preview.font.loading') : ''}
        </p>
        {!caps.webgl2 ? (
          /* 两句各自成句，不在源码里拼标点：中日韩用不了 ASCII 句点，ja 的下半句本身就带全角句号 */
          <p className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs">
            <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
            <span>{t('preview.webgl.title')}</span>
            <span>{t('preview.webgl.desc')}</span>
          </p>
        ) : null}
        {overflow ? <p className="text-destructive text-xs">{t('preview.overflow')}</p> : null}
      </div>
    </div>
  )
}
