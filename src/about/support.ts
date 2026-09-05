/**
 * 赞赏入口的配置。
 *
 * 填了哪一项就出哪一项，全空整块不渲染，所以没号的时候页面上不会留一个空壳。
 * 这里只放链接和图片路径，平台账号与提现都在 owner 自己手里，代码里没有任何密钥。
 * 收款码放 `public/support/`，构建时原样进产物。
 */

export interface SupportEntry {
  /** 渲染顺序与文案都按这个 id 取。 */
  id: 'afdian' | 'buymeacoffee' | 'githubSponsors' | 'wechat' | 'alipay'
  label: string
  hint: string
}

/** 链接型入口：点一下跳到对应平台。 */
export const SUPPORT_LINKS: Record<'afdian' | 'buymeacoffee' | 'githubSponsors', string> = {
  // 爱发电主页，形如 https://afdian.com/a/yourname
  afdian: '',
  // Buy Me a Coffee 主页，形如 https://buymeacoffee.com/yourname
  buymeacoffee: '',
  // GitHub Sponsors 主页，形如 https://github.com/sponsors/sinnohzeng
  githubSponsors: '',
}

/**
 * 收款码型入口：放图片路径，扫码付。
 *
 * 图是从收款海报里裁出来的，只留码本身加一圈静区，静区是重画的纯白，
 * 不从海报上取——支付宝那张白卡比静区窄，直接取会把蓝底和姓名一起带进来。
 * 裁完用 jsQR 解过一遍，payload 与原图逐字一致，没有重新生成过二维码。
 */
export const SUPPORT_QRS: Record<'wechat' | 'alipay', string> = {
  wechat: '/support/wechat.png',
  alipay: '/support/alipay.png',
}

export const SUPPORT_TEXT: Record<SupportEntry['id'], { label: string; hint: string }> = {
  afdian: { label: '爱发电', hint: '国内平台，支持一次性与月度' },
  buymeacoffee: { label: 'Buy Me a Coffee', hint: '海外平台，刷卡与 PayPal' },
  githubSponsors: { label: 'GitHub Sponsors', hint: '直接从 GitHub 赞助' },
  wechat: { label: '微信', hint: '扫码请我喝一杯' },
  alipay: { label: '支付宝', hint: '扫码请我喝一杯' },
}

/** 有没有任何一个入口配好了。全空时整块不渲染。 */
export function hasSupport(): boolean {
  return (
    Object.values(SUPPORT_LINKS).some((value) => value.length > 0) ||
    Object.values(SUPPORT_QRS).some((value) => value.length > 0)
  )
}
