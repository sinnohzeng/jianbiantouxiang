/**
 * font-family 与 canvas font 简写的字符串工具。排版、加载器与界面都从这里取：
 * `src/text` 引用本模块，`src/fonts` 不引用 `src/text`。
 */

import { cssPx } from '@/lib/canvas'
import type { FontChoice } from '@/state/config'

/** 家族名之后追加的系统字体链，覆盖三大平台的中日韩与拉丁默认字体。 */
export const SYSTEM_FALLBACK =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

/** 家族名一律加引号：用户可上传任意名字的字体，空格与中文名不加引号会被解析成多个家族。 */
export function quoteFamily(family: string): string {
  const name = family.trim().replace(/["\\]/g, '')
  return name ? `"${name}"` : ''
}

/** font-family 值：目标字体在前，系统字体链兜底。 */
export function fontFamilyStack(family: string): string {
  const head = quoteFamily(family)
  return head ? `${head}, ${SYSTEM_FALLBACK}` : SYSTEM_FALLBACK
}

/** canvas font 简写：字重 + 字号 + 家族链。画布绘制与 document.fonts.load 都用它。 */
export function fontString(font: Pick<FontChoice, 'family' | 'weight'>, px: number): string {
  return `${font.weight} ${cssPx(px)} ${fontFamilyStack(font.family)}`
}
