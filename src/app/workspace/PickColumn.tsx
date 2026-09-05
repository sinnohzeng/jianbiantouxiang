/**
 * 挑选栏：文字、图形、配色、质感、画布五节，每节一张卡片，标题常驻不折叠。
 * 页签与手风琴在 v5 全部取消，桌面 1440 一屏之内看得全，改配色不用先切页签再滚一屏。
 * 五节的进场节拍由 StaggerRoot 统一给，每节自己不排队。
 */

import { StaggerRoot } from '@/app/showcase/stagger'
import { CanvasSection } from './sections/CanvasSection'
import { GraphicSection } from './sections/GraphicSection'
import { PaletteSection } from './sections/PaletteSection'
import { StyleSection } from './sections/StyleSection'
import { TextSection } from './sections/TextSection'

export function PickColumn() {
  return (
    <StaggerRoot data-slot="pick-column" className="flex flex-col gap-3">
      <TextSection />
      <GraphicSection />
      <PaletteSection />
      <StyleSection />
      <CanvasSection />
    </StaggerRoot>
  )
}
