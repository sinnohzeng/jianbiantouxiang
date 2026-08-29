/**
 * 字体样式表的 URL 构造。
 *
 * 主链路走 Google Fonts css2：返回的 @font-face 全部带 unicode-range，
 * 浏览器只拉文字实际用到的切片，Noto Sans SC 单片约 2 KB。
 * 不加 `text=` 参数，Noto CJK 上它不生效（2026-08-29 实测仍返回整套字体）。
 *
 * 镜像链路走 jsDelivr 上 fontsource 的 npm 包路径。同一份字体，
 * `/fontsource/css/<id>@latest/<weight>.css` 的 CJK 分片没有 unicode-range，
 * 浏览器只会命中最后一条整包规则（Noto Sans SC 700 为 1.1 MB）；
 * `/npm/@fontsource/<id>@latest/<weight>.css` 每条分片都带 unicode-range，
 * 因此镜像用后者（2026-08-29 两条路径都实测过）。
 */

export const GOOGLE_CSS2_ENDPOINT = 'https://fonts.googleapis.com/css2'

/** 镜像主机按优先级排列，前者不可达时依次下推。 */
export const MIRROR_HOSTS: readonly string[] = ['cdn.jsdelivr.net', 'gcore.jsdelivr.net']

function normalizeWeights(weights: readonly number[]): number[] {
  const out = weights
    .map((w) => Math.round(w))
    .filter((w) => Number.isFinite(w) && w >= 100 && w <= 1000)
  return [...new Set(out.length > 0 ? out : [400])].sort((a, b) => a - b)
}

/** family 转 fontsource id：小写，非字母数字压成单个连字符。 */
export function familyToFontsourceId(family: string): string {
  return family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** css2 的 family 参数用 `+` 表示空格，其余字符按 URL 编码。 */
function encodeFamily(family: string): string {
  return family
    .trim()
    .split(/\s+/)
    .map((part) => encodeURIComponent(part))
    .join('+')
}

/**
 * 构造 css2 链接。weights 必须是该字体真实提供的字重，
 * 请求不存在的字重时 Google 返回 400（Bebas Neue 请求 700 即如此）。
 */
export function buildCss2Url(family: string, weights: readonly number[]): string {
  const list = normalizeWeights(weights)
  const spec = `${encodeFamily(family)}:wght@${list.join(';')}`
  return `${GOOGLE_CSS2_ENDPOINT}?family=${spec}&display=swap`
}

/** 单个镜像主机上的样式表地址，每个字重一条。 */
export function buildMirrorCssUrlsForHost(
  host: string,
  id: string,
  weights: readonly number[],
): string[] {
  return normalizeWeights(weights).map(
    (w) => `https://${host}/npm/@fontsource/${id}@latest/${w}.css`,
  )
}

/** 全部镜像地址，按主机优先级铺平，供调用方按序尝试。 */
export function buildMirrorCssUrls(id: string, weights: readonly number[]): string[] {
  return MIRROR_HOSTS.flatMap((host) => buildMirrorCssUrlsForHost(host, id, weights))
}
