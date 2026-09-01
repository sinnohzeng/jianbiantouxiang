import { buildFilename } from '@/export/filename'
import { normalizeConfig } from '@/state/config'
import { describe, expect, it } from 'vitest'

/** 固定时刻：2026-09-01 15:30:12（设备本地时区口径）。 */
const NOW = new Date(2026, 8, 1, 15, 30, 12)

function configOf(text: string, width = 1024, height = 1024) {
  return normalizeConfig({ text, canvas: { width, height } })
}

describe('buildFilename', () => {
  it('中文文字直接进文件名，带尺寸与秒级时间戳', () => {
    expect(buildFilename(configOf('猪猪家族'), 'jpg', NOW)).toBe(
      '猪猪家族_1024x1024_20260901-153012.jpg',
    )
  })

  it('尺寸取自画布配置', () => {
    expect(buildFilename(configOf('AI', 1080, 1920), 'png', NOW)).toBe(
      'AI_1080x1920_20260901-153012.png',
    )
  })

  it('只取前 12 个字符', () => {
    const name = buildFilename(configOf('一二三四五六七八九十十一十二十三'), 'png', NOW)
    expect(name).toBe('一二三四五六七八九十十一_1024x1024_20260901-153012.png')
  })

  it('去掉路径分隔符等非法字符与空白', () => {
    expect(buildFilename(configOf('产品/设计:部 A\n B'), 'jpg', NOW)).toBe(
      '产品设计部AB_1024x1024_20260901-153012.jpg',
    )
  })

  it('先清洗再数 12 个字，空白不占名额', () => {
    // “AI 研究院 2026 年度”含 3 个空格，共 14 个码点；先截断的话只剩 AI研究院2026
    expect(buildFilename(configOf('AI 研究院 2026 年度'), 'jpg', NOW)).toBe(
      'AI研究院2026年度_1024x1024_20260901-153012.jpg',
    )
  })

  it('前 12 个码点全是空白或非法字符时不退化成 avatar', () => {
    expect(buildFilename(configOf('/ / / / / / 猪猪家族'), 'png', NOW)).toBe(
      '猪猪家族_1024x1024_20260901-153012.png',
    )
  })

  it('文字为空回落到 avatar', () => {
    expect(buildFilename(configOf(''), 'webp', NOW)).toBe(
      'avatar_1024x1024_20260901-153012.webp',
    )
  })

  it('文字全是非法字符时也回落到 avatar', () => {
    expect(buildFilename(configOf('  ///  '), 'jpg', NOW)).toBe(
      'avatar_1024x1024_20260901-153012.jpg',
    )
  })

  it('首尾的点被去掉', () => {
    expect(buildFilename(configOf('..hidden..'), 'png', NOW)).toBe(
      'hidden_1024x1024_20260901-153012.png',
    )
  })

  it('扩展名允许带点与大写', () => {
    expect(buildFilename(configOf('AI'), '.JPG', NOW)).toBe('AI_1024x1024_20260901-153012.jpg')
  })

  it('emoji 不会被劈成半个代理对', () => {
    expect(buildFilename(configOf('🐷🐷'), 'png', NOW)).toBe('🐷🐷_1024x1024_20260901-153012.png')
  })

  it('时间戳取设备本地时区，单个数位补零', () => {
    const morning = new Date(2026, 0, 5, 8, 5, 9)
    expect(buildFilename(configOf('AI'), 'png', morning)).toBe('AI_1024x1024_20260105-080509.png')
  })

  it('相邻两秒导出的文件名不重复', () => {
    const first = buildFilename(configOf('猪猪家族'), 'jpg', NOW)
    const second = buildFilename(configOf('猪猪家族'), 'jpg', new Date(NOW.getTime() + 1000))
    expect(first).not.toBe(second)
  })
})
