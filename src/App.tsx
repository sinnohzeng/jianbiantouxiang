import { useEffect, useRef } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/app/AppShell'
import { useTheme } from '@/app/theme'
import { getCuratedByFamily, nearestWeight } from '@/fonts'
import { I18nProvider, dictOf, useLocale, useT } from '@/i18n'
import { DEFAULT_CONFIG, LOCALE_DEFAULT_FONT, type PartialConfig } from '@/state/config'
import { initialConfigSource, useAvatarStore } from '@/state/store'

const OWNED_DEFAULTS = {
  text: DEFAULT_CONFIG.text,
  fontFamily: DEFAULT_CONFIG.typography.fontFamily,
} as const

/**
 * 示例文字与默认字体随界面语言走。
 *
 * 接管有三条边界。
 *
 * 一、只在配置来自默认值时接管，本机存档是用户自己的内容，一个字都不能改。
 *
 * 二、用 ref 记住自己写进去的那份，当前值一旦不是自己写的就说明用户动过手，本次会话不再接管。
 * 不能拿“当前文字是不是某种语言的示例”当判据：`initialConfigSource()` 整场都是 `default`，
 * 用户手打 Hello 会被立刻顶回本语言的示例，这个词根本打不进去。
 * `reset()` 把整份配置换回 `DEFAULT_CONFIG` 本身，按引用能认出来，那一档重新开始跟随。
 *
 * 三、懒加载语言的字典没到货时 `t` 落到英文，这一轮整个跳过，
 * 否则示例文字先被写成 Hello 再改成目标语言，白闪一次也白写一次 store。
 * 文字与字体一起写，字体探测的样本才始终和文字同一种语言。
 */
export function LocaleDefaults() {
  const t = useT()
  const { locale } = useLocale()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const owned = useRef({ ...OWNED_DEFAULTS })
  const released = useRef({ text: false, font: false })

  useEffect(() => {
    const { text, typography } = config

    if (config === DEFAULT_CONFIG) {
      // reset() 回到默认档，之前的“用户动过手”作废
      owned.current = { ...OWNED_DEFAULTS }
      released.current = { text: false, font: false }
    }

    const fromUser = initialConfigSource() !== 'default'
    if (fromUser || text !== owned.current.text) released.current.text = true
    if (fromUser || typography.fontSource !== 'google') released.current.font = true
    if (typography.fontFamily !== owned.current.fontFamily) released.current.font = true
    if (released.current.text && released.current.font) return

    // 字典还在路上，等它到货再一次写完
    if (dictOf(locale) === null) return

    const patch: PartialConfig = {}

    if (!released.current.text) {
      const sample = t('app.sampleText')
      if (sample !== text) {
        owned.current.text = sample
        patch.text = sample
      }
    }

    if (!released.current.font) {
      const family = LOCALE_DEFAULT_FONT[locale]
      if (family !== typography.fontFamily) {
        const entry = getCuratedByFamily(family)
        owned.current.fontFamily = family
        patch.typography = {
          fontFamily: family,
          fontWeight: entry
            ? nearestWeight(entry.weights, typography.fontWeight)
            : typography.fontWeight,
        }
      }
    }

    if (patch.text !== undefined || patch.typography !== undefined) setConfig(patch)
  }, [config, locale, t, setConfig])

  return null
}

/**
 * 标题与描述随界面语言走。SEO 不是这个站的重点，
 * 但分享到 IM 时抓的是这两条，得跟着语言变。
 */
function DocumentMeta() {
  const t = useT()
  const text = useAvatarStore((state) => state.config.text)

  useEffect(() => {
    const title = text.trim() === '' ? t('app.title') : `${text.trim()} · ${t('app.name')}`
    document.title = title
    const description = t('app.description')
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      document.querySelector(selector)?.setAttribute('content', description)
    }
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', t('app.title'))
  }, [t, text])

  return null
}

function Shell() {
  const { resolved } = useTheme()

  return (
    <>
      <DocumentMeta />
      <LocaleDefaults />
      <AppShell />
      {/* 手机上底部被操作条占着，提示统一从顶部下来 */}
      <Toaster position="top-center" theme={resolved} closeButton />
    </>
  )
}

export default function App() {
  // store 模块加载即读 localStorage 并启动同步，这里不用再初始化一次
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}
