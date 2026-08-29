/**
 * 组件层单测共用的小工具。
 *
 * jsdom 既没有布局也没有 Tailwind，量不到 computed 值，
 * 与断点、字号有关的断言只能落在类名上，真实渲染归 e2e。
 */

/** 会把字号收到 16 px 以下的工具类。 */
const SHRINK = new Set(['text-xs', 'text-sm'])

/** 手机单栏还在生效的断点前缀，空串表示无前缀。页面双栏从 lg（1024 px）才开始。 */
const MOBILE_PREFIXES = new Set(['', 'sm', 'md'])

/**
 * 挑出会在手机档把字号收到 16 px 以下的类。
 * 手机上输入类控件字号一旦小于 16 px，iOS Safari 聚焦时会把整页放大。
 */
export function shrinkOnMobile(className: string): string[] {
  return className.split(/\s+/).filter((token) => {
    const cut = token.lastIndexOf(':')
    const prefix = cut === -1 ? '' : token.slice(0, cut)
    const base = cut === -1 ? token : token.slice(cut + 1)
    return SHRINK.has(base) && MOBILE_PREFIXES.has(prefix)
  })
}
