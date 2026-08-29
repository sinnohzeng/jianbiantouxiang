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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScanIcon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getRenderCaps } from '@/engine/caps'
import { resolveColors } from '@/engine/colors'
import { cssFallbackBackground } from '@/engine/css-fallback'
import { drawHighlight } from '@/engine/highlight'
import { createGradientMount, type GradientMount } from '@/engine/mount'
import { renderGradient } from '@/engine/render'
import { resolveSeed } from '@/engine/seed'
import { releaseCanvas } from '@/export/canvas'
import { fetchCatalog } from '@/fonts/catalog'
import type { FontEntry } from '@/fonts/catalog'
import { getCuratedByFamily } from '@/fonts/curated'
import { loadFontForConfig, quoteFamily } from '@/fonts/loader'
import { INK_LIGHT, resolveInk } from '@/text/auto-color'
import { drawText } from '@/text/draw'
import { effectiveConfig } from '@/text/effective'
import { safeArea } from '@/text/fit'
import { layoutText } from '@/text/layout'
import { probeKey } from '@/app/probe-key'
import { useThrottled } from '@/app/use-throttled'
import { useIsMobile } from '@/hooks/use-media'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { AvatarConfig } from '@/state/config'
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
async function probeInk(config: AvatarConfig): Promise<ProbeResult | null> {
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

    const layout = layoutText(config, probeWidth, probeHeight)
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
  const [guide, setGuide] = useState(false)
  const [autoInk, setAutoInk] = useState(INK_LIGHT)
  const [autoPlate, setAutoPlate] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [fontTick, setFontTick] = useState(0)

  const caps = useMemo(() => getRenderCaps(), [])
  const preview = useThrottled(config, PREVIEW_THROTTLE_MS)
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
        .then(() => (cancelled ? null : probeInk(previewRef.current)))
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
  }, [probeSignature, colorMode])

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
      if (drawConfig.text.trim() === '') {
        setOverflow(false)
        return
      }
      const layout = layoutText(drawConfig, pixelWidth, pixelHeight)
      drawText(textCtx, layout, drawConfig, ink)
      setOverflow(layout.overflow)
    })

    return () => cancelAnimationFrame(frame)
  }, [preview, box, ink, plate, fontTick])

  const frameStyle = useMemo(() => {
    const { width, height, shape, radius } = preview.canvas
    // 长边贴住上限，短边按比例收窄，正方形与非正方形共用一套算法
    const widthFactor = width >= height ? 1 : width / height
    const edge = isMobile ? 'min(calc(100vw - 32px), 44svh)' : 'min(70vh, 720px)'
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

  const toggleGuide = useCallback(() => setGuide((on) => !on), [])

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

        <button
          type="button"
          aria-pressed={guide}
          aria-label={t('preview.safeArea')}
          title={t('preview.safeArea.hint')}
          onClick={toggleGuide}
          className={cn(
            'tap-target absolute top-2 right-2 flex items-center justify-center rounded-full backdrop-blur-sm transition-colors',
            'focus-visible:ring-ring/60 focus-visible:ring-3 focus-visible:outline-none',
            guide ? 'bg-white/85 text-neutral-900' : 'bg-black/35 text-white hover:bg-black/50',
          )}
        >
          <ScanIcon className="size-5" />
        </button>
      </div>

      <div className="flex min-h-5 w-full max-w-full flex-col items-center gap-1 text-center">
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
