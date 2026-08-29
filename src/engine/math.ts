/** 引擎内部的数值工具，只服务于参数映射，不做通用数学库。 */

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(t, 0, 1)
}

/** 保留小数位，避免同一配置因为浮点尾数在缓存与断言里被当成两份。 */
export function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
