/**
 * 引擎掉到近似渲染的原因。
 *
 * spec 要求用不上 shader 时给出明确提示，而能力探测结果带 7 天缓存，
 * 只看探测值会把运行期的失败全吞掉：缓存说有 WebGL2，实际挂载失败，
 * 界面照旧一声不响。渲染层因此把每次降级的原因报给调用方，由界面决定怎么提示。
 */
export type FallbackReason =
  /** 能力探测就说没有 WebGL2。 */
  | 'no-webgl2'
  /** 建 ShaderMount 失败或噪声贴图取不到，多半是驱动被拉黑或上下文数到顶。 */
  | 'mount-failed'
  /** 运行期上下文被浏览器判掉。 */
  | 'context-lost'
  /** 等不到画布尺寸，再画下去只会得到一张按默认 300×150 拉伸的图。 */
  | 'size-timeout'

export interface FallbackOptions {
  /** 这次渲染没用上 shader 时回调一次。回调里抛错不影响渲染结果。 */
  onFallback?: (reason: FallbackReason) => void
}

/** 统一的回调出口：调用方的回调抛错不该把渲染带崩。 */
export function notifyFallback(options: FallbackOptions, reason: FallbackReason): void {
  try {
    options.onFallback?.(reason)
  } catch {
    // 提示是附加动作，出错就算了
  }
}
