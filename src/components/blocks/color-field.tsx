/**
 * 一格颜色：原生 color input 加一个 hex 文本框，受控写法参考
 * @shadcnblocks/color-picker-color-picker-controlled-1。
 * 不引第三方取色器，原生控件在手机上就是系统调色盘，比自绘的好用。
 */

import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { normalizeHex } from '@/state/config'
import { cn } from '@/lib/utils'

/** 预设色档：常用文字色一键取，省得每次拧取色器。 */
export interface ColorPreset {
  hex: string
  label: string
}

export interface ColorFieldProps {
  /** 颜色块的可访问名。 */
  label: string
  value: string
  onChange: (hex: string) => void
  /** 是否显示 hex 文本框。 */
  showHex?: boolean
  /** hex 文本框的可访问名。 */
  hexLabel?: string
  /** 常用色预设，给了就在输入行上方多一排色块。 */
  presets?: readonly ColorPreset[]
  className?: string
}

export function ColorField({
  label,
  value,
  onChange,
  showHex = true,
  hexLabel,
  presets,
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
    <div className={cn('flex flex-col gap-2', className)}>
      {presets && presets.length > 0 ? (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const active = normalizeHex(preset.hex, '') === value.toLowerCase()
            return (
              <button
                key={preset.hex}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={preset.label}
                title={preset.label}
                onClick={() => onChange(normalizeHex(preset.hex, preset.hex))}
                className={cn(
                  // 色块按行等分而不是钉死 44 见方：预设有七个，44 的方块在挑选栏那一列
                  // 放不下第七个，末尾会孤零零折下去一个。高度仍是 44，触控热区够
                  'border-border h-11 min-w-9 flex-1 basis-9 cursor-pointer rounded-lg border transition-colors',
                  active && 'border-primary ring-ring/50 ring-3',
                )}
                style={{ backgroundColor: preset.hex }}
              />
            )
          })}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
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
    </div>
  )
}
