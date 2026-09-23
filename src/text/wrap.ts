import { isCjk, toGraphemes, type MeasureFn } from './measure'

const LINE_BREAK_RE = /\r\n|\r|\n/

/**
 * 按显式换行切段，并去掉首尾的空行。
 * 段内两端空白一并去掉：居中排版时留着空白会让视觉重心偏移。
 */
export function splitParagraphs(text: string): string[] {
  if (typeof text !== 'string' || text === '') return []
  const lines = text.split(LINE_BREAK_RE).map((line) => line.trim())
  let start = 0
  let end = lines.length
  while (start < end && lines[start] === '') start += 1
  while (end > start && lines[end - 1] === '') end -= 1
  return lines.slice(start, end)
}

let wordSegmenter: Intl.Segmenter | null | undefined

function getWordSegmenter(): Intl.Segmenter | null {
  if (wordSegmenter === undefined) {
    wordSegmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'word' })
        : null
  }
  return wordSegmenter
}

function segmentWords(line: string): string[] {
  const segmenter = getWordSegmenter()
  if (segmenter) {
    const out: string[] = []
    for (const item of segmenter.segment(line)) out.push(item.segment)
    return out
  }
  return line.match(/\s+|\S+/gu) ?? []
}

/** 把一个分词切片拆成排版原子：东亚字符逐字，连续拉丁保持整块。 */
function explode(segment: string): string[] {
  const out: string[] = []
  let buffer = ''
  for (const grapheme of toGraphemes(segment)) {
    if (isCjk(grapheme)) {
      if (buffer) {
        out.push(buffer)
        buffer = ''
      }
      out.push(grapheme)
    } else {
      buffer += grapheme
    }
  }
  if (buffer) out.push(buffer)
  return out
}

/** 一行文字的可断点单元。 */
export function toAtoms(line: string): string[] {
  const out: string[] = []
  for (const segment of segmentWords(line)) out.push(...explode(segment))
  return out
}

/** 不能出现在行首的标点。 */
const NO_LINE_START = new Set(
  Array.from('，。、；：？！）］｝〕〉》」』】·…‥ー々ヽヾゝゞ’”,.;:?!)]}»'),
)

/** 不能出现在行尾的标点。 */
const NO_LINE_END = new Set(Array.from('（［｛〔〈《「『【‘“([{«'))

function firstGrapheme(line: string): string {
  return toGraphemes(line)[0] ?? ''
}

function lastGrapheme(line: string): string {
  const graphemes = toGraphemes(line)
  return graphemes[graphemes.length - 1] ?? ''
}

/**
 * 简单避头尾：行首标点回收到上一行，行尾的开括号压到下一行。
 * 回收会让上一行略微超出安全框，随后由 fitText 的整体校验把字号收回来。
 */
function applyKinsoku(input: string[]): string[] {
  const lines = [...input]

  for (let i = 0; i < lines.length - 1; i += 1) {
    for (let guard = 0; guard < 2; guard += 1) {
      const current = lines[i] ?? ''
      const tail = lastGrapheme(current)
      if (!tail || !NO_LINE_END.has(tail) || current.length === tail.length) break
      lines[i] = current.slice(0, current.length - tail.length)
      lines[i + 1] = tail + (lines[i + 1] ?? '')
    }
  }

  for (let i = 1; i < lines.length; i += 1) {
    for (let guard = 0; guard < 2; guard += 1) {
      const current = lines[i] ?? ''
      const previous = lines[i - 1] ?? ''
      const head = firstGrapheme(current)
      if (!head || !NO_LINE_START.has(head)) break
      if (current.length === head.length || toGraphemes(previous).length <= 1) break
      lines[i - 1] = previous + head
      lines[i] = current.slice(head.length)
    }
  }

  return lines
}

/**
 * 按安全区宽度贪心换行。拉丁按词、东亚逐字，单个原子超宽时再拆成字素。
 */
export function wrapLine(
  line: string,
  maxWidth: number,
  measure: MeasureFn,
  font: string,
  letterSpacingPx: number,
): string[] {
  return wrapLineParts(line, maxWidth, measure, font, letterSpacingPx).lines
}

/** 换行结果，外加「有没有把一个词硬拆开」。 */
export interface WrapParts {
  lines: string[]
  /** 某个原子（拉丁词）宽过安全区，只能拆成字素才放得下。自动填满据此回避这一档字号。 */
  broke: boolean
}

/**
 * 同 `wrapLine`，另外报告有没有把词硬拆开。
 * 拉丁词被从中间断开在头像上很扎眼，自动填满宁可退一档字号也不要这个结果。
 */
export function wrapLineParts(
  line: string,
  maxWidth: number,
  measure: MeasureFn,
  font: string,
  letterSpacingPx: number,
): WrapParts {
  if (line === '') return { lines: [''], broke: false }
  const widthOf = (text: string) => measure(text, font, letterSpacingPx).width
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return { lines: [line], broke: false }
  if (widthOf(line) <= maxWidth) return { lines: [line], broke: false }

  const atoms: string[] = []
  let broke = false
  for (const atom of toAtoms(line)) {
    if (widthOf(atom) <= maxWidth) {
      atoms.push(atom)
      continue
    }
    const graphemes = toGraphemes(atom)
    // 单个字素本来就超宽时拆不动，那不算把词拆开
    if (graphemes.length > 1) broke = true
    atoms.push(...graphemes)
  }

  const lines: string[] = []
  let current = ''
  for (const atom of atoms) {
    const blank = atom.trim() === ''
    if (current === '') {
      if (blank) continue
      current = atom
      continue
    }
    if (widthOf(current + atom) <= maxWidth) {
      current += atom
      continue
    }
    lines.push(current.trimEnd())
    current = blank ? '' : atom
  }
  const tail = current.trimEnd()
  if (tail !== '') lines.push(tail)

  return { lines: lines.length > 0 ? applyKinsoku(lines) : [line], broke }
}
