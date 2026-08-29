/**
 * PWA manifest 的多语言产物。
 *
 * Web App Manifest 规范没有本地化成员，一份 manifest 只声明一种语言，就是 `lang` 字段。
 * 站点是单份静态 HTML，服务端不做内容协商，所以做法是每种界面语言各出一份 manifest 文件，
 * 运行时按当前语言改 `<link rel="manifest">` 的 href。浏览器在用户触发安装时读的是当下
 * DOM 里链着的那一份，安装后的应用名与主屏图标名因此跟着界面语言走。
 *
 * 文案一律取 `src/i18n` 的字典，这里不另抄一份。构建期由 `vite.config.ts` 注入读取器，
 * 测试里直接喂导入的字典，所以本模块不碰 node API，也不碰浏览器 API。
 */

/** 与 `src/i18n` 的 `LOCALES` 同一套取值，`tests/build/pwa-manifest.test.ts` 盯着两者一致。 */
export const MANIFEST_LOCALES = ['zh-CN', 'zh-HK', 'en', 'ja', 'ko'] as const

export type ManifestLocale = (typeof MANIFEST_LOCALES)[number]

/** 默认语言，也就是没设构建期语言参数时 `manifest.webmanifest` 用的语言。 */
export const DEFAULT_MANIFEST_LOCALE: ManifestLocale = 'zh-CN'

/**
 * manifest 三个文案字段各自的取值顺序，取第一条有值的。
 *
 * `name` 取 `app.title` 而不是 `app.name`：站点的产品身份本来就是双语的一条，
 * `<title>`、og:title 与已经装出去的应用名都是这一条，换成单语会改掉现有安装的名字。
 * 主屏图标下面显示的是 `short_name`，越短越好，所以先要 `app.shortName`，
 * 字典里没有这条时落到按语言给的单语 `app.name`。
 */
const NAME_KEYS = ['app.title']
const SHORT_NAME_KEYS = ['app.shortName', 'app.name']
const DESCRIPTION_KEYS = ['app.description']

interface ManifestIcon {
  src: string
  sizes?: string
  type?: string
  purpose?: 'any' | 'maskable' | 'monochrome'
}

export interface LocalizedManifest {
  name: string
  short_name: string
  description: string
  lang: ManifestLocale
  dir: 'ltr' | 'rtl'
  id: string
  start_url: string
  scope: string
  display: 'standalone'
  orientation: 'any'
  categories: string[]
  theme_color: string
  background_color: string
  icons: ManifestIcon[]
}

/** 字典读取器。构建期从 `src/i18n/<locale>.json` 读，测试里给导入好的字典。 */
export type DictReader = (locale: ManifestLocale) => Record<string, string>

function isManifestLocale(value: unknown): value is ManifestLocale {
  return typeof value === 'string' && (MANIFEST_LOCALES as readonly string[]).includes(value)
}

/**
 * 构建期的语言参数，给按语言分开部署的场景用，取不到或不认识就落到默认语言。
 * 单份部署不用设，`manifest.webmanifest` 保持简体中文，其余语言走各自的文件。
 */
export function resolveManifestLocale(value: string | undefined): ManifestLocale {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_MANIFEST_LOCALE
  return isManifestLocale(trimmed) ? trimmed : DEFAULT_MANIFEST_LOCALE
}

/** 按顺序取第一条有值的文案。一条都没有就当场报错，免得产出一份没有名字的 manifest。 */
function pickText(
  dict: Record<string, string>,
  keys: readonly string[],
  locale: ManifestLocale,
): string {
  for (const key of keys) {
    const value = dict[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  throw new Error(`i18n 字典 ${locale} 里 ${keys.join(' 与 ')} 都没有取值，生成不了 manifest`)
}

/** 某一种语言的完整 manifest。语言无关的字段五份完全一样。 */
export function localizedManifest(locale: ManifestLocale, readDict: DictReader): LocalizedManifest {
  const dict = readDict(locale)
  return {
    name: pickText(dict, NAME_KEYS, locale),
    short_name: pickText(dict, SHORT_NAME_KEYS, locale),
    description: pickText(dict, DESCRIPTION_KEYS, locale),
    lang: locale,
    // 五种界面语言都从左往右写
    dir: 'ltr',
    // 五份 manifest 描述的是同一个应用：id 一致，切语言不会在系统里多出第二个图标
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    categories: ['graphics', 'utilities', 'productivity'],
    // 浅色主题的底色，深色偏好由页面里的脚本改 meta[name=theme-color]
    theme_color: '#fbf9f6',
    background_color: '#fbf9f6',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}

/**
 * 某一种语言的 manifest 文件名。五种语言一套规则，运行时拼 href 不用分支；
 * 构建语言那份与 `vite-plugin-pwa` 产出的 `manifest.webmanifest` 内容相同，多出的一份只为规则统一。
 */
export function manifestFileName(locale: ManifestLocale): string {
  return `manifest.${locale}.webmanifest`
}

/** 全部语言的 manifest 文件，构建期写进产物，开发期由中间件按同样的路径返回。 */
export function localizedManifestFiles(
  readDict: DictReader,
): { fileName: string; source: string }[] {
  // 与 vite-plugin-pwa 产出的 manifest.webmanifest 一样压成一行
  return MANIFEST_LOCALES.map((locale) => ({
    fileName: manifestFileName(locale),
    source: JSON.stringify(localizedManifest(locale, readDict)),
  }))
}
