/**
 * 应用外壳。同一棵组件树用断点切三种形态，不按视口宽度分支渲染，
 * 这条来自 `@reactbits-pro/app-shell-8`：两套树会让状态与焦点在断点处丢失。
 *
 * ≥1120：挑选栏拆成两列（文字图标 / 配色质感），右边是预览与操作条。
 * 1024 到 1120：挑选栏并回一列，壳内自己拆两列，仍与预览左右分。
 * <1024：纵向栈，预览 sticky 在顶栏下、高度由 `--preview-h` 决定，下面一条分隔条可拖。
 *
 * 操作条只占预览那一列：它管的是画面，不是左边的挑选栏。
 *
 * 桌面的列模板与落位全在 index.css 的 `[data-slot='workspace']` 一段，共三套，
 * 堆在 className 上是一串三百字符、改一个数要数括号的类名。
 * 视觉顺序由栅格指定，DOM 顺序按手机来排：预览、分隔条、挑选栏、操作条。
 *
 * 底色由 ShowcaseBackground 决定：能跑就是极光着色器，跑不了退回 CSS 光晕。
 *
 * 整棵树外面套一层错误边界，两个懒加载岛各自再套一层：chunk 拉不到时
 * React 会在 render 阶段重新抛出，没有边界接住就整页白屏，连刷新的入口都没有。
 */

import { Suspense, useEffect, type CSSProperties } from 'react'
import { BottomBar } from '@/app/BottomBar'
import {
  ErrorBoundary,
  reloadOnceForChunkError,
  reloadOnceForModuleError,
} from '@/app/error-boundary'
import { PreviewStage } from '@/app/PreviewStage'
import { ShowcaseBackground } from '@/app/showcase/ShowcaseBackground'
import { TopBar } from '@/app/TopBar'
import { usePreviewHeight } from '@/app/preview-height'
import { useServiceWorkerUpdate } from '@/app/sw-update'
import { MobileDivider } from '@/app/workspace/MobileDivider'
import { PickColumn } from '@/app/workspace/PickColumn'
// 导出抽屉走懒加载入口，见 panels/lazy
import { ExportDrawerLazy } from '@/app/panels/lazy'
import { useT } from '@/i18n'
import { useAvatarStore } from '@/state/store'

function AppShellBody() {
  const t = useT()
  const exportOpen = useAvatarStore((state) => state.ui.exportOpen)
  // 打开过一次就一直为真，抽屉从此留在树里；没打开过就不拉那份 chunk
  const exportMounted = useAvatarStore((state) => state.ui.exportMounted)
  const setUi = useAvatarStore((state) => state.setUi)
  const { height } = usePreviewHeight()
  // 部署完不必等用户主动刷新：定时问一次有没有新版本，有就弹一条带刷新按钮的提示
  useServiceWorkerUpdate()

  // 重新部署后旧 chunk 名会失效，抢在 React 抛错之前刷一次去取新版本
  useEffect(() => {
    const onPreloadError = (): void => {
      reloadOnceForChunkError()
    }
    window.addEventListener('vite:preloadError', onPreloadError)
    return () => window.removeEventListener('vite:preloadError', onPreloadError)
  }, [])

  return (
    <div className="relative flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <ShowcaseBackground />
      <TopBar />

      <main
        // 预览高度只在手机上生效，但变量挂在这里，分隔条与预览列读的是同一个源
        data-slot="workspace"
        style={{ '--preview-h': `${height}svh` } as CSSProperties}
        className="flex flex-1 flex-col lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-[1520px] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4 lg:overflow-hidden lg:px-4 lg:py-4"
      >
        <section
          data-slot="preview-pane"
          aria-label={t('preview.label')}
          // 桌面不裁：画框已按 --preview-max 夹过，不会长出滚动条，而投影与光晕要越出这一格才不会被切成硬边。
          // 手机仍裁：它是 sticky 的顶部块，底边之下是滚动内容
          className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-14 z-20 flex h-[var(--preview-h)] items-center justify-center overflow-hidden px-4 backdrop-blur-md [--preview-max:calc(68svh_-_200px)] lg:static lg:h-auto lg:min-h-0 lg:overflow-visible lg:bg-transparent lg:px-0 lg:backdrop-blur-none lg:[--preview-max:calc(100svh_-_200px)]"
        >
          <PreviewStage />
        </section>

        <MobileDivider />

        <PickColumn />

        {/* 备案号在手机上落在页面末尾。这一行还兼着给固定操作条让位的底部内距，
            桌面它整个不占位，挑选栏本来就自己滚 */}
        <a
          data-slot="icp-beian-mobile"
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground/70 block px-4 pt-3 pb-[calc(3.5rem_+_env(safe-area-inset-bottom)_+_1rem)] text-center text-[11px] sm:hidden"
        >
          {t('footer.icp')}
        </a>

        <BottomBar />
      </main>

      {exportMounted ? (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ExportDrawerLazy
              open={exportOpen}
              onOpenChange={(open) => setUi({ exportOpen: open })}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </div>
  )
}

export function AppShell() {
  return (
    <ErrorBoundary onError={reloadOnceForModuleError}>
      <AppShellBody />
    </ErrorBoundary>
  )
}
