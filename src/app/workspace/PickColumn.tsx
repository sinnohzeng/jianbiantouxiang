/**
 * 挑选栏：两列并排。左列是文字与图标，右列是配色与质感，画布挪进了导出抽屉。
 *
 * 分列的依据是使用频率：改文字和换配色是这个工具最常用的两件事，让它们同屏并排，
 * 不用先切页签也不用滚一屏。放不下两列就退化成一列纵向滚，
 * 拆不拆、什么时候拆全在 index.css 的工作台栅格里定，这里不写断点：
 * 判据是剩给画框多少宽度，微调开合会改答案，光看视口宽度判不出来。
 * 每列自己一个 StaggerRoot，卡片按节拍淡入上浮。
 */

import { StaggerRoot } from '@/app/showcase/stagger'
import { GraphicSection } from './sections/GraphicSection'
import { PaletteSection } from './sections/PaletteSection'
import { StyleSection } from './sections/StyleSection'
import { TextSection } from './sections/TextSection'

/** 两列共用的排布。各自滚还是跟着外层壳滚由 index.css 按拆没拆两列切。 */
const column = 'flex flex-col gap-3'

export function PickColumn() {
  return (
    // 拆成两列时 index.css 会把这层壳设成 display:contents，
    // 两个子列越过它直接成为工作台的 grid 项，各占一列
    <div
      data-slot="pick-columns"
      className="gap-3 px-4 pt-3 lg:min-h-0 lg:overflow-y-auto lg:px-0.5 lg:pt-0"
    >
      <StaggerRoot data-slot="pick-column" className={column}>
        <TextSection />
        <GraphicSection />
      </StaggerRoot>
      <StaggerRoot data-slot="pick-column-color" className={column}>
        <PaletteSection />
        <StyleSection />
      </StaggerRoot>
    </div>
  )
}
