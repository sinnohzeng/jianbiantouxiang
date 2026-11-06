/** Visible-ink spacing: brand/title separation is stronger than title/subtitle separation. */
export function brandGap(short: number, aspect: number): number {
  return short * (aspect >= 4 ? 0.075 : 0.06)
}
export function titleGap(short: number, fontSize: number): number {
  return Math.max(short * 0.05, fontSize * 0.24)
}
