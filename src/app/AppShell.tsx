/**
 * 应用外壳。同一棵组件树用断点切三种形态，不按视口宽度分支渲染，
 * 这条来自 `@reactbits-pro/app-shell-8`：两套树会让状态与焦点在断点处丢失。
 *
 * ≥1280：三列 `[380px | 1fr | 320px]`，左挑选栏、中预览、右检查器带，三列各自滚。
 * 1024 到 1279：两列，检查器带落到预览下方。
 * <1024：纵向栈，预览 sticky 在顶栏下、高度由 `--preview-h` 决定，下面一条分隔条可拖，
 * 再往下是挑选栏五节与收起的“微调”，操作条固定在屏幕底并让出 safe-area。
 *
 * 视觉顺序由 grid 的行列指定，DOM 顺序按手机来排：预览、分隔条、挑选栏、检查器带、操作条。
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
import { Inspector } from '@/app/workspace/Inspector'
import { MobileDivider } from '@/app/workspace/MobileDivider'
import { PickColumn } from '@/app/workspace/PickColumn'
// 导出抽屉与历史条走懒加载入口，见 panels/lazy
import { ExportDrawerLazy, HistoryStripLazy } from '@/app/panels/lazy'
import { useT } from '@/i18n'
import { useAvatarStore } from '@/state/store'

function AppShellBody() {
  const t = useT()
  const exportOpen = useAvatarStore((state) => state.ui.exportOpen)
  // 打开过一次就一直为真，抽屉从此留在树里；没打开过就不拉那份 chunk
  const exportMounted = useAvatarStore((state) => state.ui.exportMounted)
  // 只订阅有没有历史：0 到 1 才重渲，后面每加一格都重渲整个外壳就得不偿失了
  const hasHistory = useAvatarStore((state) => state.history.length > 0)
  const setUi = useAvatarStore((state) => state.setUi)
  const { height } = usePreviewHeight()

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
        style={{ '--preview-h': `${height}svh` } as CSSProperties}
        className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto_auto] lg:gap-4 lg:overflow-hidden lg:px-4 lg:py-4 xl:grid-cols-[360px_minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)_auto]"
      >
        <section
          data-slot="preview-pane"
          aria-label={t('preview.label')}
          className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-14 z-20 flex h-[var(--preview-h)] items-center justify-center overflow-hidden px-4 backdrop-blur-md [--preview-max:calc(68svh_-_200px)] lg:static lg:col-start-2 lg:row-start-1 lg:h-auto lg:min-h-0 lg:overflow-y-auto lg:bg-transparent lg:px-0 lg:backdrop-blur-none xl:[--preview-max:calc(100svh_-_190px)]"
        >
          <PreviewStage />
        </section>

        <MobileDivider />

        <div className="flex flex-col gap-3 px-4 pt-3 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:px-0.5 xl:row-span-2">
          <section
            aria-label={t('history.title')}
            className="bg-card/60 rounded-2xl border p-3 backdrop-blur-sm"
          >
            <h2 className="text-muted-foreground mb-2 px-1 text-xs font-medium">
              {t('history.title')}
            </h2>
            {/* 空态就一行字，为它拉一份 chunk 不值当；有历史了才挂懒加载的那份 */}
            {hasHistory ? (
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <HistoryStripLazy />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <p className="text-muted-foreground px-1 text-xs">{t('history.empty')}</p>
            )}
          </section>

          <PickColumn />
        </div>

        <div className="px-4 pt-2 pb-[calc(3.5rem_+_env(safe-area-inset-bottom)_+_1rem)] lg:col-start-2 lg:row-start-3 lg:max-h-[32svh] lg:min-h-0 lg:overflow-y-auto lg:px-0.5 lg:pt-0 lg:pb-2 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:max-h-none">
          <Inspector />
        </div>

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
