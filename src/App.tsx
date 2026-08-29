import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/app/AppShell'
import { useTheme } from '@/app/theme'
import { I18nProvider, LOCALES, translate, useT } from '@/i18n'
import { initialConfigSource, useAvatarStore } from '@/state/store'

/** 这段文字是不是某种语言的默认示例。是的话说明用户还没动过，可以跟着语言换。 */
function isSampleText(text: string): boolean {
  return LOCALES.some((locale) => translate(locale, 'app.sampleText') === text)
}

/**
 * 默认示例文字随界面语言走。
 *
 * 只在配置来自默认值时接管：分享链接与本机存档都是用户自己的内容，一个字都不能改。
 * 判据是“当前文字仍是某种语言的示例”，所以用户一旦自己打过字就再也不会被顶掉。
 */
function SampleText() {
  const t = useT()
  const text = useAvatarStore((state) => state.config.text)
  const setConfig = useAvatarStore((state) => state.setConfig)

  useEffect(() => {
    if (initialConfigSource() !== 'default') return
    const sample = t('app.sampleText')
    if (sample === text || !isSampleText(text)) return
    setConfig({ text: sample })
  }, [t, text, setConfig])

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
      <SampleText />
      <AppShell />
      {/* 手机上底部被操作条占着，提示统一从顶部下来 */}
      <Toaster position="top-center" theme={resolved} closeButton />
    </>
  )
}

export default function App() {
  // store 模块加载即读 URL hash 与 localStorage，并启动同步，这里不用再初始化一次
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}
