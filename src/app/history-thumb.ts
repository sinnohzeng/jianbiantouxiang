/**
 * 历史条真缩略图。
 *
 * pushHistory 保持纯函数，缩略图由导出、随机这些调用方在推入后异步补写。
 * 按配置哈希定位条目，不按数组下标：渲染期间用户再推一条新历史也不会贴错。
 */

import { releaseCanvas } from '@/export/canvas'
import { composeAvatar } from '@/export/compose'
import { configHash } from '@/state/config'
import { useAvatarStore } from '@/state/store'

const THUMB_SIZE = 96
const inflight = new Set<string>()

export function queueHistoryThumbnail(): void {
  const entry = useAvatarStore.getState().history[0]
  if (!entry || entry.thumb) return
  const hash = configHash(entry.config)
  if (inflight.has(hash)) return
  inflight.add(hash)

  void composeAvatar(entry.config, THUMB_SIZE, THUMB_SIZE)
    .then((canvas) => {
      try {
        const thumb = canvas.toDataURL('image/jpeg', 0.7)
        useAvatarStore.getState().attachThumb(hash, thumb)
      } finally {
        releaseCanvas(canvas)
      }
    })
    .catch(() => {
      // 缩略图只是识别辅助，失败就继续用配色近似，不影响历史本身
    })
    .finally(() => {
      inflight.delete(hash)
    })
}

/** 测试与异常恢复用：清掉进行中的标记。 */
export function clearHistoryThumbnailQueue(): void {
  inflight.clear()
}
