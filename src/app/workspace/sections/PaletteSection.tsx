/**
 * 配色节：随机主按钮、明暗与家族筛选、四列渐变磁贴，自定义色与种子生成器折在末尾。
 * 磁贴是真实渐变缩略图而不是圆点，选色时看到的就是画面里的走向。
 */

import { useId, useMemo, useState } from 'react'
import { PlusIcon, ShuffleIcon, XIcon } from 'lucide-react'
import { ColorField } from '@/components/blocks/color-field'
import { PanelSection } from '@/components/blocks/panel-section'
import { SegmentedControl } from '@/components/blocks/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { queueHistoryThumbnail } from '@/app/history-thumb'
import { BurstFlash, useBurst } from '@/app/showcase/Burst'
import { useShowcase } from '@/app/showcase/config'
import { SelectionIndicator } from '@/app/showcase/SelectionIndicator'
import { paletteThumbCss, parseHexList } from '@/palettes/color'
import { harmonize, type HarmonyScheme } from '@/palettes/harmony'
import {
  PALETTES,
  PALETTE_FAMILIES,
  paletteColors,
  type PaletteFamilyId,
  type PaletteTone,
} from '@/palettes/palettes'
import { useLocale, useT } from '@/i18n'
import { normalizeHex } from '@/state/config'
import { useAvatarStore } from '@/state/store'
import { SectionCard } from './card'

type ToneFilter = 'all' | PaletteTone
type FamilyFilter = 'all' | PaletteFamilyId

const CUSTOM_MIN = 2
const CUSTOM_MAX = 6

export function PaletteSection() {
  const t = useT()
  const uid = useId()
  const { locale } = useLocale()
  const config = useAvatarStore((state) => state.config)
  const setConfig = useAvatarStore((state) => state.setConfig)
  const randomize = useAvatarStore((state) => state.randomize)
  const pushHistory = useAvatarStore((state) => state.pushHistory)

  const showcase = useShowcase()
  const burst = useBurst()

  const [tone, setTone] = useState<ToneFilter>('all')
  const [family, setFamily] = useState<FamilyFilter>('all')
  const [seed1, setSeed1] = useState('#5fb4f5')
  const [seed2, setSeed2] = useState('')
  const [seedTone, setSeedTone] = useState<PaletteTone>('light')
  const [scheme, setScheme] = useState<HarmonyScheme>('analogous')
  const [plateHint, setPlateHint] = useState(false)
  const [pasted, setPasted] = useState('')

  const visible = useMemo(
    () =>
      PALETTES.filter(
        (palette) =>
          (tone === 'all' || palette.tone === tone) &&
          (family === 'all' || palette.family === family),
      ),
    [tone, family],
  )

  /** 自定义区没存过色时，先拿当前配色当草稿，用户一改就落到 custom。 */
  const customColors =
    config.customColors.length >= CUSTOM_MIN
      ? config.customColors
      : paletteColors(config).slice(0, 4)

  const writeCustom = (colors: string[]): void => {
    setConfig({ palette: 'custom', customColors: colors })
  }

  const familyItems = useMemo(() => {
    const items: Record<string, string> = { all: t('panel.palette.family.all') }
    for (const item of PALETTE_FAMILIES) items[item.id] = item.name[locale]
    return items
  }, [locale, t])

  const generate = (): void => {
    const base = normalizeHex(seed1, '')
    if (!base) return
    const second = normalizeHex(seed2, '')
    const result = harmonize(base, {
      tone: seedTone,
      scheme,
      ...(second ? { seed2: second } : {}),
    })
    setPlateHint(result.plate)
    writeCustom(result.colors.slice(0, CUSTOM_MAX))
  }

  return (
    <SectionCard title={t('panel.palette.title')}>
      {/* 与底栏同一个动作提到一级：换种子就是换一张，最高频，放在配色节顶上 */}
      <span className="relative flex">
        <Button
          type="button"
          data-slot="palette-shuffle"
          className="tap-target h-11 w-full"
          title={t('bottombar.random.hint')}
          onClick={() => {
            randomize()
            pushHistory()
            queueHistoryThumbnail()
            burst.fire()
          }}
        >
          <ShuffleIcon aria-hidden />
          {t('bottombar.random')}
        </Button>
        <BurstFlash token={burst.token} />
      </span>

      <div className="flex flex-col gap-2">
        <SegmentedControl<ToneFilter>
          name="palette-tone"
          label={t('panel.palette.tone')}
          value={tone}
          options={[
            { value: 'all', label: t('panel.palette.tone.all') },
            { value: 'light', label: t('panel.palette.tone.light') },
            { value: 'dark', label: t('panel.palette.tone.dark') },
          ]}
          onChange={setTone}
        />
        <Select
          items={familyItems}
          value={family}
          onValueChange={(next) => {
            if (typeof next === 'string') setFamily(next as FamilyFilter)
          }}
        >
          {/* 原语给的 data-[size=default]:h-8 带变体，优先级压过裸 h-11，只能同样带变体覆盖 */}
          <SelectTrigger
            className="w-full data-[size=default]:h-11"
            aria-label={t('panel.palette.family')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(familyItems).map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">{t('panel.palette.empty')}</p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t('panel.palette.builtin')}
          className="grid grid-cols-4 gap-2"
        >
          {visible.map((palette) => {
            const active = config.palette === palette.id
            const thumb = paletteThumbCss(palette.colors)
            return (
              <label key={palette.id} className="relative cursor-pointer">
                <input
                  type="radio"
                  className="peer sr-only"
                  name={`palette-${uid}`}
                  data-group="palette"
                  value={palette.id}
                  checked={active}
                  onChange={(event) => {
                    if (event.target.checked) setConfig({ palette: palette.id })
                  }}
                />
                {/* 炫技层在跑时选中描边是一枚共享元素，在磁贴之间滑过去 */}
                {active ? (
                  <SelectionIndicator
                    id={`palette-tile-${uid}`}
                    className="ring-foreground/55 rounded-xl ring-2"
                  />
                ) : null}
                {/* 关掉炫技层时退回原来的做法：外层垫一圈本配色的渐变，内层缩进 3 px 露出来 */}
                <span
                  className="peer-focus-visible:ring-ring/50 flex flex-col gap-1 rounded-xl p-[3px] peer-focus-visible:ring-3"
                  style={active && !showcase ? { backgroundImage: thumb } : undefined}
                >
                  <span
                    aria-hidden="true"
                    className="border-border/60 block h-14 w-full rounded-lg border"
                    style={{ backgroundImage: thumb }}
                  />
                  <span className="truncate text-center text-[11px] leading-tight">
                    {palette.name[locale]}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      )}

      <PanelSection title={t('panel.palette.custom')} defaultOpen={false}>
        <p className="text-muted-foreground text-xs">{t('panel.palette.custom.hint')}</p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-paste`}>{t('panel.palette.custom.paste')}</Label>
          {/* 凑够两个有效色就直接应用，不再多一颗“应用”按钮；不够两个就当用户还在打字 */}
          <Textarea
            id={`${uid}-paste`}
            className="min-h-16 font-mono text-base md:text-base"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder="#fde68a, #a5f3fc"
            value={pasted}
            onChange={(event) => {
              const raw = event.target.value
              setPasted(raw)
              const colors = parseHexList(raw)
              if (colors.length >= CUSTOM_MIN) writeCustom(colors.slice(0, CUSTOM_MAX))
            }}
          />
          <p className="text-muted-foreground text-xs">{t('panel.palette.custom.paste.hint')}</p>
        </div>

        <span
          aria-hidden="true"
          className="border-border block h-11 w-full rounded-lg border"
          style={{ backgroundImage: paletteThumbCss(customColors) }}
        />
        <div className="flex flex-col gap-2">
          {customColors.map((color, index) => (
            <div key={`${index}-${color}`} className="flex items-center gap-2">
              <ColorField
                className="flex-1"
                label={t('panel.palette.custom.colorAt', { index: index + 1 })}
                hexLabel={t('panel.palette.custom.hexAt', { index: index + 1 })}
                value={color}
                onChange={(hex) => {
                  const next = [...customColors]
                  next[index] = hex
                  writeCustom(next)
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="size-11"
                aria-label={t('panel.palette.custom.removeAt', { index: index + 1 })}
                disabled={customColors.length <= CUSTOM_MIN}
                onClick={() => writeCustom(customColors.filter((_, i) => i !== index))}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={customColors.length >= CUSTOM_MAX}
          onClick={() => writeCustom([...customColors, customColors.at(-1) ?? '#ffffff'])}
        >
          <PlusIcon aria-hidden="true" />
          {t('panel.palette.custom.add')}
        </Button>
      </PanelSection>

      <PanelSection title={t('panel.palette.seed')} defaultOpen={false}>
        <div className="flex flex-col gap-1.5">
          {/* ColorField 内部那个 input[type=color] 的 id 是 useId 生成的，外面拿不到，
              所以这里不写 htmlFor：可访问名由 ColorField 自己的 aria-label 给 */}
          <Label>{t('panel.palette.seed.base')}</Label>
          <ColorField
            label={t('panel.palette.seed.base')}
            hexLabel={t('panel.common.hex')}
            value={normalizeHex(seed1, '#5fb4f5')}
            onChange={setSeed1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="palette-seed-2">{t('panel.palette.seed.second')}</Label>
          <Input
            id="palette-seed-2"
            className="h-11 font-mono uppercase"
            spellCheck={false}
            autoComplete="off"
            placeholder="#f5a15f"
            value={seed2}
            onChange={(event) => setSeed2(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.palette.seed.tone')}</Label>
          <SegmentedControl<PaletteTone>
            name="palette-seed-tone"
            label={t('panel.palette.seed.tone')}
            value={seedTone}
            options={[
              { value: 'light', label: t('panel.palette.tone.light') },
              { value: 'dark', label: t('panel.palette.tone.dark') },
            ]}
            onChange={setSeedTone}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t('panel.palette.seed.scheme')}</Label>
          <SegmentedControl<HarmonyScheme>
            name="palette-seed-scheme"
            label={t('panel.palette.seed.scheme')}
            value={scheme}
            options={[
              { value: 'analogous', label: t('panel.palette.seed.analogous') },
              { value: 'split', label: t('panel.palette.seed.split') },
              { value: 'duo', label: t('panel.palette.seed.mono') },
            ]}
            onChange={setScheme}
          />
        </div>
        <Button type="button" className="h-11" onClick={generate}>
          {t('panel.palette.seed.apply')}
        </Button>
        {plateHint ? (
          <p className="text-muted-foreground text-xs">{t('panel.palette.seed.plate')}</p>
        ) : null}
      </PanelSection>
    </SectionCard>
  )
}
