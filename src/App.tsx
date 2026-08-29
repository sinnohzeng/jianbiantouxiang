import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/app/AppShell'
import { useTheme } from '@/app/theme'
import { I18nProvider, useT } from '@/i18n'
import { useAvatarStore } from '@/state/store'

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
