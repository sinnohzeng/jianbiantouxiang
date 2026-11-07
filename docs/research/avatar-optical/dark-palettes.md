---
type: DesignResearch
title: 深色头像渐变的可读性与审美证据
status: provisional
generated:
  by: Codex
  at: "2026-11-07T16:34:47+00:00"
sources:
  - id: wcag-contrast
    resource: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
  - id: wcag-g18
    resource: "https://www.w3.org/WAI/WCAG22/Techniques/general/G18"
  - id: css-color
    resource: "https://www.w3.org/TR/2026/CRD-css-color-4-20261103/"
  - id: apple-color
    resource: "https://developer.apple.com/design/human-interface-guidelines/color"
  - id: palmer-schloss-2010
    resource: "https://palmerlab.berkeley.edu/pdf/Palmer%26Schloss%282010%29.pdf"
  - id: schloss-palmer-2011
    resource: "https://palmerlab.berkeley.edu/pdf/Schloss%26Palmer%282011%29.pdf"
---

# 深色头像渐变：理论、选择与实际像素验证

研究与采样日期：2026-11-07。对应 [v8.6.0 规约](../../../specs/v8.6.0-dark-palettes/spec.md)。具体色值和五语名称以 [配色表](../../../src/palettes/palettes.ts) 为唯一来源，本页保存选择依据与测量结果。

## 设计判断

将可读性、色彩协调和个人偏好分开。白色字标配深底来自本项目用户偏好；低彩度、邻近色相及收敛亮度跨度是面向这个场景的设计选择，不是行业强制规范。十组颜色为项目设计，不是 HARMAY 或东黎的官方品牌色。

本轮在原 37 套（21 浅色、16 深色）后追加十套，原值、顺序与默认保持。已有深色涵盖纯蓝、青绿、玫红、紫、铜橙及钢蓝灰，因此新组补充橄榄、暖中性、灰紫和陶褐。偏饱和的深海蓝候选与已有午夜藏青/深空重叠较多；采用低彩度邻近色相组合，是为了扩大现有库的选择范围，而不是把论文当作十个色值的背书。

## 一手证据与适用边界

来源均于 2026-11-07 获取；页面获取日期不冒充原始发表日期。

| 来源 | 日期与证据性质 | 支持的判断 | 本项目边界 |
| --- | --- | --- | --- |
| WCAG 2.2 1.4.3[^wcag-contrast] | 2023-10-05 Recommendation；Understanding 为当前维护版 | 普通文字最低 4.5:1，大字 3:1；字标有例外。 | 本项目对白色主副行采用 4.5:1 筛选目标，也要求 Logo 清楚。不能因导出原图字号大，就将缩小后的群聊头像按大字豁免。 |
| W3C G18[^wcag-g18] | 当前充分技术说明，不是唯一合规方法 | 渐变、图片背景应检查文字背后的实际区域。 | 停靠点仅做筛选；最终着色器、光感之后的像素才是显示结果，不能用平均亮度代替最差局部。 |
| CSS Color 4[^css-color] | 2026-11-03 Candidate Recommendation Draft，工作草案 | Oklab/Oklch 提供感知色彩表示和插值规则，色域映射需明确。 | 用 Oklch 分析亮度/彩度，实际色值仍为 sRGB hex；没有因此更换 shader。该草案不能冒称年中已定稿规范。 |
| Apple HIG Color[^apple-color] | 官方平台指南；页面列最近变更 2025-12-16 | 在不同外观和对比设置下检查颜色，不让颜色妨碍内容辨认。 | 不是头像视觉实验，也没有规定最佳十套色。用于检查选择器与黑白 Logo 的辨识，不照搬系统强调色。 |
| Palmer & Schloss[^palmer-schloss-2010] | 2010，PNAS 原始实验；DOI 10.1073/pnas.0906172107 | 颜色偏好与相关物体的情感联想有关，该理论得到实验支持。 | 不推导某色普遍高级、专业或令人平静；文化、品牌语境与个人经验会影响偏好。 |
| Schloss & Palmer[^schloss-palmer-2011] | 2011，Attention, Perception, & Psychophysics 73:551–571；在线 2010-11-10；DOI 10.3758/s13414-010-0027-0 | 整体喜欢、颜色协调和图形色偏好是不同判断；同类色相协调不等于人人喜欢。 | 原实验是颜色对/图形背景，不是小头像或中国群聊。支持把邻近色相作为候选，不能保证审美通过。 |

## 十组实际选择

均推荐白字 `#FFFFFF`。下表对比度是白色对最差停靠点，和下节实际背景测量是两类证据。

| ID / 名称 | 选用理由 | 最差停靠点对比 |
| --- | --- | --- |
| `warm-graphite` / 暖石墨 · Warm Graphite | 比墨黑单色偏暖且收敛亮度跨度；暖灰中性，适合细衬线白标。 | 8.565:1 |
| `ink-olive` / 墨橄榄 · Ink Olive | 补入现有深色缺少的低饱和黄绿；区别于祖母绿与林夜的纯绿。 | 6.585:1 |
| `juniper-stone` / 杜松青石 · Juniper Stone | 青绿渐变向灰绿，不用祖母绿的高彩度亮点。 | 6.160:1 |
| `petrol-plum` / 墨蓝灰紫 · Petrol Plum | 从石油蓝转灰紫；区别于钢灰石板的单一蓝灰轴。 | 8.945:1 |
| `smoked-lavender` / 烟熏薰衣草 · Smoked Lavender | 灰紫低彩度，区别于夜紫李的饱和紫和霓虹暗潮。 | 6.857:1 |
| `mulberry-clay` / 桑葚陶泥 · Mulberry Clay | 紫红平缓转陶褐，区别于玫瑰午夜鲜明的品红轴。 | 7.218:1 |
| `cacao-linen` / 可可亚麻 · Cacao Linen | 低彩度深棕到灰褐，区别于古铜的橙色和余烬暮色的亮琥珀。 | 7.302:1 |
| `redwood-smoke` / 红木烟色 · Redwood Smoke | 红棕而非牛血红/玫瑰红；较可可亚麻更有暖色辨识。 | 6.512:1 |
| `rainy-blue` / 雨幕蓝灰 · Rainy Blue | 低饱和蓝紫灰，区别于午夜藏青的纯蓝高亮和宇宙靛蓝。 | 5.944:1 |
| `smoked-jade` / 烟玉青 · Smoked Jade | 低彩度冷青，区别于深海青偏绿色且更亮的末端；比杜松更冷。 | 5.873:1 |

十组各四个 sRGB 节点，本地 culori 测得 Oklch L 范围约 0.214–0.502，最大 C 约 0.048。这些是设计结果，不是标准阈值。白色对最差节点为 5.873–8.945:1。

停靠点计算使用 WCAG sRGB 分段线性化，`Y=0.2126R+0.7152G+0.0722B`，白字对比 `1.05/(Y+0.05)`，判断前不取整。保守推演默认 8% 光感时，假设两盏白光同时达到最大 alpha（0.08×0.55、0.08×0.32），节点经 screen 后的最差对比为 5.032–7.364:1；这是节点模型，不是 shader 的数学保证。

## 120 张实际背景采样

主任务用 Chromium 调用项目 `renderGradient` 后叠加 `drawHighlight`，输出没有文字和 Logo 的 256×256 背景，逐像素读取亮度。矩阵为十组配色 × mesh/flow/silk/grain 四种质感 × `palette-0`、`palette-1`、`palette-2` 三个固定种子，其他参数取当前默认、光感固定 `0.08`。总计 120 张、每张 65,536 个像素；所有输出 `fallback` 均为 null。

每张图取全画面最高相对亮度，计算纯白对其最差对比；该值不包含文字抗锯齿像素，也不是文字识别率。本页重新检查测量 JSON 的矩阵完整性及最小值。下表每格是对应质感三个种子的最低值，显示保留六位小数，判断使用未舍入数值。

| 配色 | mesh | flow | silk | grain |
| --- | --- | --- | --- | --- |
| 暖石墨 | 7.350448 | 7.547549 | 8.985512 | 7.583571 |
| 墨橄榄 | 5.739617 | 5.826470 | 7.030235 | 5.914891 |
| 杜松青石 | 5.382612 | 5.524585 | 6.428414 | 5.544654 |
| 墨蓝灰紫 | 7.577310 | 7.807469 | 8.467573 | 7.911555 |
| 烟熏薰衣草 | 5.983580 | 6.096297 | 7.358503 | 6.167686 |
| 桑葚陶泥 | 6.244377 | 6.411023 | 7.673984 | 6.437238 |
| 可可亚麻 | 6.350670 | 6.454182 | 7.788259 | 6.547977 |
| 红木烟色 | 5.731504 | 5.822330 | 6.895379 | 5.885468 |
| 雨幕蓝灰 | 5.212659 | 5.354093 | 6.332537 | 5.368472 |
| 烟玉青 | 5.196799 | 5.284552 | 6.281424 | 5.351079 |

全矩阵最低值为 **5.196798901140696:1**，来自 `smoked-jade`、mesh、`palette-0`。120 张样本均高于项目的 4.5:1 目标。这个结论只覆盖上述尺寸、种子、参数及运行环境；不外推所有种子、输出分辨率、用户高光值、其他文字颜色或所有设备，也不宣称整个产品通过 WCAG 认证。

## 视觉复核与复现

主任务实际生成十组 HARMAY 白色原稿与“飞书对接 / 项目协作”样张：mesh、`palette-1`、光感 0.08，512×512，Logo 比例 0.52、安全边距 0.03、白色纯色文字。拼图展示 256 px 完整图及 32/48/64 px 圆裁。主任务查看后认为十组可用于首版；这是智能体的视觉判断，不是用户验收或真人实验。

32 px 中 HARMAY 横向细字标的逐字辨识仍有限。高对比不能弥补字标固有的扁宽比例和细笔画；需要同时观察主行清晰度、主副层级和完整品牌轮廓。黑色 Logo 在深底的低对比与 alpha 或素材加载故障必须分别检查，黑稿应在浅底对照；不通过扭曲字标、描边或偷偷反色提高可见性。

复现上述背景测量时，先用 `normalizeConfig` 设置配色 ID、质感、固定种子、空文本与 `highlight: 0.08`；调用 `renderGradient(config, 256, 256)`，再用 `drawHighlight` 与 `resolveSeed` 叠加同一光感；读取全部像素并计算最差白字对比。复现头像则通过 `composeAvatar` 使用同一配置及客户原稿。不要以 CSS 缩略图、Oklch 插值函数或颜色均值代替真实导出管线。

没有新增真人偏好实验、真实手机显示测量或飞书客户端验收。颜色命名用于识别，不附加未经证实的心理学或品牌承诺。

[^wcag-contrast]: [W3C：Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。
[^wcag-g18]: [W3C：G18](https://www.w3.org/WAI/WCAG22/Techniques/general/G18)。
[^css-color]: [CSS Color 4，2026-11-03 草案](https://www.w3.org/TR/2026/CRD-css-color-4-20261103/)。
[^apple-color]: [Apple Human Interface Guidelines：Color](https://developer.apple.com/design/human-interface-guidelines/color)。
[^palmer-schloss-2010]: [Palmer & Schloss，2010 原文](https://palmerlab.berkeley.edu/pdf/Palmer%26Schloss%282010%29.pdf)。
[^schloss-palmer-2011]: [Schloss & Palmer，2011 原文](https://palmerlab.berkeley.edu/pdf/Schloss%26Palmer%282011%29.pdf)。
