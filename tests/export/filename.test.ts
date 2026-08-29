import { buildFilename } from '@/export/filename'
import { normalizeConfig } from '@/state/config'
import { describe, expect, it } from 'vitest'

function configOf(text: string, width = 1024, height = 1024) {
  return normalizeConfig({ text, canvas: { width, height } })
}

describe('buildFilename', () => {
  it('中文文字直接进文件名并带上尺寸', () => {
    expect(buildFilename(configOf('猪猪家族'), 'jpg')).toBe('猪猪家族_1024x1024.jpg')
  })

  it('尺寸取自画布配置', () => {
    expect(buildFilename(configOf('AI', 1080, 1920), 'png')).toBe('AI_1080x1920.png')
  })

  it('只取前 12 个字符', () => {
    const name = buildFilename(configOf('一二三四五六七八九十十一十二十三'), 'png')
    expect(name).toBe('一二三四五六七八九十十一_1024x1024.png')
  })

  it('去掉路径分隔符等非法字符与空白', () => {
    expect(buildFilename(configOf('产品/设计:部 A\n B'), 'jpg')).toBe('产品设计部AB_1024x1024.jpg')
  })

  it('先清洗再数 12 个字，空白不占名额', () => {
    // “AI 研究院 2026 年度”含 3 个空格，共 14 个码点；先截断的话只剩 AI研究院2026
    expect(buildFilename(configOf('AI 研究院 2026 年度'), 'jpg')).toBe(
      'AI研究院2026年度_1024x1024.jpg',
    )
  })

  it('前 12 个码点全是空白或非法字符时不退化成 avatar', () => {
    expect(buildFilename(configOf('/ / / / / / 猪猪家族'), 'png')).toBe('猪猪家族_1024x1024.png')
  })

  it('文字为空回落到 avatar', () => {
    expect(buildFilename(configOf(''), 'webp')).toBe('avatar_1024x1024.webp')
  })

  it('文字全是非法字符时也回落到 avatar', () => {
    expect(buildFilename(configOf('  ///  '), 'jpg')).toBe('avatar_1024x1024.jpg')
  })

  it('首尾的点被去掉', () => {
    expect(buildFilename(configOf('..hidden..'), 'png')).toBe('hidden_1024x1024.png')
  })

  it('扩展名允许带点与大写', () => {
    expect(buildFilename(configOf('AI'), '.JPG')).toBe('AI_1024x1024.jpg')
  })

  it('emoji 不会被劈成半个代理对', () => {
    expect(buildFilename(configOf('🐷🐷'), 'png')).toBe('🐷🐷_1024x1024.png')
  })
})
