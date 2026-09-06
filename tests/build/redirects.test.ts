/**
 * `public/_redirects` 的回归守卫。
 *
 * 给某个路径写一条 200 重写到它自己的 `.html`，Pages 会把重写后的 `.html` 路径
 * 308 规范化回无后缀路径，于是又落回同一条规则，浏览器拿到 ERR_TOO_MANY_REDIRECTS。
 * 站点的 `/about` 踩过一次。它本来就不需要重写规则，Pages 静态资源层自己会把它映射到 `about.html`。
 *
 * 这里守的是配置文件本身，不起 Pages 资源层：解析出每一条规则，
 * 挡住「200 重写到 `.html`」这一整类，而不是只挡 `/about` 那一条字面。
 * 单页兜底 `/*` → `/index.html` 是站点现行的唯一例外，显式放行。
 */

import { describe, expect, it } from 'vitest'
// 用 ?raw 原样读进来，不走 node:fs：tests 归 tsconfig.app.json 管，那一档没有 node 类型
import REDIRECTS from '../../public/_redirects?raw'

interface Rule {
  from: string
  to: string
  /** 显式写出来的状态码。没写就是 NaN，缺省值是 302 跳转，不成环。 */
  status: number
}

/** 目标是不是一个 `.html` 文件，查询串与锚点不影响判断。 */
const HTML_TARGET = /\.html(?:[?#].*)?$/i

/** 单页兜底那一条。它是站点现行的兜底规则，也是唯一允许存在的 200 → `.html`。 */
const SPA_FALLBACK: Pick<Rule, 'from' | 'to'> = { from: '/*', to: '/index.html' }

/** 按 Cloudflare 的格式拆行：`来源 目标 [状态码]`，`#` 起头的是注释。 */
function parseRedirects(source: string): Rule[] {
  const rules: Rule[] = []
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const [from, to, status] = line.split(/\s+/)
    if (from === undefined || to === undefined) continue
    rules.push({ from, to, status: Number(status) })
  }
  return rules
}

/** 会成环的那一类：200 重写到 `.html`，单页兜底除外。 */
function loopingRewrites(rules: readonly Rule[]): Rule[] {
  return rules.filter((rule) => {
    if (rule.status !== 200 || !HTML_TARGET.test(rule.to)) return false
    return !(rule.from === SPA_FALLBACK.from && rule.to === SPA_FALLBACK.to)
  })
}

describe('仓库里的 _redirects', () => {
  const rules = parseRedirects(REDIRECTS)

  it('没有任何会成环的 200 重写', () => {
    expect(loopingRewrites(rules)).toEqual([])
  })

  it('只剩单页兜底一条规则，每条都写明状态码', () => {
    expect(rules).toEqual([{ ...SPA_FALLBACK, status: 200 }])
    for (const rule of rules) expect(Number.isNaN(rule.status)).toBe(false)
  })

  it('没有给 /about 单开规则，它由 Pages 静态资源层自己映射', () => {
    expect(rules.some((rule) => rule.from.startsWith('/about'))).toBe(false)
  })
})

describe('守卫挡的是一整类，不是一条字面规则', () => {
  it('把 /about 那条加回来就报出来', () => {
    const rules = parseRedirects('/about  /about.html  200\n/*  /index.html  200\n')
    expect(loopingRewrites(rules)).toEqual([{ from: '/about', to: '/about.html', status: 200 }])
  })

  it('换成别的路径、别的大小写、目录下的 index.html 一样报', () => {
    const cases = [
      '/help  /help.html  200',
      '/Docs  /Docs.HTML  200',
      '/guide/*  /guide/index.html  200',
      '/post/:slug  /post.html?slug=:slug  200',
    ]
    for (const line of cases) {
      expect(loopingRewrites(parseRedirects(line)), line).toHaveLength(1)
    }
  })

  it('301 与 302 跳到 .html 不算：那是跳转不是重写，不会落回同一条规则', () => {
    const rules = parseRedirects('/old  /new.html  301\n/tmp  /new.html  302\n/none  /new.html\n')
    expect(loopingRewrites(rules)).toEqual([])
  })

  it('200 重写到无后缀路径或资源不算', () => {
    const rules = parseRedirects('/api/*  /worker  200\n/img/*  /assets/img.svg  200\n')
    expect(loopingRewrites(rules)).toEqual([])
  })
})

describe('解析器', () => {
  it('注释、空行与行首缩进都不当规则', () => {
    expect(parseRedirects('# 说明\n\n  \n\t# 缩进的注释\n')).toEqual([])
  })

  it('多个空格或制表符分隔都认，状态码可以省', () => {
    expect(parseRedirects('/a\t\t/b\t301\n  /c   /d  \n')).toEqual([
      { from: '/a', to: '/b', status: 301 },
      { from: '/c', to: '/d', status: Number.NaN },
    ])
  })

  it('只有来源没有目标的残行整条丢掉', () => {
    expect(parseRedirects('/only-source\n/a /b 200\n')).toEqual([
      { from: '/a', to: '/b', status: 200 },
    ])
  })
})
