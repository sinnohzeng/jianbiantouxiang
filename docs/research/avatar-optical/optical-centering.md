---
type: Research Reference
title: 整行与整组的光学补偿
description: 真实字体测量、有界修正及客户样张的可复现证据与限制。
status: stable
generated: { by: codex/gpt-6, at: '2026-11-06T07:17:40Z' }
tags: [avatar, typography, visual-review]
review_scope: source-backed engineering decisions; subjective appearance is not human-approved
sources:
  - id: hmtx
    resource: https://learn.microsoft.com/en-us/typography/opentype/otspec190/hmtx
  - id: clreq
    resource: https://www.w3.org/TR/clreq/#baselines
  - id: font-license
    resource: https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE
  - id: implementation
    resource: https://github.com/sinnohzeng/jianbiantouxiang/blob/main/src/text/optical.ts
---

# 整行与整组的光学补偿

2026-11-06。字体 advance、可见墨迹框与 alpha 质心是三个不同量。OpenType 的 advance 与 side bearing 定义布局推进距离，并不要求墨迹等重。[^hmtx] [Microsoft hmtx](https://learn.microsoft.com/en-us/typography/opentype/otspec190/hmtx)。[W3C 中文排版基线说明](https://www.w3.org/TR/clreq/#baselines)提供字框与基线的排版语境[^clreq]，不给出“将每个字的像素质心归零”的规则。

本项目保留字体设计字距，先以实际加载字体的墨迹度量作几何布局，再对整行做有限修正。alpha 质心只产生阻尼建议：25% 的偏差、低于短边 0.4% 的偏差忽略；横移再限 0.02em，纵向整组限短边 1.5%。任意边界约束不满足就减少位移，不能为校正牺牲字号。此参数是工程选择，不是视觉实验测定值；关闭补偿的输出始终作为对照。

“飞”“厂”等不对称字证明质心归零可能破坏字体本有节奏。必须比较整行和 Logo+文字整组，不逐字纠正，不把指标降低认作审美提升。透明输入默认先去除画布空边；东黎素材按品牌说明保留内置约 9% 长边留白，是明确例外。

## 实际验证与边界

官方 SDK MCP 在 Chromium 实际出图：几何/补偿成对，原图 512，圆裁预览 24/32/48/64 px。HARMAY 为用户提供真实 SVG，宋体 500/700 另在网页比较，700 小尺寸笔画更稳，仍无法保证极细英文衬线在 32 px 可辨。东黎小头像使用山羊图形优于山羊+英文+中文完整组合；完整组合留作诊断和大尺寸选项。

首批 512 px 双行测量：纯文字“飞书/效率先锋”横移 -2.01/0 px、整组上移 6.10 px；HARMAY“飞书对接/外部群”横移 -1.96/-1.47 px、整组下移 0.72 px。东黎图形与横版的建议上移被圆裁边界限制为 0，未缩小文字来制造指标改善。数据是此字体、内容和种子的结果，不能外推所有字形。

复现：`node scripts/optical-review.mjs <输出目录> [私有 HARMAY SVG 路径]`。检查 metadata 的越界、字号不变、位移上限和告警；人工同时检查文字节奏、Logo 保真与小尺寸。自动校验不能保证所有主观审美达到某个分数，尚未完成真实飞书客户端上传对照。

字体为 Noto Serif SC 700，SIL OFL 1.1，保留许可[^font-license]；按 Unicode 分片并按需加载，不将全部宋体字库加入 Service Worker 预缓存。选择宋体是此客户的设计选择，不是 HARMAY 公布的官方 VI 规范。

构建实测：网页宋体 98 个 WOFF2 分片合计 3,251,460 字节；服务 101 个分片合计 3,258,332 字节。它们是全字符覆盖的产物总量，不是每次页面下载量，浏览器只请求实际字符对应分片。八组样例的采样最低对比度约 5.47–5.81:1；这是当前背景采样指标，不代表整张图或所有参数都符合统一可读性标准。

实现口径以源代码为准。[^implementation]

## 复核与修订

2026-11-06：整理联网来源、原始素材、工程推断与实测边界；当前是机器整理和出图复核，未记录真人审美批准。外部规范更新、字体版本或品牌原稿变化时重新验证。

2026-11-12：整组纵向修正改为只按可见边界居中，质心只留在每行横向修正里；依据与量测见 `docs/audits/2026-11-12-geometry.md`。

[^hmtx]: https://learn.microsoft.com/en-us/typography/opentype/otspec190/hmtx
[^clreq]: https://www.w3.org/TR/clreq/#baselines
[^font-license]: https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE
[^implementation]: https://github.com/sinnohzeng/jianbiantouxiang/blob/main/src/text/optical.ts
