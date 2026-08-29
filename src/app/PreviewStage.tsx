/**
 * 实时预览。
 *
 * 三层叠在一个定长方框里：底下是 ShaderMount 的 WebGL 画布，
 * 中间一张 2D 画布画高光（CSS mix-blend-mode 走 screen，与导出的合成顺序对齐），
 * 上面一张 2D 画布画文字。形状裁切交给 CSS，不在预览里做像素级遮罩。
 *
 * 自动文字色要读“文字下方的画面”，而 WebGL 画布没开 preserveDrawingBuffer 读不回来，
 * 所以另开一条低分辨率探针：用导出同一条 renderGradient 路径画 128 px 的小图，
 * 在上面取色并判断要不要加底板。探针比预览多防抖一档，拖滑杆时不会每帧起一次 WebGL。
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
import { INK_LIGHT, needsPlate, pickTextColor } from '@/text/auto-color'
import { drawText } from '@/text/draw'
import { effectiveConfig } from '@/text/effective'
import { layoutText } from '@/text/layout'
import { useDebounced } from '@/hooks/use-debounced'
import { useIsMobile } from '@/hooks/use-media'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { AvatarConfig } from '@/state/config'
import { useAvatarStore } from '@/state/store'

/** 配置停 80 ms 再推给 shader，拖滑杆时不至于每帧重建 uniforms。 */
const PREVIEW_DEBOUNCE_MS = 80

/** 取色探针再多等一档：它要起一次离屏 WebGL，比 setUniforms 贵得多。 */
const PROBE_DELAY_MS = 220

/** 探针短边像素。够 pickTextColor 的 64×64 采样，又不至于拖慢。 */
const PROBE_SHORT_SIDE = 128

/** 预览画布的像素比上限，2 已经足够，再高只是白白多画像素。 */
const MAX_PREVIEW_DPR = 2

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
    return {
      color: pickTextColor(ctx, layout, config),
      plate: needsPlate(ctx, layout, config),
    }
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

  const [box, setBox] = useState({ width: 0, height: 0 })
  const [guide, setGuide] = useState(false)
  const [autoInk, setAutoInk] = useState(INK_LIGHT)
  const [autoPlate, setAutoPlate] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [fontTick, setFontTick] = useState(0)

  const caps = useMemo(() => getRenderCaps(), [])
  const preview = useDebounced(config, PREVIEW_DEBOUNCE_MS)
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
    const mount = createGradientMount(host, initialConfigRef.current)
    gradientRef.current = mount
    return () => {
      mount.dispose()
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

  // 自动文字色与底板判定
  useEffect(() => {
    if (colorMode !== 'auto' || preview.text.trim() === '') return
    let cancelled = false
    const timer = setTimeout(() => {
      void probeInk(preview).then((result) => {
        if (cancelled || !result) return
        setAutoInk(result.color)
        setAutoPlate(result.plate)
      })
    }, PROBE_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [preview, colorMode])

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
              <div
                className="absolute border border-dashed border-white/60 mix-blend-difference"
                style={{
                  inset: `${preview.typography.padding * 100}%`,
                  borderRadius: '4px',
                }}
              />
            </div>
          ) : null}

          {fontLoading ? (
            <div
              role="status"
              aria-label={t('preview.font.loading')}
              className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-white/25"
            >
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
        {!caps.webgl2 ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <TriangleAlertIcon className="size-3.5" aria-hidden />
            <span>{`${t('preview.webgl.title')}. ${t('preview.webgl.desc')}`}</span>
          </p>
        ) : null}
        {overflow ? <p className="text-destructive text-xs">{t('preview.overflow')}</p> : null}
      </div>
    </div>
  )
}
