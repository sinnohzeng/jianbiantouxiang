/** Rectangle corners inside an inset circular crop. Uses actual ink bounds, not an inscribed square. */
export function insideCircle(
  rect: { x: number; y: number; width: number; height: number },
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = Math.max(Math.abs(rect.x - cx), Math.abs(rect.x + rect.width - cx))
  const dy = Math.max(Math.abs(rect.y - cy), Math.abs(rect.y + rect.height - cy))
  return Math.hypot(dx, dy) <= radius + 0.01
}
