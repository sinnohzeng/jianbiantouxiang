import type { LucideIconNode } from '../src/graphics/types'

export interface LucideIconSource {
  name: string
  node: readonly LucideIconNode[]
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 过滤与排序，生成物保持稳定；名字不合法当场报错，避免悄悄丢图标。 */
export function lucideIconEntries(sources: readonly LucideIconSource[]): LucideIconSource[] {
  const entries = sources
    .filter((source) => NAME_RE.test(source.name) && source.node.length > 0)
    .map((source) => ({ name: source.name, node: source.node }))
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return entries
}

/** 生成运行时索引文件。产物不手改，生成命令写在文件头。 */
export function serializeLucideIcons(
  entries: readonly LucideIconSource[],
  constName: 'LUCIDE_ICONS' | 'LUCIDE_CURATED',
  generator: string,
): string {
  const body = entries
    .map((entry) => `  ${JSON.stringify(entry.name)}: ${JSON.stringify(entry.node)},`)
    .join('\n')
  return `/**\n * 由 ${generator} 生成，不要手改。\n * lucide-react 1.37.0，ISC。\n */\nimport type { LucideIconNode } from '../types'\n\nexport const ${constName}: Record<string, LucideIconNode[]> = {\n${body}\n}\n`
}
