import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GraphicUploadError,
  sanitizeSvg,
  registerUploadedGraphic,
  clearUploadedGraphics,
  getUploadedGraphic,
} from '@/graphics/upload'

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

  it.each(['0 0 727 87', '-10 -20 727 87'])('缺少尺寸时由 viewBox %s 固定固有宽高', (viewBox) => {
    const clean = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="M0 0h10v10H0z"/></svg>`,
    )
    const root = new DOMParser().parseFromString(clean, 'image/svg+xml').documentElement
    expect(root.getAttribute('width')).toBe('727')
    expect(root.getAttribute('height')).toBe('87')
    expect(root.getAttribute('viewBox')).toBe(viewBox)
  })

  it('从大 viewBox 推导固有尺寸时有界缩放，矢量坐标保持', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6000 3000"><path d="M0 0h10v10H0z"/></svg>',
    )
    const root = new DOMParser().parseFromString(clean, 'image/svg+xml').documentElement
    expect(root.getAttribute('width')).toBe('2048')
    expect(root.getAttribute('height')).toBe('1024')
    expect(root.getAttribute('viewBox')).toBe('0 0 6000 3000')
  })

  it('保留素材声明的固有尺寸，不改写 viewport 与 viewBox 的映射', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1454" height="174" viewBox="0 0 727 87"><path d="M0 0h10v10H0z"/></svg>',
    )
    const root = new DOMParser().parseFromString(clean, 'image/svg+xml').documentElement
    expect(root.getAttribute('width')).toBe('1454')
    expect(root.getAttribute('height')).toBe('174')
  })

  it('百分比宽高按 viewBox 换成固有尺寸，裁边绘制与整图绘制同一坐标系', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1080 1080"><path d="M0 0h10v10H0z"/></svg>',
    )
    const root = new DOMParser().parseFromString(clean, 'image/svg+xml').documentElement
    expect(root.getAttribute('width')).toBe('1080')
    expect(root.getAttribute('height')).toBe('1080')
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

describe('style 属性按声明过一层', () => {
  it('上色类声明留下，原色不丢', () => {
    const clean = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <path d="M0 0h10v10h-10z" style="stroke:none;fill-rule:nonzero;fill:#133c9a;fill-opacity:1"/>
      </svg>`,
    )
    expect(clean).toContain('fill:#133c9a')
    expect(clean).toContain('fill-rule:nonzero')
  })

  it('外部 url 与表外属性一并丢掉', () => {
    const clean = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <path d="M0 0h10v10h-10z" style="fill:url(http://evil.example/x);behavior:url(#default#VML);stroke:#fff"/>
      </svg>`,
    )
    expect(clean).not.toContain('evil.example')
    expect(clean).not.toContain('behavior')
    expect(clean).toContain('stroke:#fff')
  })

  it('一条都留不下时不写空的 style 属性', () => {
    const clean = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <path d="M0 0h10v10h-10z" style="behavior:url(#x);position:absolute"/>
      </svg>`,
    )
    expect(clean).not.toContain('style=')
  })

  it('简单上色类先转属性，再删除 style 元素', () => {
    const clean = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <defs><style>.a{fill:#123456}</style></defs>
        <path class="a" d="M0 0h10v10h-10z"/>
      </svg>`,
    )
    expect(clean).not.toContain('<style')
    expect(clean).toContain('fill="#123456"')
  })

  it('内部 url 引用的渐变填色留下', () => {
    const clean = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <path d="M0 0h10v10h-10z" style="fill:url(#g)"/>
      </svg>`,
    )
    expect(clean).toContain('fill:url(#g)')
  })
})

it.each(['linearGradient', 'radialGradient'])('保留 %s 的 stop 及内部引用', (tag) => {
  const clean = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><${tag} id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" style="stop-color:#0000ff;stop-opacity:0.8"/></${tag}></defs><rect width="10" height="10" fill="url(#g)"/></svg>`,
  )
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
  expect(doc.querySelectorAll(`${tag} > stop`)).toHaveLength(2)
  expect(doc.querySelector('rect')?.getAttribute('fill')).toBe('url(#g)')
  expect(clean).toContain('stop-color:#0000ff')
})

afterEach(() => {
  clearUploadedGraphics()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('像素超过上限时在透明边界扫描前拒绝，并释放 URL', async () => {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 10000
      naturalHeight = 10000
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: revoke })
  await expect(
    registerUploadedGraphic(new File(['x'], 'large.png', { type: 'image/png' })),
  ).rejects.toMatchObject({ code: 'resource-limit' })
  expect(revoke).toHaveBeenCalledWith('blob:test')
})

it('会话容量到上限时拒绝新素材，保留历史仍可引用的旧素材', async () => {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 1
      naturalHeight = 1
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
  } as unknown as CanvasRenderingContext2D)
  const file = new File(['x'], 'logo.png', { type: 'image/png' })
  const first = await registerUploadedGraphic(file)
  for (let i = 1; i < 24; i++) await registerUploadedGraphic(file)
  await expect(registerUploadedGraphic(file)).rejects.toMatchObject({ code: 'resource-limit' })
  expect(getUploadedGraphic(first.id)).not.toBeNull()
})
