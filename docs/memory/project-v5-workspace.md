---
name: project-v5-workspace
description: 2026-09-04 起的 v5.0 工作台与债务清理：§A 五个切片（补偿独立、字号自动手动无缝、网格参考线、移除 URL 分享、文档漂移）的决定与口径，§B 桌面工作台、控件形态、手机预览、品牌图形、默认配方待 owner 回答后推进
metadata:
  type: project
---

2026-09-04 开 v5.0 轮，规约与计划在 `specs/v5.0-workspace/`。§A 五个切片当天落地，
§B（桌面全平铺工作台、控件形态、手机预览高度与拖拽、飞书品牌 SVG、默认配方与配色文字色）
等 owner 回答「同事典型使用深度」那一个问题后再定信息架构。整轮合并为一个 major（5.0.0），
§A 落地时只在 CHANGELOG 写「未发布」，版本号与标签等 §B 一起定。

**Why:** owner 明确「项目始终处于开发阶段，不要任何兼容动作，可以大刀阔斧改」；
四处不顺手（补偿牵连、字号模式跳变、缺网格、多余的链接分享）是实测反馈，先修；
桌面信息架构取决于同事是只改文字还是会调很多参数，这是 owner 才有的信息。

**How to apply:**
- 配置不进 URL。`src/state/url.ts` 已删，store 只读写 localStorage；e2e 与截图喂配置一律
  `page.addInitScript` 往 `gradient-avatar:v3` 写 `{ v: 3, config }`。不要把 hash 通道加回来。
- 行级补偿不参与求解：`fitStack` 按完整安全区宽度换行与二分，`fits` 另按位移后外沿判定。
  `tests/text/layout.test.ts` 的 auto 档回归是这条的守卫。
- 自动字号回写在 `ui.autoFontSize`（派生值，不进存档与撤销栈），`TextLayout.fontRatio`
  从求解器带比例；字号滑杆常驻可用，`SliderField` 的 `auto` 属性渲染「自动」按钮。
- 预览参考层开关在 `src/app/preview-overlays.ts`（键 `gradient-avatar:overlays`），
  网格是 CSS 渐变 DOM 图层，放在 `[data-slot="preview-shader"]` 之外（e2e 断言宿主里只有一张画布）。
- `common.copyFailed` 现在是通用「复制失败」，只剩「复制种子」在用。
- 默认配方（投影 40%、白字）已在代码里；owner 说的「描边」就是投影的观感。配色表 `text`
  设计值向白色收敛、胶囊底降级、重跑样张，这些归 §B5，等 owner 给最终配方一起做。
- 撤销栈每次配置变更入栈（拖一次滑杆多条）是已知债，本轮没改，写在 spec §5。
- 飞书品牌 SVG：没有找到许可明确的公开矢量源就不内置，留 todo 让 owner 提供，不多花心思。
