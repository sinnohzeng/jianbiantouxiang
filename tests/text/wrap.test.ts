import { describe, expect, it } from 'vitest'
import { splitParagraphs, toAtoms, wrapLine } from '@/text/wrap'
import { createStubMeasure } from './helpers'

const measure = createStubMeasure()
const FONT = '400 100px "X"'

function wrap(line: string, maxWidth: number, spacing = 0) {
  return wrapLine(line, maxWidth, measure, FONT, spacing)
}

describe('splitParagraphs', () => {
  it('按显式换行切段，兼容三种换行符', () => {
    expect(splitParagraphs('猪猪\n家族')).toEqual(['猪猪', '家族'])
    expect(splitParagraphs('猪猪\r\n家族')).toEqual(['猪猪', '家族'])
    expect(splitParagraphs('猪猪\r家族')).toEqual(['猪猪', '家族'])
  })

  it('去掉首尾空行，保留中间空行', () => {
    expect(splitParagraphs('\n\n猪\n\n族\n\n')).toEqual(['猪', '', '族'])
  })

  it('空文本返回空数组', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs('   \n  ')).toEqual([])
  })

  it('段内两端空白去掉', () => {
    expect(splitParagraphs('  猪猪家族  ')).toEqual(['猪猪家族'])
  })
})

describe('toAtoms', () => {
  it('东亚字符逐字，连续拉丁保持整块', () => {
    expect(toAtoms('中文abc')).toEqual(['中', '文', 'abc'])
  })
})

describe('wrapLine 拉丁按词', () => {
  it('不把单词从中间切开', () => {
    expect(wrap('hello world', 400)).toEqual(['hello', 'world'])
    expect(wrap('gradient avatar', 600)).toEqual(['gradient', 'avatar'])
  })

  it('放得下就不换行', () => {
    expect(wrap('hello world', 1000)).toEqual(['hello world'])
  })

  it('单词本身超宽时按字素拆开', () => {
    const lines = wrap('Supercalifragilistic', 300)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(measure(line, FONT, 0).width).toBeLessThanOrEqual(300)
    }
    expect(lines.join('')).toBe('Supercalifragilistic')
  })
})

describe('wrapLine 东亚逐字', () => {
  it('按安全区宽度逐字断行', () => {
    expect(wrap('中文换行测试', 250)).toEqual(['中文', '换行', '测试'])
  })

  it('字距计入行宽', () => {
    expect(wrap('中文换行测试', 250, 60)).toEqual(['中', '文', '换', '行', '测', '试'])
  })
})

describe('wrapLine 避头尾', () => {
  it('行首标点回收到上一行', () => {
    const lines = wrap('你好，世界', 250)
    expect(lines[0]).toBe('你好，')
    for (const line of lines.slice(1)) {
      expect('，。、；：？！'.includes(line.slice(0, 1))).toBe(false)
    }
  })

  it('行尾的开括号压到下一行', () => {
    const lines = wrap('猪猪（家族）', 300)
    for (const line of lines) {
      expect('（【《「'.includes(line.slice(-1))).toBe(false)
    }
  })
})

describe('wrapLine 边界', () => {
  it('空行原样返回', () => {
    expect(wrap('', 300)).toEqual([''])
  })

  it('宽度非法时不进入换行循环', () => {
    expect(wrap('猪猪家族', 0)).toEqual(['猪猪家族'])
    expect(wrap('猪猪家族', Number.POSITIVE_INFINITY)).toEqual(['猪猪家族'])
  })
})
