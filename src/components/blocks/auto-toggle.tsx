/**
 * “自动”与“跟随”共用的开关钮，从 SliderField 的自动钮抽出，字号滑杆与第二行字体行都用它。
 *
 * 按下态表示这个值由系统派生：第一行字号由求解器填满，第二行的字号与字体跟随第一行。
 * 钮上写的是按下去会发生的事，按下态再点不做事，所以按下态带 aria-disabled，焦点与提示照留。
 *
 * 可见尺寸保持致密，热区靠伪元素撑：上下各扩 11 px，手机上 22 px 高的钮凑满 44 px；
 * 桌面四边各扩 4 px。
 */

import { cn } from '@/lib/utils'

export interface AutoToggleProps {
  active: boolean
  /** 钮上的可见文字，如“自动”“跟随”。 */
  label: string
  /** 带行名全称的可访问名，要包含可见文字，如“第二行字体跟随第一行”。不给就读可见文字。 */
  ariaLabel?: string
  hint?: string
  onClick: () => void
  /** data-slot，测试与样式按它认钮。 */
  slot: string
  disabled?: boolean
}

export function AutoToggle({
  active,
  label,
  ariaLabel,
  hint,
  onClick,
  slot,
  disabled = false,
}: AutoToggleProps) {
  return (
    <button
      type="button"
      data-slot={slot}
      aria-pressed={active}
      aria-disabled={active || undefined}
      aria-label={ariaLabel}
      title={hint}
      disabled={disabled}
      onClick={() => {
        if (!active) onClick()
      }}
      className={cn(
        'focus-visible:ring-ring/50 relative shrink-0 rounded-md border px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
        'after:absolute after:-inset-x-1 after:-inset-y-[11px] lg:after:-inset-1',
        'lg:h-5 lg:px-1 lg:text-[11px]',
        active
          ? 'border-primary bg-primary text-primary-foreground cursor-default'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
