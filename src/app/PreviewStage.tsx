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
 * 文字色就是用户挑的那一个，预览不再另起离屏 WebGL 去采样判色。
 * 网格与安全区参考线的开关在操作条的「更多」里，不压在作品上。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getRenderCaps } from '@/engine/caps'
import { resolveColors } from '@/engine/colors'
import { cssFallbackBackground } from '@/engine/css-fallback'
import { drawHighlight } from '@/engine/highlight'
import { createGradientMount, type GradientMount } from '@/engine/mount'
import { resolveSeed } from '@/engine/seed'
import { drawGraphic } from '@/graphics/draw'
import { loadGraphic } from '@/graphics/source'
import type { Graphic } from '@/graphics/types'
import { fetchCatalog } from '@/fonts/catalog'
import type { FontEntry } from '@/fonts/catalog'
import { getCuratedByFamily } from '@/fonts/curated'
import { loadFontForConfig, quoteFamily } from '@/fonts/loader'
import { drawText } from '@/text/draw'
import { safeArea } from '@/text/fit'
import { layoutText } from '@/text/layout'
import { GRID_DIVISIONS, usePreviewOverlays } from '@/app/preview-overlays'
import { usePreviewSaveImage } from '@/app/preview-save-image'
import { PreviewFrame } from '@/app/showcase/PreviewFrame'
import { usePreviewFx } from '@/app/showcase/preview-fx'
import { useThrottled } from '@/app/use-throttled'
import { useIsMobile, useMediaQuery } from '@/hooks/use-media'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { snapFontRatio } from '@/state/config'
import { useAvatarStore } from '@/state/store'

/**
 * 推给 shader 的节流档。拖滑杆时最多每 80 ms 重建一次 uniforms，
 * 但拖动过程中一直在放行，松手前画面不会冻住；停手后再补最后一帧。
 */
const PREVIEW_THROTTLE_MS = 80

/** 预览画布的像素比上限，2 已经足够，再高只是白白多画像素。 */
const MAX_PREVIEW_DPR = 2

/** 上下文丢失后最多重建几次。反复丢说明这台设备扛不住，再重建也是白搭。 */
const MAX_CONTEXT_RESTARTS = 3

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

  const [box, setBox] = useState({ width: 0, height: 0 })
  // 参考层只读：开关在操作条的「更多」里。它们记在 localStorage，刷新后还在，
  // 不属于配置，导出永远不画
  const { guide, grid } = usePreviewOverlays()
  // 触屏才铺那张可长按保存的图；桌面用下载，叠一张静态图只会挡住实时预览
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const canLongPress = isMobile || coarsePointer
  const saveImage = usePreviewSaveImage(config, canLongPress)
  const [overflow, setOverflow] = useState(false)
  const [fontTick, setFontTick] = useState(0)
  const [graphic, setGraphic] = useState<Graphic | null>(null)

  const caps = useMemo(() => getRenderCaps(), [])
  // 进场、悬停倾斜与随机时的一下弹动，全部由炫技层给，关掉时这里退回裸元素。
  // 就地解构：ref 要以裸标识符的形式落到 ref 属性上，挂在对象上会被 react-hooks 判成渲染期读 ref
  const {
    hostRef: fxHostRef,
    className: fxClassName,
    tilt: fxTilt,
    onPointerMove: onFxPointerMove,
    onPointerLeave: onFxPointerLeave,
  } = usePreviewFx()
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

  const { fontFamily, fontSource, fontWeight } = config.typography
  const ink = preview.typography.color

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

      const drawConfig = preview
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
  }, [preview, box, ink, fontTick, graphic, setUi])

  const frameStyle = useMemo(() => {
    const { width, height, shape, radius } = preview.canvas
    // 长边贴住上限，短边按比例收窄，正方形与非正方形共用一套算法
    const widthFactor = width >= height ? 1 : width / height
    // 手机上预览区高度由用户拖的 --preview-h 决定；桌面上由外壳按断点给出 --preview-max，
    // 它是这一列留给预览的净空，两列档要给下面的检查器带让位，三列档几乎占满整列
    const edge = isMobile
      ? 'min(calc(100vw - 32px), calc(var(--preview-h) - 40px))'
      : 'min(var(--preview-max, 70vh), 960px)'
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
      <div
        ref={fxHostRef}
        className={cn('relative w-full max-w-full', fxClassName)}
        style={{ width: frameStyle.width }}
        onPointerMove={onFxPointerMove}
        onPointerLeave={onFxPointerLeave}
      >
        {/* 画框底下的一团光晕，取当前配色、大半径模糊，从画框往外化开。
            少了它，画框底边就是一条硬直线压在环境光上，看着像容器没收住。
            它排在画框前面，靠 DOM 顺序垫在底下，不用负 z-index：
            炫技层给外层挂 transform，负层级会被那个层叠上下文夹住，关掉炫技层时又不会 */}
        <div
          aria-hidden
          data-slot="preview-bloom"
          className="pointer-events-none absolute inset-x-5 -bottom-9 top-1/3 opacity-55 blur-[64px] dark:opacity-40"
          style={{
            background: frameStyle.background,
            borderRadius: frameStyle.borderRadius,
          }}
        />

        <PreviewFrame
          ref={frameRef}
          role="img"
          aria-label={label}
          // 三层投影：贴边一层压住边缘，中层给厚度，最外一层拖得很长很淡。
          // 单层短投影会在画框底下收出一条看得见的边，那正是「分界线」的来源
          className="relative isolate w-full overflow-hidden shadow-[0_2px_10px_-6px_rgba(0,0,0,0.22),0_26px_70px_-34px_rgba(0,0,0,0.30),0_64px_150px_-70px_rgba(0,0,0,0.28)] ring-1 ring-black/5 dark:ring-white/10"
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

          {/* 跟着指针走的高光。只在桌面挂：触屏没有悬停，那张可长按保存的图也不该被它罩住 */}
          {fxTilt ? (
            <div
              aria-hidden
              className="showcase-preview-glow pointer-events-none absolute inset-0"
            />
          ) : null}

        </PreviewFrame>

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
