/**
 * 质感节：四张 2×2 磁贴，每张用当前配色画一小张 CSS 渐变示意，选之前就看得出差别。
 * 种子在节末尾压成紧凑一行：手动填、复制、换一个，三件都在。
 * 五个参数滑杆与光感收在节末的“参数”折叠组里，默认收起。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, ShuffleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/app/clipboard'
import { PanelSection } from '@/components/blocks/panel-section'
import { RadioCardGroup, type RadioCardOption } from '@/components/blocks/radio-card-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cssFallbackBackground } from '@/engine/css-fallback'
import { resolveSeed } from '@/engine/seed'
import { getStyle, STYLE_LIST } from '@/engine/styles'
import { useT } from '@/i18n'
import { DEFAULT_CONFIG, type AvatarConfig, type PartialConfig, type StyleId } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { SectionCard } from './card'
import { displayOf, Row } from './row'

/** 复制成功的对勾停留多久。 */
const COPIED_RESET_MS = 1600

function thumbBackground(config: AvatarConfig, style: StyleId): string {
  // 换 seed 只为让四张缩略图彼此不同，配色仍取当前配置
  return cssFallbackBackground({ ...config, style, seed: `${resolveSeed(config)}:${style}` })
}

export function StyleSection() {
  const t = useT()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const setStyleParams = useAvatarStore((state) => state.setStyleParams)
  const randomize = useAvatarStore((state) => state.randomize)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    },
    [],
  )

  const seed = resolveSeed(config)
  const selectedDescription = t(`style.${config.style}.desc`)
  const params = getStyle(config.style).params

  const options: RadioCardOption<StyleId>[] = useMemo(
    () =>
      STYLE_LIST.map((style) => ({
        value: style.id,
        title: t(`style.${style.id}.name`),
        description: t(`style.${style.id}.desc`),
        preview: (
          <span
            aria-hidden="true"
            className="block h-9 w-full rounded-md"
            style={{ background: thumbBackground(config, style.id) }}
          />
        ),
      })),
    [config, t],
  )

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
    <SectionCard title={t('panel.style.title')}>
      <RadioCardGroup<StyleId>
        name="style"
        label={t('panel.style.pick')}
        value={config.style}
        options={options}
        onChange={(style) => setConfig({ style })}
      />

      {/* 卡内只留名字之后，描述在这里常显一行：触屏没有 hover，不能只活在 title 里 */}
      <p className="text-muted-foreground truncate text-[11px]" title={selectedDescription}>
        {selectedDescription}
      </p>

      <div className="flex items-center gap-1.5">
        <label
          htmlFor="style-seed"
          className="text-muted-foreground shrink-0 text-[11px] font-medium"
        >
          {t('panel.style.seed')}
        </label>
        <Input
          id="style-seed"
          className="h-11 min-w-0 flex-1 font-mono lg:h-8"
          title={t('panel.style.seed.hint')}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          value={config.seed}
          onChange={(event) => setConfig({ seed: event.target.value })}
        />
        <Button
          type="button"
          variant="outline"
          className="size-11 shrink-0 lg:size-8"
          aria-label={t('panel.style.seed.copy')}
          title={t('panel.style.seed.copy')}
          onClick={copySeed}
        >
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-slot="seed-shuffle"
          className="size-11 shrink-0 lg:size-8"
          aria-label={t('panel.style.seed.new')}
          title={t('panel.style.seed.new')}
          onClick={randomize}
        >
          <ShuffleIcon aria-hidden="true" />
        </Button>
      </div>

      {/* 参数随质感换一套，光感跟着一起：它们改的是同一张画面的质地 */}
      <PanelSection
        data-slot="style-group-params"
        title={t('panel.style.group.params')}
        defaultOpen={false}
      >
        {params.map((param) => {
          const view = displayOf(param.key)
          return (
            <Row
              key={param.key}
              label={t(param.labelKey)}
              value={config.styleParams[param.key]}
              defaultValue={DEFAULT_CONFIG.styleParams[param.key]}
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
        <Row
          label={t('panel.style.highlight')}
          value={config.highlight}
          defaultValue={DEFAULT_CONFIG.highlight}
          min={0}
          max={1}
          step={0.01}
          scale={100}
          unit="%"
          onChange={(highlight) => setConfig({ highlight })}
        />
      </PanelSection>
    </SectionCard>
  )
}
