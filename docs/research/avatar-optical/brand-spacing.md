---
type: Design Validation
title: 品牌头像的间距与纵向分配复核
description: 用户否定旧样张后的根因、可见墨迹测量、字体权衡与前后对照。
status: stable
generated: { by: codex/gpt-6, at: '2026-11-06T08:07:50Z' }
tags: [avatar, spacing, visual-review]
sources:
  - id: prior-optical
    resource: optical-centering.md
  - id: prior-brand
    resource: small-brand-avatars.md
  - id: measurements
    resource: references/spacing-comparison.json
  - id: user-screenshot
    resource: 用户反馈截图 libfile_d74c7debd6188191aa0bd4e3d519b089
---

# 问题与根因

用户明确否定此前 HARMAY 样张。[^user-screenshot] 旧版把 Logo 到标题与两行文字之间都设成短边 3.5%，在 32 px 下仅约 1.1 px；网页还会随整体圆裁缩放再次压缩间距。上轮验证了无裁切和有界位移，却没有充分检查三层信息的节奏。[^prior-optical] 这不能视为视觉合格。

# 方法与证据

同一客户原稿、文案、种子、512 px 输出，官方 MCP SDK 实际生成前后样张；只比较字体 600/700 和间距结构。另在网页上传真实白色 PNG 比较 600/700，不把重建 Logo 当原稿。[^prior-brand]

先按字体实际墨迹测量排版，再在输出 PNG 每个元素框中统计 RGB 三通道均大于 220 的像素，提取首末占用行。该阈值仅适用于本组深底白字，是可复核近似，细抗锯齿边缘可能有 1–2 px 差异。脚本 `scripts/measure-spacing.mjs`、原始数据如下。[^measurements]

| HARMAY 双行，512 px | 旧版 | 修正后 |
| --- | ---: | ---: |
| Logo 到主行可见间距 | 20 | 40 |
| 主行到副行可见间距 | 19 | 27 |
| 主字号 | 97.96 | 94.87 |
| 宋体字重 | 700 | 600 |
| 整组墨迹高度 | 243 | 263 |
| 上边 / 下边留白 | 135 / 134 | 124 / 125 |

32 px 下两处实际间距约 2.50 / 1.69 px，48 px 下 3.75 / 2.53 px，64 px 下 5 / 3.38 px。主字号减少约 3.1%，并非整体大幅缩小。单行间距 19→40 px，组高 161→180 px。[^measurements]

# 设计取舍与适用范围

品牌到主标题比主副行间距更宽。宽字标以短边 7.5% 作间距，其他标识 6%；有 Logo 的两行取短边 5% 与主字号 0.24em 的较大值。圆裁求解保持间距并重新居中，不把间距跟着字号压回去。这些是本项目试样后的参数，不是行业强制规范。

HARMAY 的 600 相比 700 减少中文粗重感，32–64 px 仍可辨认主要中文；既有用户字重保留。完整英文 Logo 在 32 px 仍无法保证逐字清晰。东黎保留品牌原有留白，其可见图文间距会额外增加；完整组合仍不适合要求每个品牌细字都能读清的小头像。纯文字节奏保持。

# 验证边界与修订

零裁切、间距和居中数值是必要证据，不是审美评分；几何/光学开关对照不能替代结构前后对照。没有真实飞书客户端上传验证或真人确认。2026-11-06 更新：针对用户截图修正此前的合格判断，记录原稿、字号损失与小图可读性权衡。

[^prior-optical]: 上轮光学补偿研究。
[^prior-brand]: 小尺寸品牌研究。
[^measurements]: 同种子前后 PNG 的墨迹测量数据。
[^user-screenshot]: 用户实际提供的旧样张截图。
