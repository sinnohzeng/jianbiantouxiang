import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FontUploadError,
  MAX_UPLOADED_FONTS,
  MAX_UPLOAD_BYTES,
  clearUploadedFonts,
  getUploadedFont,
  listUploadedFonts,
  registerUploadedFont,
  removeUploadedFont,
  uploadFamilyName,
} from '@/fonts/upload'

class FakeFontFace {
  family: string
  source: unknown
  loaded = false

  constructor(family: string, source: unknown) {
    this.family = family
    this.source = source
  }

  load(): Promise<this> {
    this.loaded = true
    return Promise.resolve(this)
  }
}

let added: unknown[]
let removed: unknown[]

function installFontEnv(): void {
  added = []
  removed = []
  vi.stubGlobal('FontFace', FakeFontFace)
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      add: (f: unknown) => added.push(f),
      delete: (f: unknown) => removed.push(f),
    },
  })
}

function fontFile(name: string, bytes = 1024): File {
  const file = new File([new Uint8Array(8)], name, { type: 'font/woff2' })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

beforeEach(() => {
  installFontEnv()
})

afterEach(() => {
  clearUploadedFonts()
  vi.unstubAllGlobals()
})

describe('uploadFamilyName', () => {
  it.each([
    ['MyFont.ttf', 'MyFont-upload'],
    ['思源黑体.woff2', '思源黑体-upload'],
    ['a "quoted", name.otf', 'a quoted name-upload'],
    ['noext', 'noext-upload'],
  ])('%s -> %s', (name, family) => {
    expect(uploadFamilyName(name)).toBe(family)
  })
})

describe('registerUploadedFont 校验', () => {
  it.each(['ttf', 'otf', 'woff', 'woff2'])('接受 .%s', async (ext) => {
    await expect(registerUploadedFont(fontFile(`Sample.${ext}`))).resolves.toEqual({
      family: 'Sample-upload',
    })
  })

  it.each(['Sample.png', 'Sample.ttc', 'Sample'])('拒绝 %s', async (name) => {
    await expect(registerUploadedFont(fontFile(name))).rejects.toMatchObject({
      code: 'unsupported-extension',
    })
  })

  it('扩展名大小写不敏感', async () => {
    await expect(registerUploadedFont(fontFile('Sample.WOFF2'))).resolves.toEqual({
      family: 'Sample-upload',
    })
  })

  it('超过 30 MB 拒绝', async () => {
    await expect(
      registerUploadedFont(fontFile('Big.woff2', MAX_UPLOAD_BYTES + 1)),
    ).rejects.toBeInstanceOf(FontUploadError)
    await expect(
      registerUploadedFont(fontFile('Edge.woff2', MAX_UPLOAD_BYTES)),
    ).resolves.toBeTruthy()
  })

  it('没有 FontFace 的环境抛 unsupported-environment', async () => {
    vi.stubGlobal('FontFace', undefined)
    await expect(registerUploadedFont(fontFile('Sample.ttf'))).rejects.toMatchObject({
      code: 'unsupported-environment',
    })
  })

  it('解码失败抛 decode-failed', async () => {
    vi.stubGlobal(
      'FontFace',
      class {
        load(): Promise<never> {
          return Promise.reject(new Error('bad table'))
        }
      },
    )
    await expect(registerUploadedFont(fontFile('Broken.ttf'))).rejects.toMatchObject({
      code: 'decode-failed',
    })
  })
})

describe('注册表', () => {
  it('注册后可按 family 查到并进了 document.fonts', async () => {
    const { family } = await registerUploadedFont(fontFile('Sample.ttf', 2048))
    expect(getUploadedFont(family)).toMatchObject({ family, fileName: 'Sample.ttf', bytes: 2048 })
    expect(added).toHaveLength(1)
    expect(listUploadedFonts()).toHaveLength(1)
  })

  it('同名重传覆盖旧的 FontFace', async () => {
    await registerUploadedFont(fontFile('Sample.ttf', 1))
    await registerUploadedFont(fontFile('Sample.ttf', 2))
    expect(removed).toHaveLength(1)
    expect(listUploadedFonts()).toHaveLength(1)
    expect(getUploadedFont('Sample-upload')?.bytes).toBe(2)
  })

  it('clearUploadedFonts 清空并摘除', async () => {
    await registerUploadedFont(fontFile('Sample.ttf'))
    clearUploadedFonts()
    expect(listUploadedFonts()).toHaveLength(0)
    expect(removed).toHaveLength(1)
  })

  it('removeUploadedFont 摘除单个，未命中返回 false', async () => {
    const { family } = await registerUploadedFont(fontFile('Sample.ttf'))
    expect(removeUploadedFont(family)).toBe(true)
    expect(getUploadedFont(family)).toBeUndefined()
    expect(removed).toHaveLength(1)
    expect(removeUploadedFont(family)).toBe(false)
    expect(removeUploadedFont('Ghost-upload')).toBe(false)
    expect(removed).toHaveLength(1)
  })
})

describe('注册表上限', () => {
  it('常驻上限为 3', () => {
    expect(MAX_UPLOADED_FONTS).toBe(3)
  })

  it('超出上限时淘汰最久未用的一份并从 document.fonts 摘除', async () => {
    for (const name of ['A.ttf', 'B.ttf', 'C.ttf']) {
      await registerUploadedFont(fontFile(name))
    }
    expect(listUploadedFonts()).toHaveLength(MAX_UPLOADED_FONTS)
    expect(removed).toHaveLength(0)

    await registerUploadedFont(fontFile('D.ttf'))
    expect(listUploadedFonts().map((f) => f.family)).toEqual(['B-upload', 'C-upload', 'D-upload'])
    expect(getUploadedFont('A-upload')).toBeUndefined()
    expect(removed).toHaveLength(1)
  })

  it('取用过的一份不算最久未用', async () => {
    for (const name of ['A.ttf', 'B.ttf', 'C.ttf']) {
      await registerUploadedFont(fontFile(name))
    }
    expect(getUploadedFont('A-upload')).toBeTruthy()

    await registerUploadedFont(fontFile('D.ttf'))
    expect(listUploadedFonts().map((f) => f.family)).toEqual(['C-upload', 'A-upload', 'D-upload'])
  })

  it('同名重传不触发淘汰', async () => {
    for (const name of ['A.ttf', 'B.ttf', 'C.ttf']) {
      await registerUploadedFont(fontFile(name))
    }
    await registerUploadedFont(fontFile('C.ttf', 4096))
    expect(listUploadedFonts().map((f) => f.family)).toEqual(['A-upload', 'B-upload', 'C-upload'])
    // 只摘掉被覆盖的那份旧 face
    expect(removed).toHaveLength(1)
    expect(getUploadedFont('C-upload')?.bytes).toBe(4096)
  })
})
