import type { AvatarConfig } from '@/state/config'
import type { Rect } from '@/text/layout'

/** lucide 的图标节点：元素名加安全属性。 */
export type LucideIconNode = readonly [
  tag: string,
  attrs: Readonly<Record<string, string>>,
]

/**
 * 图形的三种运行时形态。路径保留矢量，导出 8192 时不因预览尺寸先栅格化而发糊；
 * 图片保留原色，只做等比 drawImage。
 */
export type Graphic =
  | {
      kind: 'lucide'
      path: Path2D
      width: 24
      height: 24
    }
  | {
      kind: 'image'
      image: CanvasImageSource
      width: number
      height: number
    }

export type GraphicIcon = AvatarConfig['layout']['icon']

/** 画图形。内置图标跟随文字效果；图片类保持原色。 */
export type DrawGraphic = (
  ctx: CanvasRenderingContext2D,
  graphic: Graphic,
  rect: Rect,
  config: AvatarConfig,
  color: string,
) => void
