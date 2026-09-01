import { describe, expect, it } from 'vitest'

import { CURATED_FONTS, getCuratedByFamily, getCuratedById } from '@/fonts/curated'
import { cjkOfSubsets } from '@/fonts/catalog'
import { familyToFontsourceId } from '@/fonts/google'

/** 2026-08-29 从 api.fontsource.org 核对：Google Fonts 上带 chinese-* subset 的全部字体。 */
const CHINESE_IDS = [
  'bpmf-huninn',
  'bpmf-iansui',
  'bpmf-zihi-kai-std',
  'cactus-classical-serif',
  'chiron-goround-tc',
  'chiron-hei-hk',
  'chiron-sung-hk',
  'chocolate-classical-sans',
  'huninn',
  'iansui',
  'liu-jian-mao-cao',
  'long-cang',
  'lxgw-marker-gothic',
  'lxgw-wenkai-mono-tc',
  'lxgw-wenkai-tc',
  'ma-shan-zheng',
  'noto-sans-hk',
  'noto-sans-sc',
  'noto-sans-tc',
  'noto-serif-hk',
  'noto-serif-sc',
  'noto-serif-tc',
  'uoqmunthenkhung',
  'wdxl-lubrifont-sc',
  'wdxl-lubrifont-tc',
  'zcool-kuaile',
  'zcool-qingke-huangyou',
  'zcool-xiaowei',
  'zhi-mang-xing',
]

describe('CURATED_FONTS', () => {
  it('收录全部中文字体', () => {
    const ids = new Set(CURATED_FONTS.map((f) => f.id))
    expect([...CHINESE_IDS].filter((id) => !ids.has(id))).toEqual([])
  })

  it('覆盖日韩与拉丁展示字体', () => {
    const byCjk = (script: string) => CURATED_FONTS.filter((f) => f.cjk === script).length
    expect(byCjk('jp')).toBeGreaterThanOrEqual(5)
    expect(byCjk('kr')).toBeGreaterThanOrEqual(4)
    expect(CURATED_FONTS.filter((f) => !f.cjk).length).toBeGreaterThanOrEqual(20)
  })

  it('id 唯一且与 family 派生结果一致', () => {
    const ids = CURATED_FONTS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of CURATED_FONTS) {
      expect(familyToFontsourceId(f.family)).toBe(f.id)
    }
  })

  it('weights 非空、升序、落在 100..1000', () => {
    for (const f of CURATED_FONTS) {
      expect(f.weights.length).toBeGreaterThan(0)
      expect([...f.weights].sort((a, b) => a - b)).toEqual(f.weights)
      for (const w of f.weights) {
        expect(w).toBeGreaterThanOrEqual(100)
        expect(w).toBeLessThanOrEqual(1000)
      }
    }
  })

  it('除无 npm 包的字体外，镜像版本固定为具体 semver', () => {
    const withVersion = CURATED_FONTS.filter((f) => f.version !== undefined)
    expect(withVersion.length).toBe(CURATED_FONTS.length - 1)
    for (const f of withVersion) expect(f.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('cjk 标记与 subsets 自洽', () => {
    for (const f of CURATED_FONTS) {
      expect(f.cjk).toBe(cjkOfSubsets(f.subsets))
    }
  })
})

describe('查表', () => {
  it('按 id 与 family 都能取到，family 忽略大小写与首尾空格', () => {
    expect(getCuratedById('noto-sans-sc')?.family).toBe('Noto Sans SC')
    expect(getCuratedByFamily('  noto sans sc  ')?.id).toBe('noto-sans-sc')
    expect(getCuratedByFamily('Nonexistent Font')).toBeUndefined()
  })
})
