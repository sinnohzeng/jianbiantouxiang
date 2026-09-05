/**
 * 品牌 SVG 的落盘前处理。
 *
 * dashboard-icons 里不少文件把填色写在 `<style>` 的类规则里（deepseek、figma、gitlab、
 * kimi-ai、ubuntu-linux）。运行时的 `sanitizeSvg` 按白名单重建，`<style>` 元素整支丢弃，
 * 于是路径没了 fill，画出来是纯黑。生成期先把类规则内联成元素的 `style` 属性，
 * 运行时那一层只要放行 `style` 就能保住原色。
 *
 * 只处理最简单的一种规则：选择器全是类名，声明块里没有嵌套。带别的选择器的规则原样丢掉，
 * 反正上游这批文件里没有。本模块不碰 node API，也不碰浏览器 API，可以直接单测。
 */

/** `<style>…</style>` 整块，含标签本身。 */
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
/** CSS 里包内容的两种壳：CDATA 与 HTML 注释。 */
const WRAPPERS = /<!\[CDATA\[|\]\]>|<!--|-->/g
/** 一条规则：选择器加声明块。 */
const RULE = /([^{}]+)\{([^{}]*)\}/g
/** 起始标签，属性值里的引号不当作标签结束。 */
const TAG = /<([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g

function attribute(tag: string, name: string): { whole: string; value: string } | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  if (!match) return null
  return { whole: match[0], value: match[1] ?? match[2] ?? '' }
}

/** 声明串规整成一行：去掉空白与多余分号，方便拼接与比对。 */
function tidy(declarations: string): string {
  return declarations
    .split(';')
    .map((one) => one.trim().replace(/\s*:\s*/, ':'))
    .filter((one) => one !== '')
    .join(';')
}

/** 从若干段 CSS 里收出「类名 → 声明串」。同名类后出现的规则接在后面，与 CSS 的层叠一致。 */
export function classRules(css: string): Map<string, string> {
  const rules = new Map<string, string>()
  for (const match of css.replace(WRAPPERS, '').matchAll(RULE)) {
    const declarations = tidy(match[2] ?? '')
    if (declarations === '') continue
    const selectors = (match[1] ?? '').split(',').map((one) => one.trim())
    if (!selectors.every((one) => /^\.[\w-]+$/.test(one))) continue
    for (const selector of selectors) {
      const name = selector.slice(1)
      const before = rules.get(name)
      rules.set(name, before ? `${before};${declarations}` : declarations)
    }
  }
  return rules
}

function rewriteTag(tag: string, rules: Map<string, string>): string {
  const classAttr = attribute(tag, 'class')
  if (!classAttr) return tag

  const declarations = classAttr.value
    .split(/\s+/)
    .filter((name) => name !== '')
    .map((name) => rules.get(name) ?? '')
    .filter((one) => one !== '')

  let next = tag.replace(classAttr.whole, '')
  const styleAttr = attribute(next, 'style')
  if (styleAttr) next = next.replace(styleAttr.whole, '')

  // 元素自带的声明拼在最后：同一个属性写两次，后面那条赢，原有内联样式因此优先
  const merged = tidy([...declarations, styleAttr?.value ?? ''].join(';'))
  if (merged === '') return next

  const selfClosing = next.endsWith('/>')
  const head = next.slice(0, selfClosing ? -2 : -1).trimEnd()
  return `${head} style="${merged}"${selfClosing ? '/>' : '>'}`
}

/**
 * 把 `<style>` 里的类规则内联到元素上，然后删掉 `<style>` 元素与 `class` 属性。
 * 文件里没有 `<style>` 时原样返回，不动那 60 多个本来就好好的文件。
 */
export function inlineClassStyles(svg: string): string {
  const blocks = [...svg.matchAll(STYLE_BLOCK)]
  if (blocks.length === 0) return svg

  const rules = classRules(blocks.map((block) => block[1] ?? '').join('\n'))
  const body = svg.replace(STYLE_BLOCK, '')
  return body.replace(TAG, (tag) => rewriteTag(tag, rules))
}
