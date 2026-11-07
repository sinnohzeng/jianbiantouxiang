---
type: Design Research
title: 手机头像编辑中的精调与空间利用
description: 对照用户截图、官方控件指南与触控实验，区分范围探索和指定数值。
status: provisional
generated: { by: codex/gpt-6, at: "2026-11-07T09:25:00+00:00" }
sources:
  - id: user
    resource: 用户截图 libfile_d919a91ff58c819191ad010e19d92ccf、libfile_94c5f676b3b481919b9b7e5e7aa09ad3
  - id: sliders
    resource: https://developer.apple.com/design/human-interface-guidelines/sliders
  - id: steppers
    resource: https://developer.apple.com/design/human-interface-guidelines/steppers
  - id: adobe
    resource: https://helpx.adobe.com/lt/lightroom/mobile/adjust-light-and-color/adjust-light-in-photos.html
  - id: wcag
    resource: https://www.w3.org/WAI/WCAG22/Techniques/general/G219.html
  - id: colley
    resource: https://sven-mayer.com/wp-content/uploads/2019/01/colley2018slider.pdf
  - id: ehrler
    resource: https://humanfactors.jmir.org/2015/2/e15/
---

# 证据与取舍

截图显示参数重复占两行、卡片内外缩进、品牌在第三页签且客户素材在末尾。不能单凭“圆角”判定可用性，需量测有效编辑面积、触区、操作步骤及预览可见性。[user]

Apple 将滑块用于连续范围调节，建议配精确输入；步进适合几次小改动，大跨度结合输入框。Adobe Lightroom 手机的光线调节仍采用滑块，是“成熟 APP 都不用滑块”的反例。[sliders][steppers][adobe] W3C G219 要求拖动功能有非拖动替代，不能只支持键盘。[wcag]

Colley 等 CHI 2019 实验发现滑块方向、外观与目标值会影响误差；它研究的是选值，不直接证明头像编辑器的最优布局。Ehrler 等 2015 临床数值输入试验同样有任务与人群限制，不能推广成所有用户都应使用步进器。[colley][ehrler]

工程选择：文字/Logo 尺寸与位置在手机默认使用减、数值、加，44px 按钮；大改直接输入。桌面和背景质感保留滑块。单一配置/步进网格/撤销链，不增加隐藏手势、长按加速或第二套状态。手机平铺编辑节、单层 12px 页面内距，移除装饰背景；低频字体继续折叠。选择器品牌优先、客户成组置顶，不在选图前提供无上下文的全局单色开关。

# 验证边界

Chromium iPhone 15 / SE 视口实测常用行高 44–48px、按钮 44px、无横向页面溢出；测试加减、直接输入、恢复自动与客户选择。不是实体 iPhone / Safari / 输入法测试，也没有受试者任务计时，不能声称用户效率已被实验验证。保持头像布局不作为本次界面改造对象。逐项素材与具体发布证据见 ../../audits/2026-11-07-mobile-editor.md。
