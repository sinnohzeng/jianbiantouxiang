/**
 * 错误边界与 chunk 加载失败的兜底。
 *
 * 懒加载组件的 import 被拒时，React 会在 render 阶段把错误重新抛出来，
 * 没有边界接住就整棵树卸载，页面变成空白，也没有任何重试入口。
 * 站点带 hash 文件名又是 autoUpdate 的 PWA，重新部署后旧 chunk 名会失效，
 * 开着页面过夜的用户正好撞在这条路上。
 *
 * 所以分两层：每个懒加载岛各包一层，挂掉的只是那一块；整棵树再包一层，
 * 顺带在确认是模块加载失败时自动刷新一次去取新版本。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

/** chunk 拉不到时各家浏览器的说法不一样，这里按共同的词根匹配。 */
const MODULE_ERROR = /dynamically imported module|module script failed|failed to fetch dynamically/i

/** 自动刷新的一次性闸，避免真崩溃时刷成死循环。 */
const RELOAD_FLAG = 'gradient-avatar:chunk-reload'

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return MODULE_ERROR.test(message)
}

/**
 * 刷新一次去取新版本，返回是否真的发起了刷新。
 * 读不到 sessionStorage 时一律不刷：宁可停在兜底界面，也不冒无限刷新的险。
 */
export function reloadOnceForChunkError(): boolean {
  try {
    const store = globalThis.sessionStorage
    if (!store || store.getItem(RELOAD_FLAG)) return false
    store.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  globalThis.location?.reload()
  return true
}

/** 确认是模块加载失败才刷新，别把真崩溃也刷一遍。 */
export function reloadOnceForModuleError(error: unknown): boolean {
  return isModuleLoadError(error) ? reloadOnceForChunkError() : false
}

export interface ErrorBoundaryProps {
  children: ReactNode
  /** 出错后显示什么，缺省是什么都不显示。 */
  fallback?: ReactNode
  onError?: (error: unknown) => void
}

interface ErrorBoundaryState {
  failed: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[gradient-avatar]', error, info.componentStack)
    this.props.onError?.(error)
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
