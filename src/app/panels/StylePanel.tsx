/**
 * 质感面板：四种 style 的卡片选择，加当前 style 自己的五个滑杆与高光。
 * 卡片缩略图用引擎的 CSS 近似层画，配色跟着当前配置走，选之前就能看出差别。
 *
 * 种子那一组按 spec §3.1 三件都给齐：手动改（输入框，留空即按文字派生）、随机、复制。
 * 顺序放在质感选择之前，换种子是最高频动作，不该藏在面板底部。
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, ShuffleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/app/clipboard'
import { PanelSection } from '@/components/blocks/panel-section'
import { RadioCardGroup, type RadioCardOption } from '@/components/blocks/radio-card-group'
import { SliderField } from '@/components/blocks/slider-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cssFallbackBackground } from '@/engine/css-fallback'
import { hashSeed, resolveSeed } from '@/engine/seed'
import { STYLE_LIST, getStyle, type StyleParamKey, type StyleParamMeta } from '@/engine/styles'
import { useT } from '@/i18n'
import type { AvatarConfig, PartialConfig, StyleId } from '@/state/config'
import { useAvatarStore } from '@/state/store'

/** 复制成功的对勾停留多久。 */
const COPIED_RESET_MS = 1600

/** 滑杆的显示口径：0..1 的参数显示成百分数，比例保留两位，角度带度数符号。 */
function displayOf(key: StyleParamKey): { scale: number; precision: number; unit: string } {
  if (key === 'scale') return { scale: 1, precision: 2, unit: '×' }
  if (key === 'rotation') return { scale: 1, precision: 0, unit: '°' }
  return { scale: 100, precision: 0, unit: '%' }
}

function thumbBackground(config: AvatarConfig, style: StyleId): string {
  // 换 seed 只为让四张缩略图彼此不同，配色仍取当前配置
  return cssFallbackBackground({ ...config, style, seed: `${resolveSeed(config)}:${style}` })
}

export function StylePanel() {
  const t = useT()
  const uid = useId()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setStyleParams = useAvatarStore((state) => state.setStyleParams)
  const randomize = useAvatarStore((state) => state.randomize)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 面板是按 activePanel 条件渲染的，切走就卸载，复位定时器得跟着清掉
  useEffect(
    () => () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    },
    [],
  )

  const seed = resolveSeed(config)
  const shortHash = (hashSeed(seed) >>> 0).toString(16).padStart(8, '0')

  const options: RadioCardOption<StyleId>[] = useMemo(
    () =>
      STYLE_LIST.map((style) => ({
        value: style.id,
        title: t(`style.${style.id}.name`),
        description: t(`style.${style.id}.desc`),
        preview: (
          <span
            aria-hidden="true"
            className="block h-14 w-full rounded-lg"
            style={{ background: thumbBackground(config, style.id) }}
          />
        ),
      })),
    [config, t],
  )

  const params: readonly StyleParamMeta[] = getStyle(config.style).params

  const copySeed = (): void => {
    void copyText(seed).then((ok) => {
      setCopied(ok)
      // 非安全上下文里根本没有 navigator.clipboard，这时按钮不能一点反应都没有
      if (!ok) {
        toast.error(t('common.copyFailed'))
        return
      }
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => {
        copiedTimer.current = null
        setCopied(false)
      }, COPIED_RESET_MS)
    })
  }

  return (
    <div className="flex flex-col">
      <PanelSection title={t('panel.style.seed')}>
        {/* 手动填种子：留空就回到按文字派生，同事发来的种子串也有地方粘 */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-seed`}>{t('panel.style.seed')}</Label>
          <Input
            id={`${uid}-seed`}
            className="h-11 font-mono"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            value={config.seed}
            onChange={(event) => setConfig({ seed: event.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <code className="bg-muted flex h-11 flex-1 items-center rounded-lg px-3 font-mono text-sm">
            {shortHash}
          </code>
          <Button
            type="button"
            variant="outline"
            className="size-11"
            aria-label={t('panel.style.seed.copy')}
            onClick={copySeed}
          >
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          </Button>
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={randomize}>
          <ShuffleIcon aria-hidden="true" />
          {t('panel.style.seed.new')}
        </Button>
        <p className="text-muted-foreground text-xs">{t('panel.style.seed.hint')}</p>
      </PanelSection>
      <PanelSection title={t('panel.style.pick')}>
        <RadioCardGroup<StyleId>
          name="style"
          label={t('panel.style.pick')}
          value={config.style}
          options={options}
          onChange={(style) => setConfig({ style })}
        />
      </PanelSection>

      <PanelSection title={t('panel.style.params')}>
        {params.map((param) => {
          const view = displayOf(param.key)
          return (
            <SliderField
              key={param.key}
              label={t(param.labelKey)}
              editLabel={t('panel.common.edit', { name: t(param.labelKey) })}
              value={config.styleParams[param.key]}
              min={param.min}
              max={param.max}
              step={param.step}
              scale={view.scale}
              precision={view.precision}
              unit={view.unit}
              onChange={(value) => {
                const patch: NonNullable<PartialConfig['styleParams']> = {}
                patch[param.key] = value
                setStyleParams(patch)
              }}
            />
          )
        })}
        <SliderField
          label={t('panel.style.highlight')}
          editLabel={t('panel.common.edit', { name: t('panel.style.highlight') })}
          value={config.highlight}
          min={0}
          max={1}
          step={0.01}
          scale={100}
          unit="%"
          onChange={(highlight) => setConfig({ highlight })}
        />
      </PanelSection>
    </div>
  )
}
