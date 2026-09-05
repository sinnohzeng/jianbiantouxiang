/**
 * 品牌 SVG 落盘前的类规则内联。
 *
 * 运行时的 `sanitizeSvg` 不放行 `<style>` 元素，填色写在类规则里的文件必须在生成期就内联，
 * 否则画出来是纯黑。这里盯的就是那一步。
 */

import { describe, expect, it } from 'vitest'
import { classRules, inlineClassStyles } from '../../build/brand-svg'

describe('类规则内联', () => {
  it('类规则并进元素的 style，style 元素与 class 属性一并删掉', () => {
    const out = inlineClassStyles(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#123}</style><path class="a" d="M0 0h1v1z"/></svg>',
    )

    expect(out).toContain('style="fill:#123"')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('class=')
  })

  it('元素自带的声明排在后面，同名属性它赢', () => {
    const out = inlineClassStyles(
      '<svg><style>.a{fill:#123;stroke:#000}</style><path class="a" style="fill:#456"/></svg>',
    )
    expect(out).toContain('style="fill:#123;stroke:#000;fill:#456"')
  })

  it('多类名按顺序合并，逗号选择器摊到每个类', () => {
    const out = inlineClassStyles(
      '<svg><style>.a,.b{fill:#123}.c{stroke-width:0px}</style><path class="a c"/></svg>',
    )
    expect(out).toContain('style="fill:#123;stroke-width:0px"')
  })

  it('CDATA 包着的样式表照样认', () => {
    const out = inlineClassStyles(
      '<svg><style type="text/css"><![CDATA[ .fil5 {fill:#0179FF} ]]></style><path class="fil5"/></svg>',
    )
    expect(out).toContain('style="fill:#0179FF"')
  })

  it('没有 style 元素的文件原样返回', () => {
    const source = '<svg><path class="a" fill="#123"/></svg>'
    expect(inlineClassStyles(source)).toBe(source)
  })

  it('类名以外的选择器整条丢掉，不猜它作用在谁身上', () => {
    expect(classRules('path{fill:#123}#id{fill:#456}.a{fill:#789}')).toEqual(
      new Map([['a', 'fill:#789']]),
    )
  })
})
