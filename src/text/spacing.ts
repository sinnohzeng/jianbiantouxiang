import { LINE_GAP_RATIO, LINE_HEIGHT_DEFAULT } from '@/state/config'

/** Visible-ink spacing: brand/title separation is stronger than title/subtitle separation. */
export function brandGap(short: number, aspect: number): number {
  return short * (aspect >= 4 ? 0.06 : 0.045)
}
export function titleGap(short: number, fontSize: number): number {
  return Math.max(short * 0.035, fontSize * 0.18)
}

/**
 * 第一行与第二行之间的留白，`fontSize` 取两行里较大的字号。有 Logo 时按标题组间距，纯文字按字号比例；
 * 行高把这段留白按字号等量加减，默认行高下就是基准值。
 */
export function stackGap(
  short: number,
  fontSize: number,
  withLogo: boolean,
  lineHeight: number,
): number {
  const base = withLogo ? titleGap(short, fontSize) : fontSize * LINE_GAP_RATIO
  return Math.max(0, base + (lineHeight - LINE_HEIGHT_DEFAULT) * fontSize)
}
