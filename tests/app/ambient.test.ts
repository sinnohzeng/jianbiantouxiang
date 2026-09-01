import { describe, expect, it } from 'vitest'
import {
  AMBIENT_DEFAULT,
  AMBIENT_STORAGE_KEY,
  getAmbientLevel,
  setAmbientLevel,
  suppressBlobColor,
} from '@/app/ambient'
import { oklch } from '@/palettes/culori'

describe('suppressBlobColor', () => {
  it('浅色主题降饱和并压明度', () => {
    const before = oklch('#f3c4d8')
    const after = oklch(suppressBlobColor('#f3c4d8', 'light'))
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!.c).toBeLessThan(before!.c * 0.6)
    expect(after!.l).toBeLessThan(before!.l)
  })

  it('深色主题原色返回', () => {
    expect(suppressBlobColor('#8d7cf0', 'dark')).toBe('#8d7cf0')
  })
})

describe('环境光强度', () => {
  it('夹进 0 到 1 并落盘', () => {
    setAmbientLevel(1.7)
    expect(getAmbientLevel()).toBe(1)
    setAmbientLevel(-0.4)
    expect(getAmbientLevel()).toBe(0)
    setAmbientLevel(AMBIENT_DEFAULT)
    expect(localStorage.getItem(AMBIENT_STORAGE_KEY)).toBe(String(AMBIENT_DEFAULT))
  })
})
