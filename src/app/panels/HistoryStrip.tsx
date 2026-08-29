/**
 * 最近生成条：横向滚动的 8 格缩略图。
 * 缩略图用配色的 CSS 渐变加文字首字占位，不重新跑一遍渲染，滚动时不掉帧。
 */

import { paletteThumbCss } from '@/palettes/color'
import { paletteColors } from '@/palettes/palettes'
import { useT } from '@/i18n'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'

/** 取首个码点，避免把 emoji 与增补平面汉字劈成半个代理对。 */
function initial(text: string): string {
  const trimmed = text.trim()
  return trimmed ? ([...trimmed][0] ?? '') : ''
}

export function HistoryStrip() {
  const t = useT()
  const history = useAvatarStore((state) => state.history)
  const restore = useAvatarStore((state) => state.restore)

  if (history.length === 0) {
    return <p className="text-muted-foreground px-1 py-2 text-xs">{t('history.empty')}</p>
  }

  return (
    <div role="group" aria-label={t('history.title')} className="flex gap-2 overflow-x-auto pb-1">
      {history.map((entry, index) => (
        <button
          key={`${index}-${entry.seed}-${entry.palette}`}
          type="button"
          aria-label={t('history.item', { index: index + 1 })}
          onClick={() => restore(index)}
          className={cn(
            'border-border hover:border-foreground/40 focus-visible:ring-ring/50 relative size-14 shrink-0 overflow-hidden rounded-xl border transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
            entry.canvas.shape === 'circle' && 'rounded-full',
          )}
          style={{ backgroundImage: paletteThumbCss(paletteColors(entry)) }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-base font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          >
            {initial(entry.text)}
          </span>
        </button>
      ))}
    </div>
  )
}
