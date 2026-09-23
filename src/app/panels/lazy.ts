/**
 * 四个重件的懒加载入口。
 *
 * 导出抽屉带整套 Drawer 与编码链路，字体与图形选择器带 cmdk 与索引，历史条只在有历史时才有内容，
 * 三个都不是首屏必需，拆出去让入口 chunk 守住 spec §4 的 250 KB gzip 上限。
 * 用它们的地方要自己包一层 Suspense，并且只在真要显示时才挂上，否则等于没拆。
 *
 * 单测直接从各自模块取真组件，不走这里，免得为了拆包给每个用例套 Suspense。
 */

import { lazy } from 'react'

export const ExportDrawerLazy = lazy(() =>
  import('./ExportDrawer').then((module) => ({ default: module.ExportDrawer })),
)

// 面板与手机抽屉同在一个模块，两个出口共用一份 chunk
export const FontPickerPanelLazy = lazy(() =>
  import('./FontPickerPanel').then((module) => ({ default: module.FontPickerPanel })),
)

export const FontPickerDrawerLazy = lazy(() =>
  import('./FontPickerPanel').then((module) => ({ default: module.FontPickerDrawer })),
)

export const IconPickerLazy = lazy(() =>
  import('./IconPicker').then((module) => ({ default: module.IconPicker })),
)

export const HistoryStripLazy = lazy(() =>
  import('./HistoryStrip').then((module) => ({ default: module.HistoryStrip })),
)
