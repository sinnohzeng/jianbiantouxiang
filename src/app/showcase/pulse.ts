/**
 * 预览框的一次性弹动信号。
 *
 * 底栏与配色节的随机按钮、导出抽屉出图这几处离预览很远，为了这一下弹动
 * 把状态提到 store 里不值当：它不是配置也不进存档，撤销栈更不该记它。
 * 这里就是一个模块级的订阅表，发一次、订阅方各自播一次。
 */

const listeners = new Set<() => void>()

export function firePreviewPulse(): void {
  for (const listener of listeners) listener()
}

export function subscribePreviewPulse(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
