/**
 * 应用外壳。同一棵组件树用断点切三种形态，不按视口宽度分支渲染，
 * 这条来自 `@reactbits-pro/app-shell-8`：两套树会让状态与焦点在断点处丢失。
 *
 * ≥1280：挑选栏拆成两列（文字图标 / 配色质感），右边是预览与操作条。
 * 1024 到 1279：挑选栏并回一列，仍与预览左右分。
 * <1024：纵向栈，预览 sticky 在顶栏下、高度由 `--preview-h` 决定，下面一条分隔条可拖。
 *
 * 微调面板默认收起。打开时在最左侧多开一列，不浮在预览上面：
 * 数值微调是「挑」的深一层，跟左边那两列同源；右边那一列是作品本身，
 * 不该被参数面板夹在中间。
 * 操作条只占预览那一列：它管的是画面，不是左边的挑选栏。
 *
 * 桌面的列模板与落位全在 index.css 的 `[data-slot='workspace']` 一段，
 * 断点乘开合共四套，堆在 className 上是一串三百字符、改一个数要数括号的类名。
 * 视觉顺序由栅格指定，DOM 顺序按手机来排：预览、分隔条、挑选栏、微调、操作条。
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
import { useInspectorOpen } from '@/app/inspector-open'
import { usePreviewHeight } from '@/app/preview-height'
import { useServiceWorkerUpdate } from '@/app/sw-update'
import { Inspector } from '@/app/workspace/Inspector'
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
  const { open: inspectorOpen } = useInspectorOpen()
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
        // 预览高度只在手机上生效，但变量挂在这里，分隔条与预览列读的是同一个源。
        // 微调开合会改列数，data-inspector 就是 index.css 里那两套列模板的选择开关
        data-slot="workspace"
        data-inspector={inspectorOpen ? 'open' : 'closed'}
        style={{ '--preview-h': `${height}svh` } as CSSProperties}
        className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4 lg:overflow-hidden lg:px-4 lg:py-4"
      >
        <section
          data-slot="preview-pane"
          aria-label={t('preview.label')}
          className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-14 z-20 flex h-[var(--preview-h)] items-center justify-center overflow-hidden px-4 backdrop-blur-md [--preview-max:calc(68svh_-_200px)] lg:static lg:h-auto lg:min-h-0 lg:overflow-hidden lg:bg-transparent lg:px-0 lg:backdrop-blur-none lg:[--preview-max:calc(100svh_-_190px)]"
        >
          <PreviewStage />
        </section>

        <MobileDivider />

        <PickColumn />

        <div
          data-slot="inspector-dock"
          data-open={inspectorOpen ? 'true' : 'false'}
          // 手机上它就在挑选栏下面，自己带折叠头；桌面收起时整列不占位，打开才在最左多开一列
          className="px-4 pt-2 pb-[calc(3.5rem_+_env(safe-area-inset-bottom)_+_1rem)] lg:hidden lg:min-h-0 lg:px-0.5 lg:pt-0 lg:pb-2 lg:data-[open=true]:block lg:data-[open=true]:overflow-y-auto"
        >
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
