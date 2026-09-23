/**
 * 字体选择器里的一行候选项。已上传、最近使用、精选、全部与系统各组都用它，面板只管分组、搜索、上传与写入。
 *
 * 名字用字体自身渲染：Google 字体用预览别名，就绪前与失败时是界面字体；系统字体与上传字体直接用自己的 family，
 * 不走网络。有原生名的行写原生名，后面跟一段界面字体的西文 family 小字，原生名至多占行宽 65%，
 * 空间不够先截西文；没有原生名的行写西文 family。
 */

import { useCallback, type RefCallback } from 'react'
import { CommandItem } from '@/components/ui/command'
import { displayName, nameLang, type FontEntry } from '@/fonts/catalog'
import { fontFamilyStack } from '@/fonts/family'
import { isPreviewRequested, requestPreview } from '@/fonts/preview'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { FontSource } from '@/state/config'
import { FONT_NAME_CLASS, usePreviewFamily } from './use-font-preview'

/**
 * 行滚进列表视口时请求预览，下探半屏。每行在 ref 回调里建自己的观察器，root 是这次打开的列表滚动容器，
 * 观察器随行建、随行销，弹层重开时跟着新的列表节点重建。请求发出后不再观察，已请求过的字体不观察。
 */
function useFontPreview(
  entry: FontEntry | undefined,
): [ref: RefCallback<HTMLSpanElement>, family: string | null] {
  const ref = useCallback<RefCallback<HTMLSpanElement>>(
    (node) => {
      if (!node || !entry || isPreviewRequested(entry.id)) return
      const observer = new IntersectionObserver(
        (records) => {
          if (!records.some((record) => record.isIntersecting)) return
          observer.disconnect()
          requestPreview(entry)
        },
        { root: node.closest('[cmdk-list]'), rootMargin: '50% 0px' },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [entry],
  )
  return [ref, usePreviewFamily(entry)]
}

export interface FontItemProps {
  /** cmdk 的值，形如 `分组:id`，同一款字体在不同分组里各是一项。 */
  value: string
  family: string
  source: FontSource
  /** Google 字体的目录条目，预览按它请求。 */
  entry?: FontEntry
  /** 是该行当前的生效字体。 */
  checked: boolean
  onSelect: () => void
}

export function FontItem({ value, family, source, entry, checked, onSelect }: FontItemProps) {
  const t = useT()
  const [nameRef, alias] = useFontPreview(source === 'google' ? entry : undefined)
  const name = displayName(family, source)
  const native = source !== 'upload' && name !== family
  const lang = nameLang(family, source)
  const renderFamily = source === 'google' ? alias : family

  return (
    <CommandItem
      value={value}
      data-checked={checked || undefined}
      className="min-h-11 gap-2 lg:min-h-9"
      onSelect={onSelect}
    >
      <span
        ref={nameRef}
        lang={lang}
        data-preview={source === 'google' && alias ? 'ready' : undefined}
        style={renderFamily ? { fontFamily: fontFamilyStack(renderFamily) } : undefined}
        className={cn(
          FONT_NAME_CLASS,
          'text-base leading-6',
          native ? 'max-w-[65%] shrink-0' : 'min-w-0',
        )}
      >
        {name}
      </span>
      {native ? (
        <span lang="en" className="text-muted-foreground min-w-0 truncate text-xs">
          {family}
        </span>
      ) : null}
      {checked ? <span className="sr-only">{t('font.current')}</span> : null}
    </CommandItem>
  )
}
