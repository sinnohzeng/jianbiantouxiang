import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, normalizeConfig, type AvatarConfig } from '@/state/config'
import {
  buildShareUrl,
  decodeConfigFromHash,
  encodeConfigToHash,
  hasBrokenConfigHash,
} from '@/state/url'

/** 把 hash 还原成载荷对象，用来断言“默认值不进链接”。 */
function payloadOf(hash: string): Record<string, unknown> {
  const encoded = hash.slice('#c='.length).replace(/-/g, '+').replace(/_/g, '/')
  const remainder = encoded.length % 4
  const binary = atob(remainder === 0 ? encoded : encoded + '='.repeat(4 - remainder))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

function encodePayload(payload: unknown): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)))
  return `#c=${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

describe('encodeConfigToHash', () => {
  it('带 #c= 前缀且是 base64url 字符集', () => {
    const hash = encodeConfigToHash(DEFAULT_CONFIG)
    expect(hash.startsWith('#c=')).toBe(true)
    expect(hash.slice(3)).toMatch(/^[A-Za-z0-9_-]*$/)
  })

  it('默认配置的载荷是空对象', () => {
    expect(payloadOf(encodeConfigToHash(DEFAULT_CONFIG))).toEqual({})
  })

  it('只写与默认不同的字段，嵌套层同样只留差异', () => {
    const config: AvatarConfig = {
      ...DEFAULT_CONFIG,
      text: '产品设计部',
      typography: { ...DEFAULT_CONFIG.typography, fontSize: 0.6 },
    }
    expect(payloadOf(encodeConfigToHash(config))).toEqual({
      text: '产品设计部',
      typography: { fontSize: 0.6 },
    })
  })

  it('数组整体替换而不是逐项 diff', () => {
    const config: AvatarConfig = {
      ...DEFAULT_CONFIG,
      palette: 'custom',
      customColors: ['#112233', '#445566'],
    }
    expect(payloadOf(encodeConfigToHash(config))).toEqual({
      palette: 'custom',
      customColors: ['#112233', '#445566'],
    })
  })
})

describe('编解码往返', () => {
  it('默认配置往返后不变', () => {
    expect(decodeConfigFromHash(encodeConfigToHash(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG)
  })

  it('改满各层字段后往返仍逐字节相同', () => {
    const config: AvatarConfig = {
      ...DEFAULT_CONFIG,
      text: '钱猪宝 🐷 Zixuan',
      seed: 'abc123',
      style: 'silk',
      styleParams: { intensity: 0.8, softness: 0.2, grain: 0.4, scale: 1.5, rotation: 240 },
      highlight: 0.9,
      palette: 'custom',
      customColors: ['#ff0055', '#00ffaa'],
      canvas: { width: 2048, height: 1024, shape: 'circle', radius: 0.35 },
      typography: {
        ...DEFAULT_CONFIG.typography,
        fontFamily: 'LXGW WenKai',
        vertical: true,
        effect: 'glow',
        pill: { radius: 0.4, padding: 0.5, opacity: 0.8 },
      },
      exportOptions: { format: 'png', sizeTarget: 'none', bgColor: '#101010' },
    }
    expect(decodeConfigFromHash(encodeConfigToHash(config))).toEqual(config)
  })

  it('接受不带 # 的形态与多参数 hash', () => {
    const hash = encodeConfigToHash({ ...DEFAULT_CONFIG, text: '同事' })
    expect(decodeConfigFromHash(hash.slice(1))?.text).toBe('同事')
    expect(decodeConfigFromHash(`${hash}&lang=en`)?.text).toBe('同事')
  })

  it('buildShareUrl 用给定前缀拼完整链接', () => {
    const config = { ...DEFAULT_CONFIG, text: '产品设计部' }
    expect(buildShareUrl(config, 'https://example.com/')).toBe(
      `https://example.com/${encodeConfigToHash(config)}`,
    )
  })
})

describe('decodeConfigFromHash 容错', () => {
  it.each([
    ['空串', ''],
    ['只有井号', '#'],
    ['缺 c= 前缀', '#eyJ0ZXh0IjoiYSJ9'],
    ['前缀拼错', '#config=eyJ0ZXh0IjoiYSJ9'],
    ['载荷为空', '#c='],
    ['base64 字符集非法', '#c=@@@@'],
    ['base64 能解但不是 JSON', `#c=${btoa('not json').replace(/=+$/, '')}`],
  ])('%s 返回 null', (_name, hash) => {
    expect(decodeConfigFromHash(hash)).toBeNull()
  })

  it('载荷不是对象时返回 null', () => {
    expect(decodeConfigFromHash(encodePayload([1, 2, 3]))).toBeNull()
    expect(decodeConfigFromHash(encodePayload('文字'))).toBeNull()
    expect(decodeConfigFromHash(encodePayload(null))).toBeNull()
  })

  it('旧版本载荷返回 null', () => {
    expect(decodeConfigFromHash(encodePayload({ v: 2, text: '旧链接' }))).toBeNull()
    expect(decodeConfigFromHash(encodePayload({ v: 4, text: '未来链接' }))).toBeNull()
  })

  it('缺 v 视为当前版本', () => {
    expect(decodeConfigFromHash(encodePayload({ text: '短链接' }))?.text).toBe('短链接')
  })

  it('解出的载荷仍走 normalizeConfig 补默认与夹值', () => {
    const decoded = decodeConfigFromHash(
      encodePayload({ canvas: { width: 99999 }, highlight: '亮', typography: { fontSize: -1 } }),
    )
    expect(decoded).toEqual(
      normalizeConfig({ canvas: { width: 99999 }, highlight: '亮', typography: { fontSize: -1 } }),
    )
    expect(decoded?.canvas.width).toBe(8192)
    expect(decoded?.highlight).toBe(DEFAULT_CONFIG.highlight)
    expect(decoded?.typography.fontSize).toBe(0.04)
  })
})

describe('hasBrokenConfigHash', () => {
  it('载荷在传输中被截断时算坏链接', () => {
    const hash = encodeConfigToHash({ ...DEFAULT_CONFIG, text: '同事' })
    expect(hasBrokenConfigHash(hash.slice(0, hash.length - 8))).toBe(true)
  })

  it('版本对不上的链接也算坏链接', () => {
    expect(hasBrokenConfigHash(encodePayload({ v: 2, text: '旧链接' }))).toBe(true)
  })

  it('没有配置参数只是普通锚点，不算坏', () => {
    expect(hasBrokenConfigHash('')).toBe(false)
    expect(hasBrokenConfigHash('#readme')).toBe(false)
    expect(hasBrokenConfigHash('#lang=en')).toBe(false)
  })

  it('读得出来的链接不算坏', () => {
    expect(hasBrokenConfigHash(encodeConfigToHash(DEFAULT_CONFIG))).toBe(false)
  })
})
