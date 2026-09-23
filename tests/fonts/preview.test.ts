import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FontEntry } from '@/fonts/catalog'
import { buildCss2TextUrl } from '@/fonts/google'
import {
  previewFamilyOf,
  requestPreview,
  resetPreviewState,
  subscribePreview,
} from '@/fonts/preview'

const KUAILE: FontEntry = { id: 'zcool-kuaile', family: 'ZCOOL KuaiLe', weights: [400], cjk: 'sc' }
/** 没有 400 的字体：子集请求取离 400 最近的一档。 */
const THIN: FontEntry = { id: 'thin-sans', family: 'Thin Sans', weights: [100, 300, 700] }

const SUBSET_URL = 'https://fonts.gstatic.com/l/font?kit=abc&skey=1'
const CSS = `@font-face {\n  font-family: 'ZCOOL KuaiLe';\n  src: url(${SUBSET_URL}) format('woff2');\n}\n`

let fetchSpy: ReturnType<typeof vi.fn>
let fontsAdd: ReturnType<typeof vi.fn>
let faces: { family: string; source: string }[]
let loadOutcome: 'resolve' | 'reject'

/** 等下一个预览结果出来。 */
function nextResult(): Promise<void> {
  return new Promise((resolve) => {
    const off = subscribePreview(() => {
      off()
      resolve()
    })
  })
}

beforeEach(() => {
  resetPreviewState()
  faces = []
  loadOutcome = 'resolve'
  fetchSpy = vi.fn(async () => new Response(CSS))
  fontsAdd = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  vi.stubGlobal(
    'FontFace',
    class {
      constructor(family: string, source: string) {
        faces.push({ family, source })
      }
      load() {
        return loadOutcome === 'resolve' ? Promise.resolve(this) : Promise.reject(new Error('bad'))
      }
    },
  )
  Object.defineProperty(document, 'fonts', { configurable: true, value: { add: fontsAdd } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetPreviewState()
})

describe('requestPreview', () => {
  it('按显示名请求 css2 子集，低优先级', async () => {
    const done = nextResult()
    requestPreview(KUAILE)
    await done
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(buildCss2TextUrl('ZCOOL KuaiLe', 400, '站酷快乐体'), {
      priority: 'low',
    })
  })

  it('字重取离 400 最近的一档', async () => {
    const done = nextResult()
    requestPreview(THIN)
    await done
    expect(fetchSpy).toHaveBeenCalledWith(buildCss2TextUrl('Thin Sans', 300, 'Thin Sans'), {
      priority: 'low',
    })
  })

  it('以 fp- 别名注册 src 里的子集，load 之后才 add，订阅者拿到别名', async () => {
    const listener = vi.fn()
    const off = subscribePreview(listener)
    const done = nextResult()
    requestPreview(KUAILE)
    expect(previewFamilyOf(KUAILE.id)).toBeNull()
    await done

    expect(faces).toEqual([{ family: 'fp-zcool-kuaile', source: `url("${SUBSET_URL}")` }])
    expect(faces[0]!.family).not.toBe(KUAILE.family)
    expect(fontsAdd).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(previewFamilyOf(KUAILE.id)).toBe('fp-zcool-kuaile')
    off()
  })

  it('同一款字体请求两次只 fetch 一次', async () => {
    const done = nextResult()
    requestPreview(KUAILE)
    requestPreview(KUAILE)
    await done
    requestPreview(KUAILE)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('requestPreview 失败', () => {
  async function expectFailedOnce(): Promise<void> {
    const done = nextResult()
    requestPreview(KUAILE)
    await done
    expect(previewFamilyOf(KUAILE.id)).toBeNull()
    requestPreview(KUAILE)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fontsAdd).not.toHaveBeenCalled()
  }

  it('fetch 失败记 null，不再请求', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('offline'))
    await expectFailedOnce()
  })

  it('CSS 里没有 url 记 null，不再请求', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('/* nothing */'))
    await expectFailedOnce()
    expect(faces).toEqual([])
  })

  it('FontFace.load 失败记 null，不再请求', async () => {
    loadOutcome = 'reject'
    await expectFailedOnce()
  })
})
