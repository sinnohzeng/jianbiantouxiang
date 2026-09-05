/**
 * 画布节：尺寸预设胶囊与宽高输入、形状分段、导出底色。
 * 宽高输入框保持 16 px 字号，iOS 上聚焦不会把整页放大。
 *
 * 换形状不动边距。圆形遮罩带来的收缩由 text/fit 的 safeArea 按几何算。
 * 圆角比例在检查器带里，只在形状是圆角时出现。
 */

import { CircleIcon, SquareIcon } from 'lucide-react'
import { ColorField } from '@/components/blocks/color-field'
import { SegmentedControl } from '@/components/blocks/segmented-control'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { CANVAS_MAX, CANVAS_MIN, type Shape } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { cn } from '@/lib/utils'
import { SectionCard } from './card'

interface Preset {
  id: string
  width: number
  height: number
}

const AVATAR_PRESETS: readonly Preset[] = [
  { id: '512', width: 512, height: 512 },
  { id: '1024', width: 1024, height: 1024 },
  { id: '2048', width: 2048, height: 2048 },
  { id: '4096', width: 4096, height: 4096 },
]

const BANNER_PRESETS: readonly Preset[] = [
  { id: '1200x630', width: 1200, height: 630 },
  { id: '1500x500', width: 1500, height: 500 },
  { id: '1920x1080', width: 1920, height: 1080 },
  { id: '2560x1440', width: 2560, height: 1440 },
]

const PORTRAIT_PRESETS: readonly Preset[] = [
  { id: '1080x1920', width: 1080, height: 1920 },
  { id: '1080x1440', width: 1080, height: 1440 },
]

function clampSide(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.round(value)))
}

export function CanvasSection() {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setCanvas = useAvatarStore((state) => state.setCanvas)
  const setExportOptions = useAvatarStore((state) => state.setExportOptions)

  const canvas = config.canvas
  const isActive = (preset: Preset): boolean =>
    canvas.width === preset.width && canvas.height === preset.height

  const renderPresets = (list: readonly Preset[], groupLabel: string) => (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-1.5">
      {list.map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-pressed={isActive(preset)}
          className={cn(
            'border-border hover:border-foreground/30 focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-sm tabular-nums transition-colors focus-visible:ring-3 focus-visible:outline-none motion-reduce:transition-none',
            isActive(preset) && 'border-primary bg-primary text-primary-foreground',
          )}
          onClick={() => setCanvas({ width: preset.width, height: preset.height })}
        >
          {preset.width === preset.height ? preset.width : `${preset.width}×${preset.height}`}
        </button>
      ))}
    </div>
  )

  return (
    <SectionCard title={t('panel.canvas.title')}>
      <div className="flex flex-col gap-1.5">
        <Label>{t('panel.canvas.preset.avatar')}</Label>
        {renderPresets(AVATAR_PRESETS, t('panel.canvas.preset.avatar'))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('panel.canvas.preset.banner')}</Label>
        {renderPresets(BANNER_PRESETS, t('panel.canvas.preset.banner'))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('panel.canvas.preset.portrait')}</Label>
        {renderPresets(PORTRAIT_PRESETS, t('panel.canvas.preset.portrait'))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('panel.canvas.preset.custom')}</Label>
        <div className="flex items-center gap-2">
          <Input
            className="h-11"
            type="number"
            inputMode="numeric"
            min={CANVAS_MIN}
            max={CANVAS_MAX}
            aria-label={t('panel.canvas.width')}
            value={canvas.width}
            onChange={(event) =>
              setCanvas({ width: clampSide(event.target.valueAsNumber, canvas.width) })
            }
          />
          <span aria-hidden="true" className="text-muted-foreground text-sm">
            ×
          </span>
          <Input
            className="h-11"
            type="number"
            inputMode="numeric"
            min={CANVAS_MIN}
            max={CANVAS_MAX}
            aria-label={t('panel.canvas.height')}
            value={canvas.height}
            onChange={(event) =>
              setCanvas({ height: clampSide(event.target.valueAsNumber, canvas.height) })
            }
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {t('panel.canvas.range', { min: CANVAS_MIN, max: CANVAS_MAX })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('panel.canvas.shape')}</Label>
        <SegmentedControl<Shape>
          name="canvas-shape"
          label={t('panel.canvas.shape')}
          value={canvas.shape}
          options={[
            {
              value: 'square',
              label: t('panel.canvas.shape.square'),
              icon: <SquareIcon className="rounded-none" />,
            },
            {
              value: 'rounded',
              label: t('panel.canvas.shape.rounded'),
              icon: <SquareIcon className="rounded-md" />,
            },
            {
              value: 'circle',
              label: t('panel.canvas.shape.circle'),
              icon: <CircleIcon />,
            },
          ]}
          onChange={(shape) => setCanvas({ shape })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('export.bg')}</Label>
        <ColorField
          label={t('export.bg')}
          hexLabel={t('panel.common.hex')}
          value={config.exportOptions.bgColor}
          onChange={(bgColor) => setExportOptions({ bgColor })}
        />
        <p className="text-muted-foreground text-xs">{t('export.bg.hint')}</p>
      </div>
    </SectionCard>
  )
}
