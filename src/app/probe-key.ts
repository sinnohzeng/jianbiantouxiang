/**
 * 取色探针的依赖投影。
 *
 * 探针要起一次离屏 WebGL 再取上百次像素，不能拿整份 config 当依赖：
 * 导出格式、体积档、形状与圆角都不进 renderGradient 与 layoutText
 * （形状遮罩在合成阶段才做），改它们却会白白跑一遍探针。
 * 这里把不相干的字段摘掉，剩下的序列化成一个字符串给 effect 当依赖。
 */

import type { AvatarConfig } from '@/state/config'

export function probeKey(config: AvatarConfig): string {
  const { canvas, exportOptions, ...rest } = config
  return JSON.stringify({
    ...rest,
    // 探针只按画布比例决定小图尺寸，遮罩形状与圆角一概不影响取色
    canvas: { width: canvas.width, height: canvas.height },
    // 底色会垫在渐变下面，参与明度判定；格式与体积档只在编码时用得上
    exportOptions: { bgColor: exportOptions.bgColor },
  })
}
