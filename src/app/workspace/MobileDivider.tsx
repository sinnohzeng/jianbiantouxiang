/**
 * 手机上预览与操作区之间的拖拽分隔条。
 *
 * 拖动改 `--preview-h`，双击回默认，上下键每次 4 svh。
 * 指针移动听在 window 上而不是元素上：手指划出这条 28 px 的窄带是常事，
 * 挂在元素上会中途丢事件，高度就停在半路。
 */

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  MAX_PREVIEW_HEIGHT,
  MIN_PREVIEW_HEIGHT,
  PREVIEW_HEIGHT_STEP,
  usePreviewHeight,
} from '@/app/preview-height'
import { useT } from '@/i18n'

export function MobileDivider() {
  const t = useT()
  const { height, setHeight, reset } = usePreviewHeight()
  // 拖动过程中读的是起点快照，不跟着渲染走，省掉一次次重建监听
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      dragRef.current = { startY: event.clientY, startHeight: height }

      const onMove = (move: globalThis.PointerEvent): void => {
        const drag = dragRef.current
        if (!drag) return
        const viewport = globalThis.innerHeight || 1
        // 往下拖预览变高，往上拖变矮；像素差换成 svh
        const delta = ((move.clientY - drag.startY) / viewport) * 100
        setHeight(drag.startHeight + delta)
      }
      const onUp = (): void => {
        dragRef.current = null
        cleanupRef.current?.()
      }
      const stop = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        cleanupRef.current = null
      }

      cleanupRef.current?.()
      cleanupRef.current = stop
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [height, setHeight],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowDown') setHeight(height + PREVIEW_HEIGHT_STEP)
      else if (event.key === 'ArrowUp') setHeight(height - PREVIEW_HEIGHT_STEP)
      else if (event.key === 'Home') setHeight(MIN_PREVIEW_HEIGHT)
      else if (event.key === 'End') setHeight(MAX_PREVIEW_HEIGHT)
      else return
      event.preventDefault()
    },
    [height, setHeight],
  )

  return (
    <div
      data-slot="preview-divider"
      role="separator"
      aria-orientation="horizontal"
      aria-label={t('preview.divider')}
      title={t('preview.divider.hint')}
      aria-valuenow={Math.round(height)}
      aria-valuemin={MIN_PREVIEW_HEIGHT}
      aria-valuemax={MAX_PREVIEW_HEIGHT}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      // touch-none 挡住浏览器接管竖向手势，否则一拖就变成滚动页面
      className="focus-visible:ring-ring/60 sticky top-[calc(3.5rem_+_var(--preview-h))] z-20 flex h-7 w-full touch-none items-center justify-center focus-visible:ring-3 focus-visible:outline-none lg:hidden"
    >
      <span aria-hidden className="bg-border h-1 w-9 rounded-full" />
    </div>
  )
}
