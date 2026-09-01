/**
 * 应用外壳。同一棵组件树用断点切两种形态，不按视口宽度分支渲染，
 * 这条来自 `@reactbits-pro/app-shell-8`：两套树会让状态与焦点在断点处丢失。
 *
 * 桌面（≥ 1024 px）：左预览右面板列，面板列自己滚，操作条钉在列底。
 * 手机：预览 sticky 在顶栏下，分段控件切面板，操作条固定在屏幕底并让出 safe-area。
 *
 * 整棵树外面套一层错误边界，两个懒加载岛各自再套一层：chunk 拉不到时
 * React 会在 render 阶段重新抛出，没有边界接住就整页白屏，连刷新的入口都没有。
 */

import { Suspense, useEffect, useMemo } from 'react'
import { ImageIcon, PaletteIcon, SparklesIcon, TypeIcon } from 'lucide-react'
import { AmbientBackground } from '@/app/AmbientBackground'
import { BottomBar } from '@/app/BottomBar'
import {
  ErrorBoundary,
  reloadOnceForChunkError,
  reloadOnceForModuleError,
} from '@/app/error-boundary'
import { PreviewStage } from '@/app/PreviewStage'
import { SegmentedTabs, type SegmentedItem } from '@/app/SegmentedTabs'
import { TopBar } from '@/app/TopBar'
// 首屏要的四个面板直接引；导出抽屉与历史条走懒加载入口，见 panels/lazy
import { CanvasPanel } from '@/app/panels/CanvasPanel'
import { PalettePanel } from '@/app/panels/PalettePanel'
import { StylePanel } from '@/app/panels/StylePanel'
import { TextPanel } from '@/app/panels/TextPanel'
import { ExportDrawerLazy, HistoryStripLazy } from '@/app/panels/lazy'
import { useT } from '@/i18n'
import { useAvatarStore, type ActivePanel } from '@/state/store'

const PANEL_ID = 'panel'

function AppShellBody() {
  const t = useT()
  const activePanel = useAvatarStore((state) => state.ui.activePanel)
  const exportOpen = useAvatarStore((state) => state.ui.exportOpen)
  // 打开过一次就一直为真，抽屉从此留在树里；没打开过就不拉那份 chunk
  const exportMounted = useAvatarStore((state) => state.ui.exportMounted)
  // 只订阅有没有历史：0 到 1 才重渲，后面每加一格都重渲整个外壳就得不偿失了
  const hasHistory = useAvatarStore((state) => state.history.length > 0)
  const setUi = useAvatarStore((state) => state.setUi)

  // 重新部署后旧 chunk 名会失效，抢在 React 抛错之前刷一次去取新版本
  useEffect(() => {
    const onPreloadError = (): void => {
      reloadOnceForChunkError()
    }
    window.addEventListener('vite:preloadError', onPreloadError)
    return () => window.removeEventListener('vite:preloadError', onPreloadError)
  }, [])

  const items = useMemo<SegmentedItem<ActivePanel>[]>(
    () => [
      {
        id: 'text',
        label: t('panel.text.title'),
        icon: <TypeIcon className="size-4" aria-hidden />,
      },
      {
        id: 'palette',
        label: t('panel.palette.title'),
        icon: <PaletteIcon className="size-4" aria-hidden />,
      },
      {
        id: 'style',
        label: t('panel.style.title'),
        icon: <SparklesIcon className="size-4" aria-hidden />,
      },
      {
        id: 'canvas',
        label: t('panel.canvas.title'),
        icon: <ImageIcon className="size-4" aria-hidden />,
      },
    ],
    [t],
  )

  return (
    <div className="relative flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <AmbientBackground />
      <TopBar />

      {/* 桌面按 spec §3.7 面板在左、预览在右；DOM 顺序仍是预览在前，手机上它要 sticky 在顶栏下 */}
      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row-reverse lg:gap-6 lg:overflow-hidden lg:px-6 lg:py-5">
        <section
          data-slot="preview-pane"
          aria-label={t('preview.label')}
          className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-14 z-20 flex justify-center border-b px-4 py-3 backdrop-blur-md lg:static lg:min-h-0 lg:flex-1 lg:items-center lg:border-b-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <PreviewStage />
        </section>

        <section className="bg-card/60 flex w-full flex-col lg:min-h-0 lg:w-[380px] lg:shrink-0 lg:rounded-2xl lg:border lg:backdrop-blur-md">
          <section
            aria-label={t('history.title')}
            className="border-border/60 border-b px-4 pt-3 pb-3 lg:px-3"
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
          <div className="px-4 pt-3 lg:px-3">
            <SegmentedTabs
              items={items}
              value={activePanel}
              onChange={(next) => setUi({ activePanel: next })}
              label={t('panel.tabs.label')}
              idPrefix={PANEL_ID}
            />
          </div>

          <div
            id={`${PANEL_ID}-${activePanel}`}
            role="tabpanel"
            aria-labelledby={`${PANEL_ID}-tab-${activePanel}`}
            tabIndex={-1}
            className="min-h-0 flex-1 space-y-5 px-4 pt-4 pb-[calc(3.5rem_+_env(safe-area-inset-bottom)_+_1rem)] lg:overflow-y-auto lg:px-3 lg:pb-4"
          >
            {activePanel === 'text' ? <TextPanel /> : null}
            {activePanel === 'palette' ? <PalettePanel /> : null}
            {activePanel === 'style' ? <StylePanel /> : null}
            {activePanel === 'canvas' ? <CanvasPanel /> : null}
          </div>

          <BottomBar />
        </section>
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
