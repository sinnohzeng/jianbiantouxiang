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
