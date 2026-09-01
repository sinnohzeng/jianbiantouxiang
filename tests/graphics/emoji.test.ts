import { describe, expect, it } from 'vitest'
import { emojiFileName, emojiUrl } from '@/graphics/emoji'

describe('Noto Emoji 文件名', () => {
  it('单个码点转成小写文件名', () => {
    expect(emojiFileName('1F334')).toBe('emoji_u1f334.svg')
  })

  it('变体选择符 FE0F 与 FE0E 都去掉', () => {
    expect(emojiFileName('2764-FE0F')).toBe('emoji_u2764.svg')
    expect(emojiFileName('263A-FE0E')).toBe('emoji_u263a.svg')
  })

  it('ZWJ 序列保留下划线连接', () => {
    expect(emojiFileName('1F469-200D-1F4BB')).toBe('emoji_u1f469_200d_1f4bb.svg')
  })

  it('非法码点返回 null，不拼出攻击性 URL', () => {
    expect(emojiFileName('../secret')).toBeNull()
    expect(emojiFileName('1f334/../../secret')).toBeNull()
    expect(emojiFileName('')).toBeNull()
    expect(emojiFileName('fe0f')).toBeNull()
  })

  it('URL 固定 Noto Emoji v2.047', () => {
    expect(emojiUrl('1F334')).toBe(
      'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u1f334.svg',
    )
  })
})
