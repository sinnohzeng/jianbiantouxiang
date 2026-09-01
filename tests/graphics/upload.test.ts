import { describe, expect, it } from 'vitest'
import { GraphicUploadError, sanitizeSvg } from '@/graphics/upload'

const DIRTY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)">
  <script>alert('xss')</script>
  <foreignObject width="20" height="20"><iframe src="https://evil.example"></iframe></foreignObject>
  <path d="M10 10h80v80h-80z" fill="url(https://evil.example/fill)"/>
  <circle cx="50" cy="50" r="20" fill="#3366ff" data-x="drop"/>
  <image href="https://evil.example/logo.png" x="0" y="0" width="10" height="10"/>
</svg>`

describe('上传 SVG 白名单消毒', () => {
  it('剥掉脚本、foreignObject、事件属性、未知元素与外部引用', () => {
    const clean = sanitizeSvg(DIRTY)

    expect(clean).not.toContain('script')
    expect(clean).not.toContain('foreignObject')
    expect(clean).not.toContain('iframe')
    expect(clean).not.toContain('image')
    expect(clean).not.toContain('onload')
    expect(clean).not.toContain('evil.example')
    expect(clean).toContain('M10 10h80v80h-80z')
    expect(clean).toContain('circle')
    expect(clean).toContain('#3366ff')
    expect(clean).not.toContain('url(https')
  })

  it('内部 url 引用保留，渐变与裁剪仍可用', () => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
      <defs><clipPath id="c"><rect width="5" height="5"/></clipPath></defs>
      <path d="M0 0h10v10h-10z" clip-path="url(#c)"/>
    </svg>`)
    expect(clean).toContain('clip-path="url(#c)"')
    expect(clean).toContain('clipPath')
  })

  it('没有安全绘图元素时拒绝，不猜出一个空图', () => {
    expect(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toThrow(
      GraphicUploadError,
    )
  })

  it('解析失败的 SVG 拒绝', () => {
    expect(() => sanitizeSvg('<svg><path')).toThrow(GraphicUploadError)
  })
})
