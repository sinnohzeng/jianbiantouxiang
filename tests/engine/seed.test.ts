import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '@/state/config'
import {
  hashSeed,
  intFrom,
  mulberry32,
  pickFrom,
  randomSeed,
  rangeFrom,
  resolveSeed,
  seededRng,
} from '@/engine/seed'

function take(seed: string, count: number): number[] {
  const rng = mulberry32(seed)
  return Array.from({ length: count }, () => rng())
}

describe('hashSeed', () => {
  it('同一字符串给同一个无符号 32 位值', () => {
    expect(hashSeed('猪猪家族')).toBe(hashSeed('猪猪家族'))
    expect(hashSeed('')).toBeGreaterThanOrEqual(0)
    expect(hashSeed('a')).toBeLessThan(2 ** 32)
    expect(Number.isInteger(hashSeed('gradient'))).toBe(true)
  })

  it('相邻字符串不撞值', () => {
    expect(hashSeed('seed-a')).not.toBe(hashSeed('seed-b'))
    expect(hashSeed('ab')).not.toBe(hashSeed('ba'))
  })
})

describe('mulberry32', () => {
  it('同一种子产出同一数列', () => {
    expect(take('猪猪家族', 8)).toEqual(take('猪猪家族', 8))
  })

  it('不同种子产出不同数列', () => {
    expect(take('seed-a', 8)).not.toEqual(take('seed-b', 8))
  })

  it('输出落在 [0, 1)', () => {
    const rng = mulberry32('range-check')
    for (let i = 0; i < 2000; i += 1) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('一千次取值不重复到肉眼可见的程度', () => {
    const rng = mulberry32('spread')
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i += 1) seen.add(rng())
    expect(seen.size).toBeGreaterThan(990)
  })
})

describe('resolveSeed', () => {
  it('seed 为空时用文字派生', () => {
    expect(resolveSeed({ ...DEFAULT_CONFIG, seed: '', text: '产品设计部' })).toBe('产品设计部')
  })

  it('seed 优先于文字', () => {
    expect(resolveSeed({ ...DEFAULT_CONFIG, seed: 'abc123', text: '产品设计部' })).toBe('abc123')
  })

  it('两者都为空时退到常量而不是空串', () => {
    expect(resolveSeed({ ...DEFAULT_CONFIG, seed: '  ', text: '  ' })).toBe('gradient-avatar')
  })
})

describe('seededRng', () => {
  it('同一 seed 的不同通道互不相同', () => {
    const config = { ...DEFAULT_CONFIG, seed: 'channel' }
    const a = seededRng(config, 'style:mesh')()
    const b = seededRng(config, 'highlight')()
    expect(a).not.toBe(b)
  })
})

describe('randomSeed', () => {
  it('给出非空且长度有限的字符串', () => {
    const seed = randomSeed()
    expect(seed.length).toBeGreaterThan(0)
    expect(seed.length).toBeLessThanOrEqual(12)
  })

  it('连续两次基本不重复', () => {
    const seeds = new Set(Array.from({ length: 32 }, () => randomSeed()))
    expect(seeds.size).toBeGreaterThan(30)
  })
})

describe('取值辅助', () => {
  it('rangeFrom 落在区间内', () => {
    const rng = mulberry32('range')
    for (let i = 0; i < 500; i += 1) {
      const value = rangeFrom(rng, -0.25, 0.25)
      expect(value).toBeGreaterThanOrEqual(-0.25)
      expect(value).toBeLessThanOrEqual(0.25)
    }
  })

  it('intFrom 返回闭区间内的整数', () => {
    const rng = mulberry32('int')
    const seen = new Set<number>()
    for (let i = 0; i < 500; i += 1) {
      const value = intFrom(rng, 3, 8)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(8)
      seen.add(value)
    }
    expect(seen.size).toBe(6)
  })

  it('intFrom 在区间退化时给下界', () => {
    expect(intFrom(mulberry32('x'), 5, 5)).toBe(5)
  })

  it('pickFrom 只返回候选表里的元素', () => {
    const rng = mulberry32('pick')
    const pool = ['wave', 'ripple', 'blob'] as const
    for (let i = 0; i < 300; i += 1) {
      expect(pool).toContain(pickFrom(rng, pool))
    }
  })

  it('pickFrom 遇空表抛错而不是返回 undefined', () => {
    expect(() => pickFrom(mulberry32('empty'), [])).toThrow()
  })
})
