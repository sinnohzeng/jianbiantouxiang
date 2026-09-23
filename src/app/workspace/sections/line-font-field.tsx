/**
 * 文字卡片上一行的字体：一行标签加一行控件，左边字体按钮占满剩余宽度，右边字重下拉定宽。
 *
 * 第二行默认跟随第一行：标签后的“跟随”钮点亮，按钮写第一行那款、文字用次要前景色。
 * 在这一行换字体或字重就独立，写入只经 config.ts 的 withLine1Font、withLine2Font 与 FOLLOW_LINE1。
 *
 * 字体选择器按行打开。桌面是锚在按钮下方的 Popover，外壳常驻，面板懒加载、弹层关闭即卸载；
 * 手机是底部抽屉，连同面板整块懒加载，点过一次才挂上，之后常驻，关闭动画才放得完。
 */

import { Suspense, useId, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { ChevronDownIcon, TriangleAlertIcon } from 'lucide-react'
import { AutoToggle } from '@/components/blocks/auto-toggle'
import { buttonVariants } from '@/components/ui/button'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { displayName, weightsOf } from '@/fonts/catalog'
import { useIsMobile } from '@/hooks/use-media'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  FOLLOW_LINE1,
  fontKey,
  lineFont,
  withLine1Font,
  withLine2Font,
  type FontWeight,
} from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { FontPickerDrawerLazy, FontPickerPanelLazy } from '@/app/panels/lazy'

const TRIGGER_CLASS = cn(
  buttonVariants({ variant: 'outline' }),
  'h-11 min-w-0 flex-1 justify-between px-3 text-base font-normal lg:h-9 lg:text-sm',
)

/**
 * 选择器只在按钮的上下两侧翻转，不翻到左右：它是一张可滚动的长列表，
 * 列表高度又随所在一侧的可用高度收放，允许翻到侧面时第一帧的全长列表会把它推到右侧并停在那里。
 * Base UI 给自己的下拉与菜单用的是同一个口径。
 */
const PICKER_COLLISION = { fallbackAxisSide: 'none' } as const

/** 与 ui/popover 的弹层同一套外观，宽度至少 22rem，比按钮窄时跟按钮一样宽。 */
const PICKER_POPUP_CLASS =
  'bg-popover text-popover-foreground ring-foreground/10 z-50 flex w-[max(var(--anchor-width),22rem)] origin-(--transform-origin) flex-col rounded-lg text-sm shadow-md ring-1 outline-hidden duration-100 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'

export function LineFontField({ line }: { line: 1 | 2 }) {
  const t = useT()
  const isMobile = useIsMobile()
  const typography = useAvatarStore((state) => state.config.typography)
  const setTypography = useAvatarStore((state) => state.setTypography)
  const fallbacks = useAvatarStore((state) => state.ui.fontFallbacks)
  const [open, setOpen] = useState(false)
  // 抽屉是懒加载的，挂上就等于拉 chunk，所以只在第一次点开之后才挂
  const [drawerMounted, setDrawerMounted] = useState(false)
  const labelId = useId()
  const nameId = useId()
  const fallbackId = useId()

  const font = lineFont(typography, line)
  const following = line === 2 && typography.line2.font === null
  const weights = weightsOf(font.family)
  const fallback = fallbacks.includes(fontKey(font))
  const label = t(line === 1 ? 'panel.text.line1Font' : 'panel.text.line2Font')

  const writeWeight = (weight: FontWeight): void => {
    const next = { ...font, weight }
    setTypography(
      line === 1 ? withLine1Font(typography, next, weights) : withLine2Font(typography, next),
    )
  }

  const triggerProps = {
    'data-slot': 'font-trigger',
    'aria-labelledby': `${labelId} ${nameId}`,
    'aria-describedby': fallback ? fallbackId : undefined,
    title: font.family,
    className: TRIGGER_CLASS,
  }

  const triggerContent = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        {fallback ? (
          <TriangleAlertIcon aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />
        ) : null}
        <span id={nameId} className={cn('truncate', following && 'text-muted-foreground')}>
          {displayName(font.family, font.source)}
        </span>
      </span>
      <ChevronDownIcon aria-hidden className="text-muted-foreground size-4" />
    </>
  )

  return (
    <div data-slot={`text-line${line}-font`} className="flex flex-col gap-0.5">
      <div className="flex min-h-11 items-center gap-1.5 lg:min-h-5">
        <span id={labelId} className="text-sm font-medium lg:text-[11px]">
          {label}
        </span>
        {line === 2 ? (
          <AutoToggle
            slot="font-follow"
            active={following}
            label={t('panel.text.follow')}
            ariaLabel={t('panel.text.line2Font.follow')}
            hint={t('panel.text.line2Font.followHint')}
            onClick={() => setTypography(FOLLOW_LINE1)}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2 lg:gap-1.5">
        {isMobile ? (
          <button
            type="button"
            {...triggerProps}
            onClick={() => {
              setDrawerMounted(true)
              setOpen(true)
            }}
          >
            {triggerContent}
          </button>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger {...triggerProps}>{triggerContent}</PopoverTrigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Positioner
                side="bottom"
                align="start"
                sideOffset={4}
                collisionAvoidance={PICKER_COLLISION}
                className="isolate z-50"
              >
                <PopoverPrimitive.Popup data-slot="popover-content" className={PICKER_POPUP_CLASS}>
                  {/* 占位与列表同高，第一次打开拉面板 chunk 时弹层不跳 */}
                  <Suspense
                    fallback={
                      <div className="h-[min(calc(60vh+2.75rem),calc(var(--available-height)-0.75rem))]" />
                    }
                  >
                    <FontPickerPanelLazy line={line} onDone={() => setOpen(false)} />
                  </Suspense>
                </PopoverPrimitive.Popup>
              </PopoverPrimitive.Positioner>
            </PopoverPrimitive.Portal>
          </Popover>
        )}
        {fallback ? (
          <span id={fallbackId} className="sr-only">
            {t('panel.text.fontFallback')}
          </span>
        ) : null}

        <Select
          value={font.weight}
          onValueChange={(weight) => {
            if (weight !== null) writeWeight(weight)
          }}
          disabled={weights.length <= 1}
        >
          <SelectTrigger
            data-slot="font-weight"
            aria-label={t(line === 1 ? 'panel.text.line1Weight' : 'panel.text.line2Weight')}
            className="w-30 shrink-0 text-base data-[size=default]:h-11 lg:w-28 lg:text-sm lg:data-[size=default]:h-9"
          >
            <SelectValue>{(weight: FontWeight) => t(`font.weight.${weight}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {weights.map((weight) => (
              <SelectItem
                key={weight}
                value={weight}
                className="min-h-11 text-base lg:min-h-9 lg:text-sm"
              >
                <span style={{ fontWeight: weight }}>{t(`font.weight.${weight}`)}</span>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">{weight}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isMobile && drawerMounted ? (
        <Suspense fallback={null}>
          <FontPickerDrawerLazy line={line} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </div>
  )
}
