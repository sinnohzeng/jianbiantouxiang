/**
 * 关于页的全部脚本。
 *
 * 这一页是纯静态 HTML，正文与样式都不需要 JS，所以这里不挂 React，也不引应用那棵树。
 * 只干两件动态的事：把构建期注入的版本号填进去，按配置渲染赞赏入口。
 * 样式复用应用那份 index.css，Tailwind 会连 about.html 一起扫。
 *
 * 全程 createElement 加 textContent，不用 innerHTML。这里的文案虽然都是仓库里的常量，
 * 但赞赏入口早晚会接一份外部配置，留一条拼字符串的路子是给以后挖坑。
 */

import '@/index.css'
import { SUPPORT_LINKS, SUPPORT_QRS, SUPPORT_TEXT, hasSupport } from '@/about/support'

const CARD =
  'border-border bg-card/70 flex items-center gap-3 rounded-2xl border p-4 transition-colors'

function versionLine(): void {
  const slot = document.querySelector('[data-slot="app-version"]')
  if (slot) slot.textContent = __APP_VERSION__
}

/** 一张卡里的「标题 + 小字」两行。 */
function caption(label: string, hint: string): HTMLSpanElement {
  const wrap = document.createElement('span')
  wrap.className = 'flex min-w-0 flex-col gap-0.5'

  const title = document.createElement('span')
  title.className = 'text-sm font-medium'
  title.textContent = label

  const note = document.createElement('span')
  note.className = 'text-muted-foreground text-xs'
  note.textContent = hint

  wrap.append(title, note)
  return wrap
}

function linkCard(id: keyof typeof SUPPORT_LINKS, href: string): HTMLAnchorElement {
  const text = SUPPORT_TEXT[id]
  const node = document.createElement('a')
  node.href = href
  node.target = '_blank'
  node.rel = 'noreferrer noopener'
  node.dataset.slot = `support-${id}`
  node.className = `${CARD} hover:bg-accent`

  const go = document.createElement('span')
  go.className = 'text-muted-foreground ml-auto text-xs'
  go.textContent = '去看看'

  node.append(caption(text.label, text.hint), go)
  return node
}

function qrCard(id: keyof typeof SUPPORT_QRS, src: string): HTMLDivElement {
  const text = SUPPORT_TEXT[id]
  const node = document.createElement('div')
  node.dataset.slot = `support-${id}`
  node.className = CARD

  const image = document.createElement('img')
  image.src = src
  image.alt = `${text.label}收款码`
  image.className = 'border-border size-20 shrink-0 rounded-xl border object-cover'

  node.append(image, caption(text.label, text.hint))
  return node
}

function support(): void {
  const section = document.querySelector<HTMLElement>('[data-slot="support"]')
  const list = document.querySelector<HTMLElement>('[data-slot="support-list"]')
  if (!section || !list || !hasSupport()) return

  for (const [id, href] of Object.entries(SUPPORT_LINKS)) {
    if (!href) continue
    list.appendChild(linkCard(id as keyof typeof SUPPORT_LINKS, href))
  }
  for (const [id, src] of Object.entries(SUPPORT_QRS)) {
    if (!src) continue
    list.appendChild(qrCard(id as keyof typeof SUPPORT_QRS, src))
  }
  section.hidden = false
}

versionLine()
support()
