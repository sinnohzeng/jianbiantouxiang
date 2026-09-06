/**
 * 关于页的赞赏区。
 *
 * 两件事：`hasSupport()` 判空的三条分支；`src/about/main.ts` 按判空结果渲染的分支。
 * 空态尤其要守——一个入口都没配的时候整块不出现，页面上不留空壳。
 *
 * main.ts 是一段顶层就跑的脚本，所以每条用例先铺好 DOM，再 `vi.resetModules()` 重新 import 一次。
 * 赞赏配置用 `vi.doMock` 换掉，用例不依赖仓库里当前填了哪几个入口。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUPPORT_LINKS, SUPPORT_QRS, SUPPORT_TEXT, hasSupport } from '@/about/support'

type Links = typeof SUPPORT_LINKS
type Qrs = typeof SUPPORT_QRS
type Text = typeof SUPPORT_TEXT

const EMPTY_LINKS: Links = { afdian: '', buymeacoffee: '', githubSponsors: '' }
const EMPTY_QRS: Qrs = { wechat: '', alipay: '' }

const REAL_LINKS: Links = { ...SUPPORT_LINKS }
const REAL_QRS: Qrs = { ...SUPPORT_QRS }

/** 还原被用例改过的真实配置，模块级常量在同一个进程里是共享的。 */
function restoreConfig(): void {
  Object.assign(SUPPORT_LINKS, REAL_LINKS)
  Object.assign(SUPPORT_QRS, REAL_QRS)
}

describe('hasSupport 判空', () => {
  afterEach(restoreConfig)

  it('链接与收款码全空时是 false', () => {
    Object.assign(SUPPORT_LINKS, EMPTY_LINKS)
    Object.assign(SUPPORT_QRS, EMPTY_QRS)
    expect(hasSupport()).toBe(false)
  })

  it('只填了一个链接就是 true', () => {
    Object.assign(SUPPORT_LINKS, EMPTY_LINKS, { afdian: 'https://afdian.com/a/demo' })
    Object.assign(SUPPORT_QRS, EMPTY_QRS)
    expect(hasSupport()).toBe(true)
  })

  it('只填了一个收款码也是 true', () => {
    Object.assign(SUPPORT_LINKS, EMPTY_LINKS)
    Object.assign(SUPPORT_QRS, EMPTY_QRS, { alipay: '/support/alipay.png' })
    expect(hasSupport()).toBe(true)
  })

  it('仓库里当前的配置至少有一个入口', () => {
    expect(hasSupport()).toBe(true)
  })
})

interface AboutOptions {
  links?: Links
  qrs?: Qrs
  text?: Text
  /** 页面上有没有赞赏区那两个容器。关于页有，别的页面没有。 */
  section?: boolean
}

/** 铺好关于页里 main.ts 会碰的那几个节点，再跑一次它的顶层逻辑。 */
async function runAbout(options: AboutOptions = {}): Promise<void> {
  const links = options.links ?? EMPTY_LINKS
  const qrs = options.qrs ?? EMPTY_QRS
  const supported =
    Object.values(links).some((value) => value.length > 0) ||
    Object.values(qrs).some((value) => value.length > 0)

  document.body.innerHTML = `<span data-slot="app-version">-</span>${
    options.section === false
      ? ''
      : '<section data-slot="support" hidden><div data-slot="support-list"></div></section>'
  }`

  vi.resetModules()
  vi.doMock('@/about/support', () => ({
    SUPPORT_LINKS: links,
    SUPPORT_QRS: qrs,
    SUPPORT_TEXT: options.text ?? SUPPORT_TEXT,
    hasSupport: () => supported,
  }))
  await import('@/about/main')
}

function section(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-slot="support"]')!
}

function list(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-slot="support-list"]')!
}

describe('关于页脚本', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('@/about/support')
    document.body.innerHTML = ''
  })

  it('把构建期注入的版本号填进版本位', async () => {
    await runAbout()
    const slot = document.querySelector('[data-slot="app-version"]')
    expect(slot?.textContent).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('一个入口都没配时整块不渲染，section 保持 hidden', async () => {
    await runAbout()
    expect(section().hidden).toBe(true)
    expect(list().childElementCount).toBe(0)
  })

  it('只有链接时出一组链接卡，空着的那几项跳过', async () => {
    await runAbout({
      links: { ...EMPTY_LINKS, afdian: 'https://afdian.com/a/demo' },
    })

    expect(section().hidden).toBe(false)
    expect(list().childElementCount).toBe(1)

    const cards = list().querySelectorAll('a')
    expect(cards).toHaveLength(1)
    const card = cards[0]!
    expect(card.getAttribute('href')).toBe('https://afdian.com/a/demo')
    expect(card.target).toBe('_blank')
    expect(card.rel).toBe('noreferrer noopener')
    expect(card.dataset.slot).toBe('support-afdian')
    expect(card.textContent).toContain(SUPPORT_TEXT.afdian.label)
    expect(card.textContent).toContain(SUPPORT_TEXT.afdian.hint)
  })

  it('只有收款码时出一组竖卡，图片压在白底上并带 alt', async () => {
    await runAbout({ qrs: { ...EMPTY_QRS, wechat: '/support/wechat.png' } })

    expect(section().hidden).toBe(false)
    expect(list().querySelectorAll('a')).toHaveLength(0)

    const card = list().querySelector<HTMLElement>('[data-slot="support-wechat"]')!
    const image = card.querySelector('img')!
    expect(image.getAttribute('src')).toBe('/support/wechat.png')
    expect(image.alt).toBe(`${SUPPORT_TEXT.wechat.label}收款码`)
    expect(image.width).toBe(640)
    expect(image.height).toBe(640)
    // 深色主题下也不能让码跟着变暗，所以底板写死白色
    expect(image.parentElement?.className).toContain('bg-white')
  })

  it('两种入口都配了就出两组，链接那组排在前面', async () => {
    await runAbout({
      links: { ...EMPTY_LINKS, githubSponsors: 'https://github.com/sponsors/demo' },
      qrs: { ...EMPTY_QRS, alipay: '/support/alipay.png' },
    })

    const groups = list().children
    expect(groups).toHaveLength(2)
    expect(groups[0]!.querySelector('a')).not.toBeNull()
    expect(groups[1]!.querySelector('img')).not.toBeNull()
  })

  it('页面上没有赞赏区容器时照样跑完，版本号仍然填得上', async () => {
    await expect(
      runAbout({ links: { ...EMPTY_LINKS, afdian: 'https://afdian.com/a/demo' }, section: false }),
    ).resolves.toBeUndefined()
    expect(document.querySelector('[data-slot="app-version"]')?.textContent).toMatch(/^\d+\.\d+/)
  })

  it('文案一律当纯文本写进去，带标签的配置不会变成节点', async () => {
    await runAbout({
      links: { ...EMPTY_LINKS, buymeacoffee: 'https://buymeacoffee.com/demo' },
      text: {
        ...SUPPORT_TEXT,
        buymeacoffee: { label: '<img src=x onerror=alert(1)>', hint: '<b>粗体</b>' },
      },
    })

    const card = list().querySelector<HTMLElement>('[data-slot="support-buymeacoffee"]')!
    expect(card.querySelector('img')).toBeNull()
    expect(card.querySelector('b')).toBeNull()
    expect(card.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(card.textContent).toContain('<b>粗体</b>')
  })
})
