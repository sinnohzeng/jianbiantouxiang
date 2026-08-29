/**
 * 确定性随机源。同一 seed 必须在任何设备上给出同一串数字，
 * 所以只用整数运算，不碰 Math.random 与浮点哈希。
 */

import type { AvatarConfig } from '@/state/config'

export type Rng = () => number

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** seed 与 text 都为空时的兜底，保证画面不会退化成全 0 参数。 */
const EMPTY_SEED = 'gradient-avatar'

/** FNV-1a 32 位，返回无符号整数，用作 PRNG 的初值。 */
export function hashSeed(text: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/** mulberry32：状态只有 32 位，周期 2^32，够一次构图取十几个数用。 */
export function mulberry32(seedString: string): Rng {
  let state = hashSeed(seedString)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 随机按钮用的新种子，优先走 crypto，退化到 Math.random 也能跑。 */
export function randomSeed(): string {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (globalCrypto?.getRandomValues) {
    const buffer = new Uint32Array(2)
    globalCrypto.getRandomValues(buffer)
    return `${(buffer[0] ?? 0).toString(36)}${(buffer[1] ?? 0).toString(36)}`.slice(0, 12)
  }
  return Math.random().toString(36).slice(2, 14)
}

/** 配置里的有效种子：seed 为空时退到文字，文字也为空时用常量。 */
export function resolveSeed(config: AvatarConfig): string {
  const seed = config.seed.trim()
  if (seed) return seed
  const text = config.text.trim()
  return text || EMPTY_SEED
}

/** 同一 seed 下按用途分流，避免两处参数因为共用一条数列而联动。 */
export function seededRng(config: AvatarConfig, channel: string): Rng {
  return mulberry32(`${resolveSeed(config)}|${channel}`)
}

export function rangeFrom(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** 闭区间取整数。 */
export function intFrom(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(min)
  const hi = Math.floor(max)
  if (hi <= lo) return lo
  return lo + Math.floor(rng() * (hi - lo + 1))
}

export function pickFrom<T>(rng: Rng, items: readonly T[]): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length))
  const picked = items[index]
  if (picked === undefined) throw new Error('pickFrom: 候选列表为空')
  return picked
}
