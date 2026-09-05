/**
 * 分段控件，范式取自 @reactbits-pro/settings-form-3：
 * role="radiogroup" 包一组 label，真实 input[type=radio] 用 sr-only 藏起来，
 * 选中态靠 peer-checked 切类。比自造按钮组多拿到原生键盘与表单语义。
 *
 * 炫技层在跑时，选中底板换成一枚带 layoutId 的共享元素，在选项之间滑过去，
 * 静态的 peer-checked 底板同时让位，免得两块底板叠在一起互相打架。
 */

import { useId, type ReactNode } from 'react'
import { useShowcase } from '@/app/showcase/config'
import { SelectionIndicator } from '@/app/showcase/SelectionIndicator'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** 给了图标就只显示图标，label 退到可访问名。 */
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  /** 控件语义名。同一组件渲染两份时会各自加实例前缀，两边不会抢同一个 radio 组。 */
  name: string
  /** radiogroup 的可访问名。 */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const uid = useId()
  const showcase = useShowcase()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn('bg-muted flex w-full gap-1 rounded-lg p-1', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          // flex-1 的项默认 min-width:auto，缩不到内容的最小宽度以下，
          // 长单词（en 下的 Monochromatic）会把整组撑出容器，body 又是 overflow-x:hidden，
          // 撑出去的部分既滚不到也看不见。min-w-0 加内层 truncate 一起兜住
          className="relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center has-disabled:cursor-not-allowed has-disabled:opacity-50"
        >
          <input
            type="radio"
            className="peer sr-only"
            name={`${name}-${uid}`}
            data-group={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            aria-label={option.icon ? option.label : undefined}
            onChange={(event) => {
              if (event.target.checked) onChange(option.value)
            }}
          />
          {value === option.value ? (
            <SelectionIndicator
              id={`segmented-${name}-${uid}`}
              className="bg-primary rounded-md shadow-sm"
            />
          ) : null}
          <span
            className={cn(
              // 未选中态不用 text-muted-foreground：浅色主题下它压在 bg-muted 上只有 4.38:1，
              // 14 px 正文不达 WCAG AA 的 4.5:1。前景色压到 65% 后浅色 5.17:1、深色 6.20:1，
              // 深色的观感几乎不变（明度 0.715 到 0.740），只把浅色那一档补上来。
              // 选中态是实心主色：白底板压在浅灰槽上只差一点点亮度，一眼看不出选的是哪一格
              'text-foreground/65 relative flex h-full w-full min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors',
              'peer-hover:text-foreground peer-checked:text-primary-foreground peer-checked:font-semibold',
              !showcase && 'peer-checked:bg-primary peer-checked:shadow-sm',
              'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-3',
              'motion-reduce:transition-none',
            )}
          >
            {option.icon ?? (
              // 窄屏放不下就截断并给出省略号，完整文案挂 title
              <span className="truncate" title={option.label}>
                {option.label}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}
