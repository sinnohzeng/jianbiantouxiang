/**
 * 挑选栏：两列并排。左列是文字与图形，右列是配色与质感，画布挪进了微调面板。
 *
 * 分列的依据是使用频率：改文字和换配色是这个工具最常用的两件事，让它们同屏并排，
 * 不用先切页签也不用滚一屏。1024 到 1279 放不下两列，退化成一列纵向滚。
 * 每列自己一个 StaggerRoot，卡片按节拍淡入上浮。
 */

import { StaggerRoot } from '@/app/showcase/stagger'
import { GraphicSection } from './sections/GraphicSection'
import { PaletteSection } from './sections/PaletteSection'
import { StyleSection } from './sections/StyleSection'
import { TextSection } from './sections/TextSection'

/** 两列共用的排布：三列档各自成列各自滚，两列档由外层容器统一滚。 */
const column =
  'flex flex-col gap-3 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto xl:px-0.5'

export function PickColumn() {
  return (
    // xl:contents 让这层壳在三列档消失，两个子列直接成为 grid 项各占一列
    <div
      data-slot="pick-columns"
      className="flex flex-col gap-3 px-4 pt-3 lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:px-0.5 lg:pt-0 xl:contents"
    >
      <StaggerRoot data-slot="pick-column" className={`${column} xl:col-start-1`}>
        <TextSection />
        <GraphicSection />
      </StaggerRoot>
      <StaggerRoot data-slot="pick-column-color" className={`${column} xl:col-start-2`}>
        <PaletteSection />
        <StyleSection />
      </StaggerRoot>
    </div>
  )
}
