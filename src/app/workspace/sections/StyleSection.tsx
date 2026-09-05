/**
 * 质感节：四张 2×2 磁贴，每张用当前配色画一小张 CSS 渐变示意，选之前就看得出差别。
 * 种子在节末尾压成紧凑一行：手动填、复制、换一个，三件都在。
 * 五个参数滑杆与光感在检查器带里。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, ShuffleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/app/clipboard'
import { RadioCardGroup, type RadioCardOption } from '@/components/blocks/radio-card-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cssFallbackBackground } from '@/engine/css-fallback'
import { resolveSeed } from '@/engine/seed'
import { STYLE_LIST } from '@/engine/styles'
import { useT } from '@/i18n'
import type { AvatarConfig, StyleId } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { SectionCard } from './card'

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="style-seed">{t('panel.style.seed')}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="style-seed"
            className="h-11 flex-1 font-mono"
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
            size="icon-lg"
            className="tap-target"
            aria-label={t('panel.style.seed.copy')}
            title={t('panel.style.seed.copy')}
            onClick={copySeed}
          >
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            data-slot="seed-shuffle"
            className="tap-target"
            aria-label={t('panel.style.seed.new')}
            title={t('panel.style.seed.new')}
            onClick={randomize}
          >
            <ShuffleIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}
