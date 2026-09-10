/**
 * 填充态磁贴旁显示的名字。
 *
 * `icon.id` 是 `tree-palm`、`1f334` 这种机器标识，摆给人看等于没看。
 * 四种来源各自有本地化名字：内置图标有中英文、emoji 有五语标签、品牌有中英文、
 * 上传有原文件名。索引与标签都是懒 chunk（首屏预算不带它们），所以这里按需 import，
 * 解析期间先显示 id，拿到名字再换。
 */

import { useEffect, useState } from 'react'
import { useLocale, type Locale } from '@/i18n'
import { getUploadedGraphicName } from './upload'
import type { IconSource } from '@/state/config'

function isCjk(locale: Locale): boolean {
  return locale === 'zh-CN' || locale === 'zh-HK'
}

async function resolve(source: IconSource, id: string, locale: Locale): Promise<string | null> {
  if (source === 'builtin') {
    const { CURATED_ICONS } = await import('./curated')
    const hit = CURATED_ICONS.find((entry) => entry.name === id)
    return hit ? (isCjk(locale) ? hit.zh : hit.en) : null
  }
  if (source === 'emoji') {
    const { loadEmojiEntries } = await import('./emoji-index')
    const entries = await loadEmojiEntries(locale)
    return entries.find((entry) => entry.id === id)?.label ?? null
  }
  if (source === 'brand') {
    const { BRAND_INDEX } = await import('./generated/brand-index')
    const hit = BRAND_INDEX.find((entry) => entry.id === id)
    return hit ? (isCjk(locale) ? hit.zh : hit.en) : null
  }
  if (source === 'upload') {
    return getUploadedGraphicName(id)
  }
  return null
}

export function useGraphicLabel(source: IconSource, id: string): string {
  const { locale } = useLocale()
  const key = `${source}:${id}:${locale}`
  const [resolved, setResolved] = useState<{ key: string; label: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    void resolve(source, id, locale).then((label) => {
      if (alive) setResolved({ key, label })
    })
    return () => {
      alive = false
    }
  }, [source, id, locale, key])

  return resolved?.key === key ? (resolved.label ?? id) : id
}
