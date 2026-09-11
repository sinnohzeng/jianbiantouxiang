/**
 * 一格颜色：原生 color input 加一个 hex 文本框，受控写法参考
 * @shadcnblocks/color-picker-color-picker-controlled-1。
 * 不引第三方取色器，原生控件在手机上就是系统调色盘，比自绘的好用。
 *
 * 两种形态。默认是两行：上面一排预设，下面取色器加 hex 框，自定义配色与种子色都用它。
 * `inline` 是一行：行内标签、预设、一个取色器，没有 hex 框。文字色用它，
 * 因为文字色只在明暗轴上挑，敲 hex 的场合已经由取色器覆盖，多一个框只是占掉一整行。
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
  /** 是否显示 hex 文本框。`inline` 形态下恒为否。 */
  showHex?: boolean
  /** hex 文本框的可访问名。 */
  hexLabel?: string
  /** 常用色预设，给了就在输入行上方多一排色块；`inline` 形态下与取色器同一行。 */
  presets?: readonly ColorPreset[]
  /** 收成一行：行内标签、预设、取色器。 */
  inline?: boolean
  /** `inline` 形态下行首那个可见标签。 */
  rowLabel?: string
  className?: string
}

export function ColorField({
  label,
  value,
  onChange,
  showHex = true,
  hexLabel,
  presets,
  inline = false,
  rowLabel,
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

  const swatches =
    presets && presets.length > 0 ? (
      <div
        role="radiogroup"
        aria-label={label}
        className={cn('flex flex-wrap gap-1.5', inline && 'min-w-0 flex-1')}
      >
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
                // 色块按行等分而不是钉死 44 见方：一行摆五到七个，44 的方块在挑选栏那一列
                // 放不下最后一个，末尾会孤零零折下去一个。高度仍是 44，触控热区够
                'border-border h-11 min-w-9 flex-1 basis-9 cursor-pointer rounded-lg border transition-colors',
                'lg:h-8',
                active && 'border-primary ring-ring/50 ring-3',
              )}
              style={{ backgroundColor: preset.hex }}
            />
          )
        })}
      </div>
    ) : null

  const picker = (
    <input
      id={id}
      type="color"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(normalizeHex(event.target.value, value))}
      className="border-border size-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1 lg:size-9"
    />
  )

  if (inline) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {rowLabel ? (
          <span className="text-muted-foreground shrink-0 text-[11px] font-medium">{rowLabel}</span>
        ) : null}
        {swatches}
        {picker}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {swatches}
      <div className="flex items-center gap-2">
        {picker}
        {showHex ? (
          <Input
            className="h-11 font-mono uppercase lg:h-9"
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
