/** 挑选栏四张卡片共用的小工具：两行文字的读写。 */

/** 单行输入不允许带出换行：粘贴进来的多行在这里并成一行。 */
export function stripBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '')
}

/** 第二行为空时不留尾随换行，存储形态与两行模型一一对应。 */
export function joinLines(first: string, second: string): string {
  return second === '' ? first : `${first}\n${second}`
}
