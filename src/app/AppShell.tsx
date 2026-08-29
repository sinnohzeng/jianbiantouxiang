/**
 * 应用外壳。同一棵组件树用断点切两种形态，不按视口宽度分支渲染，
 * 这条来自 `@reactbits-pro/app-shell-8`：两套树会让状态与焦点在断点处丢失。
 *
 * 桌面（≥ 1024 px）：左预览右面板列，面板列自己滚，操作条钉在列底。
 * 手机：预览 sticky 在顶栏下，分段控件切面板，操作条固定在屏幕底并让出 safe-area。
 */

import { useMemo } from 'react'
import { ImageIcon, PaletteIcon, SparklesIcon, TypeIcon } from 'lucide-react'
import { AmbientBackground } from '@/app/AmbientBackground'
import { BottomBar } from '@/app/BottomBar'
import { PreviewStage } from '@/app/PreviewStage'
import { SegmentedTabs, type SegmentedItem } from '@/app/SegmentedTabs'
import { TopBar } from '@/app/TopBar'
import {
  CanvasPanel,
  ExportDrawer,
  HistoryStrip,
  PalettePanel,
  StylePanel,
  TextPanel,
} from '@/app/panels'
import { useT } from '@/i18n'
import { useAvatarStore, type ActivePanel } from '@/state/store'

const PANEL_ID = 'panel'

export function AppShell() {
  const t = useT()
  const activePanel = useAvatarStore((state) => state.ui.activePanel)
  const exportOpen = useAvatarStore((state) => state.ui.exportOpen)
  const setUi = useAvatarStore((state) => state.setUi)

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
          aria-label={t('preview.label')}
          className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-14 z-20 flex justify-center border-b px-4 py-3 backdrop-blur-md lg:static lg:min-h-0 lg:flex-1 lg:items-center lg:border-b-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <PreviewStage />
        </section>

        <section className="bg-card/60 flex w-full flex-col lg:min-h-0 lg:w-[400px] lg:shrink-0 lg:rounded-2xl lg:border lg:backdrop-blur-md">
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
            <HistoryStrip />
          </div>

          <BottomBar />
        </section>
      </main>

      <ExportDrawer open={exportOpen} onOpenChange={(open) => setUi({ exportOpen: open })} />
    </div>
  )
}
