import { DEFAULT_CONFIG, normalizeConfig, type AvatarConfig } from '@/state/config'

/** hash 参数名，完整形态是 `#c=<base64url>`。 */
export const HASH_PARAM = 'c'

const HASH_PREFIX = `#${HASH_PARAM}=`
const BASE64URL_RE = /^[A-Za-z0-9_-]*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 逐层比较，只留下与基准不同的字段；整棵子树都相同时返回 undefined。
 * 数组与标量按序列化结果比较，配色这类小数组不值得再做逐项 diff。
 */
function diff(value: unknown, base: unknown): unknown {
  if (isRecord(value) && isRecord(base)) {
    const out: Record<string, unknown> = {}
    let changed = false
    for (const key of Object.keys(value)) {
      const sub = diff(value[key], base[key])
      if (sub !== undefined) {
        out[key] = sub
        changed = true
      }
    }
    return changed ? out : undefined
  }
  return JSON.stringify(value) === JSON.stringify(base) ? undefined : value
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string | null {
  if (!BASE64URL_RE.test(encoded)) return null
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = padded.length % 4
  try {
    const binary = atob(remainder === 0 ? padded : padded + '='.repeat(4 - remainder))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/**
 * 编码成 `#c=<base64url>`。只写与默认配置不同的字段，链接长度随改动量增长，
 * 默认状态下只有几个字符。版本号与默认值相同时同样省略，解码端按缺省即旧版处理。
 */
export function encodeConfigToHash(config: AvatarConfig): string {
  // 上传图形只属于本次会话。写进链接会让对方拿到一个不存在的会话 id，
  // 分享时降级成空来源，接收方仍能通过文字与版式复现，再自行上传自己的图形。
  const shared =
    config.layout.icon.source === 'upload'
      ? {
          ...config,
          layout: { ...config.layout, icon: { source: 'none', id: '' } },
        }
      : config
  const payload = diff(shared, DEFAULT_CONFIG)
  return HASH_PREFIX + toBase64Url(JSON.stringify(isRecord(payload) ? payload : {}))
}

/** hash 里那段配置载荷，没有这个参数时是 undefined。 */
function configEntryOf(hash: string): string | undefined {
  if (typeof hash !== 'string') return undefined
  const query = hash.startsWith('#') ? hash.slice(1) : hash
  return query.split('&').find((part) => part.startsWith(`${HASH_PARAM}=`))
}

/**
 * hash 里带着配置载荷、却读不出配置：链接在传播途中被截断或改写了。
 * 与「压根没有配置参数」区分开，后者只是页面上的普通锚点，不该报错。
 */
export function hasBrokenConfigHash(hash: string): boolean {
  return configEntryOf(hash) !== undefined && decodeConfigFromHash(hash) === null
}

/**
 * 解码 hash。任何一环出问题都返回 null，让调用方回落到 localStorage 或默认配置：
 * 少前缀、base64 坏、JSON 坏、载荷不是对象、版本号既不是 3 也不是 4。
 * v3 载荷交给 `normalizeConfig` 迁移：三行并两行，退役字段忽略。
 */
export function decodeConfigFromHash(hash: string): AvatarConfig | null {
  const entry = configEntryOf(hash)
  if (entry === undefined) return null

  const json = fromBase64Url(entry.slice(HASH_PARAM.length + 1))
  if (json === null) return null

  let payload: unknown
  try {
    payload = JSON.parse(json)
  } catch {
    return null
  }
  if (!isRecord(payload)) return null
  if (payload.v !== undefined && payload.v !== 3 && payload.v !== 4) return null

  return normalizeConfig(payload)
}

/** 拼一条可分享的完整链接，导出面板的“复制链接”用。 */
export function buildShareUrl(config: AvatarConfig, base?: string): string {
  const origin =
    base ??
    (typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}${window.location.search}`)
  return `${origin}${encodeConfigToHash(config)}`
}
