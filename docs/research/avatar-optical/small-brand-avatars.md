---
type: Research Reference
title: 品牌字标与小尺寸群头像
description: 小尺寸品牌头像的信息层级、颜色及可读性研究。
status: stable
generated: { by: codex/gpt-6, at: '2026-11-06T07:17:40Z' }
tags: [avatar, typography, visual-review]
review_scope: source-backed engineering decisions; subjective appearance is not human-approved
sources:
  - id: harmay
    resource: https://www.harmay.com/
  - id: material
    resource: https://m3.material.io/styles/color
  - id: atlassian
    resource: https://atlassian.design/guidelines/product/foundations/iconography/
  - id: contrast
    resource: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
---

# 品牌字标与小尺寸群头像

依据客户提供的透明 PNG/SVG、用户飞书截图及当前项目真实生成结果进行评审。深色渐变是用户偏好，不是 HARMAY 官方品牌规范；没有找到可核验的公开品牌 VI。

- [HARMAY 官网](https://www.harmay.com/) [^harmay] 可验证原始黑白字标与简洁视觉，但不能推出某套渐变为品牌标准。
- [Material 3 色彩](https://m3.material.io/styles/color) [^material] 强调按角色组织颜色与前景/背景对比。本项目采用已有低饱和深色，不引入新的主题系统。
- [Atlassian 图标原则](https://atlassian.design/guidelines/product/foundations/iconography/) [^atlassian] 强调小尺寸简化、比例与光学平衡；它的图标网格不是飞书头像规范。
- [W3C 对比度解释](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) [^contrast] 指出普通文字 4.5:1、细笔画抗锯齿会减弱实际对比。Logo 有规范例外，但本产品仍主动追求可见性；抽样诊断不能宣布图片满足 WCAG。

方法：原始 Logo 只裁透明边，不变形、不描粗；用真实字体度量求解圆形边界。默认 Noto Sans SC 700 与 600 各生成一行/两行网页输出，比较 24/32/48/64 CSS px 的实际笔画。保留 700：小尺寸中文更稳，600 并未增加有效信息量。Logo 的原始细衬线不套用中文加粗策略。

客户 PNG 可见字标约 9.5:1，SVG 画布 727×87、可见轮廓更扁；当宽占圆径 74–81% 时，32 px 的字标高仅约 2.5–2.7 px。完整英文逐字清晰不能靠增大导出分辨率解决。Logo 保持辅助品牌识别，中文群名承担主要信息。三层信息在 24 px 仍有物理限制，返回的小字警告保留。

落地：钢灰深底、白字、光感 8%、纯色无投影；自动图文副行 80%，手动首行仍 62%，纯文字两行等大。圆裁留白继续 6%，不是飞书官方强制比例。已有颜色、字体、效果和手动设置仍可选择。

## 复核与修订

2026-11-06：整理联网来源、原始素材、工程推断与实测边界；当前是机器整理和出图复核，未记录真人审美批准。外部规范更新、字体版本或品牌原稿变化时重新验证。

[^harmay]: https://www.harmay.com/
[^material]: https://m3.material.io/styles/color
[^atlassian]: https://atlassian.design/guidelines/product/foundations/iconography/
[^contrast]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
