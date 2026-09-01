import { useEffect, useRef, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { drawGraphic } from '@/graphics/draw'
import { loadGraphic } from '@/graphics/source'
import type { Graphic, GraphicIcon } from '@/graphics/types'
import type { AvatarConfig } from '@/state/config'

const SIZE = 40

export interface GraphicThumbProps {
  icon: GraphicIcon
  config: AvatarConfig
  color: string
}

/** 当前图形的缩略图。加载失败只退回占位图标，不阻塞文字面板。 */
export function GraphicThumb({ icon, config, color }: GraphicThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [graphic, setGraphic] = useState<Graphic | null>(null)

  const { source, id } = icon
  useEffect(() => {
    let cancelled = false
    const task =
      source === 'none' || id === '' ? Promise.resolve(null) : loadGraphic({ source, id })
    void task.then((next) => {
      if (!cancelled) setGraphic(next)
    })
    return () => {
      cancelled = true
    }
  }, [source, id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !graphic) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = SIZE * 2
    canvas.height = SIZE * 2
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scale = Math.min(canvas.width / graphic.width, canvas.height / graphic.height)
    const width = graphic.width * scale
    const height = graphic.height * scale
    drawGraphic(
      ctx,
      graphic,
      {
        x: (canvas.width - width) / 2,
        y: (canvas.height - height) / 2,
        width,
        height,
      },
      config,
      color,
    )
  }, [config, color, graphic])

  if (icon.source === 'none' || icon.id === '' || !graphic) {
    return (
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
        <ImageIcon className="size-5" aria-hidden="true" />
      </span>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="bg-muted size-10 shrink-0 rounded-md"
      style={{ width: SIZE, height: SIZE }}
    />
  )
}
