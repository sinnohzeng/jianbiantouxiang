/** 挑选栏与检查器带共用的小工具：两行文字的读写与行级数组的写入。 */

import { LINE_OVERRIDE_MAX } from '@/state/config'

/** 单行输入不允许带出换行：粘贴进来的多行在这里并成一行。 */
export function stripBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '')
}

/** 第二行为空时不留尾随换行，存储形态与两行模型一一对应。 */
export function joinLines(first: string, second: string): string {
  return second === '' ? first : `${first}\n${second}`
}

/** 写第 index 档行级参数，缺的档位用 fallback 补齐，最多两档。 */
export function withLineValue(
  values: readonly number[],
  index: number,
  value: number,
  fallback: number,
): number[] {
  const length = Math.min(Math.max(values.length, index + 1), LINE_OVERRIDE_MAX)
  const next = Array.from({ length }, (_, position) => values[position] ?? fallback)
  next[index] = value
  return next
}
