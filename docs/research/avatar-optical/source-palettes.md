---
type: DesignResearch
title: 原始渐变取色与预览参考圈核查
generated:
  by: Codex
  at: "2026-11-15T16:49:13+00:00"
sources:
  - id: supabase
    resource: "https://supabase.com/brand-assets/supabase-icon-green-transparent.svg"
  - id: fluent
    resource: "https://github.com/microsoft/fluentui-system-icons/blob/67e6dec1ee956af3ab4c746a2b3bb6a2e5520a44/assets/Bot%20Sparkle/SVG/ic_fluent_bot_sparkle_24_color.svg"
  - id: vite
    resource: "https://github.com/vitejs/vite/blob/main/docs/public/logo.svg"
  - id: gemini
    resource: "https://design.google/library/gemini-ai-visual-design"
  - id: feishu-app
    resource: "https://open.feishu.cn/document/uYjL24iN/uUjM0UjL1IDN14SNyQTN"
  - id: feishu-group
    resource: "https://www.feishu.cn/hc/zh-CN/articles/139445842299-编辑群信息"
  - id: chrome-color
    resource: "https://developer.chrome.com/docs/css-ui/access-colors-spaces"
  - id: uigradients
    resource: "https://github.com/ghosh/uiGradients/blob/main/gradients.json"
  - id: contrast
    resource: "https://www.w3.org/WAI/WCAG22/Techniques/general/G18"
---

# 来源配色与参考圈

获取与检查日期：2026-11-15。面向配色维护者；实现范围见 [v8.11.0 规约](../../../specs/v8.11.0-source-palettes/spec.md)。

## 选择

对照已有 48 套，新增三套，原值与顺序保留。名称用于区分背景，不表示品牌官方头像方案。

| 配色 | 原始证据与采用方式 | 与现有库的区别 |
| --- | --- | --- |
| 翠绿跃动 `supabase-green` | Supabase 官网链接的 SVG `paint0_linear`，原样取 `#249361 → #3ECF8E`。[^supabase] | 两节点的中亮度翠绿，区别于薄荷的浅粉混色及祖母绿的暗部跨度。 |
| 杏金星芒 `fluent-spark` | Microsoft Fluent Bot Sparkle 的 `paint10_linear`，原样取 `#FF8A69 → #FFCD0F`。[^fluent] | 杏色到金黄的短渐变，较琥珀夕照减少红橙段、较落日减少粉紫段。 |
| 深靛微光 `fluent-indigo` | 同一 Fluent 文件的 `paint0_radial` 深端 `#4E44DB` 与 `paint5_linear` 深端 `#3D35B1` 重新组合。[^fluent] | 聚焦高彩度靛紫、收窄明度跨度，区别于深空和宇宙靛蓝的大范围暗亮变化。 |

深靛是项目从源文件中选色重组，未复制源图全部渐变；背景基底亦由项目选择。Supabase SVG SHA-256 为 `eb9ffcd100ad26228a578100ba7cbfc5b383e4995338d122abdc6a3b4d210ed3`；Fluent 文件固定在表头来源的提交，SHA-256 为 `2649957805c5f1e031d91f4ed2df1dbc7ae52b686b7b555d7a35ad7cdbdc42a2`。只纳入色值，原图不进入产品素材库。

Google 设计团队解释 Gemini 渐变用浓淡边缘表达方向与流动，提供设计意图而非精确色表。[^gemini] 本轮借鉴集中、克制的颜色变化，没有给第三方仿制的 Gemini 色值冠以官方名称。检查 [Vite 当前 `docs/public/logo.svg`](https://github.com/vitejs/vite/blob/main/docs/public/logo.svg) 得到单色标识，未将历史蓝紫渐变误作当前源文件。已有淡彩虹与蓝紫组合也不再重复添加。

## 色值与外观的区别

源图的 Supabase 线性渐变从 `(53.9738,54.974)` 指向 `(94.1635,71.8295)`，Fluent 星芒从 `(20.0714,18.7143)` 指向 `(13.7598,11.4575)`；两者色标位于 0 和 1。深靛取两个不同渐变的深端，源图不存在本项目这条双色渐变。

本项目没有导入这些坐标或色标位置。`toShaderColor` 将 sRGB hex 通道归一化为 RGBA，四种着色器按自身的空间权重、种子与旋转参数合成，之后叠加光感；这不是源 SVG 的线性/径向插值复现，也没有在本轮切换到 CSS Oklab。Chrome 的色彩空间说明展示了不同空间的表达与插值差异。[^chrome-color] 因此本轮评价的是项目实际导出的头像。

另读取 uiGradients 原始 JSON 的 382 条记录；其记录提供名称及颜色数组，不提供方向、色标位置或插值空间。[^uigradients] 可作为取色资料，不能单凭 JSON 声称复现原网站外观。本轮保留已有三组，未为增加数量继续添加相近色。

## 实际导出

使用 `composeAvatar`，默认光感 0.08、投影 0.4，四种质感 × 三个固定种子 `source-0/1/2`；每张背景 256²，共 36 张。逐像素计算推荐字色相对整个背景的最差 WCAG 对比。[^contrast] 下表每格取三个种子的最低值，判断用未舍入值。

| 配色 / 推荐字色 | mesh | flow | silk | grain |
| --- | --- | --- | --- | --- |
| 翠绿跃动 / #141413 | 4.5313 | 4.5905 | 4.7010 | 4.7587 |
| 杏金星芒 / #141413 | 7.5431 | 7.6411 | 7.9231 | 7.9768 |
| 深靛微光 / #FFFFFF | 5.8541 | 5.8241 | 6.1125 | 6.0457 |

这些是项目参数下的渲染结果，不是全部种子、光感或设备的数学保证。绿色余量较小。投影不能将相反字色变成推荐组合，也不将抗锯齿后的细笔画认读等同于背景对比度。

另以 mesh 质感、`source-1` 种子生成默认豆包工作、原默认文案的 512² 深浅字对照，以及 32/48/64 px 圆裁。视觉检查认为推荐搭配主行辨认和层级完整；32 px 副行仍细小。未进行真人实验或飞书客户端实测。样张见[本轮验收](../../audits/2026-11-15-source-palettes.md)。

复现：启动 `npm run dev`，另运行 `node scripts/audit-source-palettes.mjs /tmp/avatar-source-palettes`。脚本使用已安装 Playwright Chromium，输出 PNG、拼图与 JSON；实际背景对比低于 4.5 会报错。

## 两个圈的证据

`PreviewStage.tsx` 绘制外圈与内圈；`preview-overlays.ts` 定义 12 分网格。`fill.ts` 整组放大和 `layout.ts` 最终越界检查使用安全边距，`compose-core.ts` 导出不读取参考层。具体公式只在[排版参考](../../layout.md#预览参考线)维护。

飞书应用图标文档与群信息编辑页是不同用途的资料。[^feishu-app][^feishu-group] 本次网页工具未取得完整正文，搜索摘要仅能确认图标/编辑主题，不支持群头像必须留 3% 的结论。默认 3% 为项目参数，不能称为飞书规定。

[^supabase]: [Supabase 官方 SVG](https://supabase.com/brand-assets/supabase-icon-green-transparent.svg)，入口为 [Brand Guidelines](https://supabase.com/brand)。
[^fluent]: [Microsoft Fluent Bot Sparkle 原始文件](https://github.com/microsoft/fluentui-system-icons/blob/67e6dec1ee956af3ab4c746a2b3bb6a2e5520a44/assets/Bot%20Sparkle/SVG/ic_fluent_bot_sparkle_24_color.svg)。
[^gemini]: [Google Design: Illustrating the Gemini App](https://design.google/library/gemini-ai-visual-design)。
[^contrast]: [W3C G18](https://www.w3.org/WAI/WCAG22/Techniques/general/G18)。
[^feishu-app]: [飞书应用图标文档](https://open.feishu.cn/document/uYjL24iN/uUjM0UjL1IDN14SNyQTN)。
[^feishu-group]: [飞书编辑群信息](https://www.feishu.cn/hc/zh-CN/articles/139445842299-编辑群信息)。

[^chrome-color]: [Chrome：Access more colors and new spaces](https://developer.chrome.com/docs/css-ui/access-colors-spaces)。
[^uigradients]: [uiGradients 原始颜色清单](https://github.com/ghosh/uiGradients/blob/main/gradients.json)。
