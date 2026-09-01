import { describe, expect, it } from 'vitest'

import {
  MIRROR_HOSTS,
  buildCss2Url,
  buildMirrorCssUrls,
  buildMirrorCssUrlsForHost,
  familyToFontsourceId,
} from '@/fonts/google'

describe('buildCss2Url', () => {
  it('空格转 +，字重升序去重', () => {
    expect(buildCss2Url('Noto Sans SC', [700, 400, 700])).toBe(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
    )
  })

  it('单字重字体只带一个 wght', () => {
    expect(buildCss2Url('ZCOOL KuaiLe', [400])).toBe(
      'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe:wght@400&display=swap',
    )
  })

  it('不带 text 参数，CJK 靠 unicode-range 切片', () => {
    expect(buildCss2Url('Noto Sans SC', [400])).not.toContain('text=')
  })

  it('非法字重被丢弃，全非法时回落 400', () => {
    expect(buildCss2Url('Inter', [0, 1200, Number.NaN])).toContain(':wght@400')
    expect(buildCss2Url('Inter', [])).toContain(':wght@400')
  })

  it('家族名里的特殊字符按 URL 编码', () => {
    expect(buildCss2Url('Foo & Bar', [400])).toContain('family=Foo+%26+Bar:wght@400')
  })
})

describe('familyToFontsourceId', () => {
  it.each([
    ['Noto Sans SC', 'noto-sans-sc'],
    ['ZCOOL QingKe HuangYou', 'zcool-qingke-huangyou'],
    ['M PLUS Rounded 1c', 'm-plus-rounded-1c'],
    ['DM Serif Display', 'dm-serif-display'],
    ['  Ma Shan Zheng  ', 'ma-shan-zheng'],
  ])('%s -> %s', (family, id) => {
    expect(familyToFontsourceId(family)).toBe(id)
  })
})

describe('buildMirrorCssUrls', () => {
  it('走 npm 包路径，每个字重一条', () => {
    expect(
      buildMirrorCssUrlsForHost('cdn.jsdelivr.net', 'noto-sans-sc', [400, 700], '5.3.0'),
    ).toEqual([
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.0/400.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.3.0/700.css',
    ])

    expect(buildMirrorCssUrlsForHost('cdn.jsdelivr.net', 'unknown', [400])).toEqual([
      'https://cdn.jsdelivr.net/npm/@fontsource/unknown@latest/400.css',
    ])
  })

  it('两个主机按优先级铺平，cdn 在前 gcore 在后', () => {
    expect(MIRROR_HOSTS).toEqual(['cdn.jsdelivr.net', 'gcore.jsdelivr.net'])
    expect(buildMirrorCssUrls('zcool-kuaile', [400], '5.3.0')).toEqual([
      'https://cdn.jsdelivr.net/npm/@fontsource/zcool-kuaile@5.3.0/400.css',
      'https://gcore.jsdelivr.net/npm/@fontsource/zcool-kuaile@5.3.0/400.css',
    ])
  })
})
