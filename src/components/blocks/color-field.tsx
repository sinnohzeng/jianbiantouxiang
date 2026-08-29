/**
 * 一格颜色：原生 color input 加一个 hex 文本框，受控写法参考
 * @shadcnblocks/color-picker-color-picker-controlled-1。
 * 不引第三方取色器，原生控件在手机上就是系统调色盘，比自绘的好用。
 */

import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { normalizeHex } from '@/state/config'
import { cn } from '@/lib/utils'

export interface ColorFieldProps {
  /** 颜色块的可访问名。 */
  label: string
  value: string
  onChange: (hex: string) => void
  /** 是否显示 hex 文本框。 */
  showHex?: boolean
  /** hex 文本框的可访问名。 */
  hexLabel?: string
  className?: string
}

export function ColorField({
  label,
  value,
  onChange,
  showHex = true,
  hexLabel,
  className,
}: ColorFieldProps) {
  const id = useId()
  // draft 为 null 就显示外部值，用户一动才切成自己的草稿，省掉同步用的 effect
  const [draft, setDraft] = useState<string | null>(null)

  const commitHex = (raw: string): void => {
    setDraft(null)
    const hex = normalizeHex(raw.startsWith('#') ? raw : `#${raw}`, '')
    if (hex) onChange(hex)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(normalizeHex(event.target.value, value))}
        className="border-border size-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
      />
      {showHex ? (
        <Input
          className="h-11 font-mono uppercase"
          aria-label={hexLabel ?? label}
          spellCheck={false}
          autoComplete="off"
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commitHex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitHex(event.currentTarget.value)
          }}
        />
      ) : null}
    </div>
  )
}
