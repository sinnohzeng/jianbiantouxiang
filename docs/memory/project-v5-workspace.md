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
- 飞书品牌 SVG：dashboard-icons（homarr-labs，Apache-2.0，商标归各品牌）有 `lark`，没有 feishu / bytedance / douyin / dingtalk；已加 `dashboard-icons` MCP（`claude mcp add dashboard-icons -- npx -y mcp-remote https://dashboardicons.com/api/mcp`），品牌图标从它取。
- 智能体用量（2026-09-04 owner 定）：核查、对抗检验、评审、验收每轮合计不超过 5 个，一遍单人评审；实现切片交 Opus 5。这轮 §A 的 40 个智能体评审是反例，别再来。
- §B 已定方向乙（两层平铺）：挑选类控件占首屏与大尺寸，数值微调收成一条紧凑检查器带；整体风格要「足够炫技」，shadcnblocks 与 React Bits Pro 的动效能用上就用上，这个项目同时是秀肌肉的作品。
- 典型用法（owner 口述）：改文字、可能加图标、随机刷配色挑一张好看的，极少数调补偿；边距字号等默认值由 owner 上手后定，大多数人不会手调。默认配方必须足够好看。
- 2026-09-05：owner 在 `inbox/`（已 gitignore）投放 lark.svg、doubao-work.png、Qoder.png、workbuddy 图标；已并入 `assets/brand/`
  与 `scripts/brand-list.json`（58 个品牌，13 个带纯白变体）。Qoder 是 potrace 描摹，WorkBuddy 去掉了 filter 光斑，豆包工作只有 266px 位图。
- §B 定稿：方向乙、手机 28svh 加分隔条、brand 图形源、showcase 懒 chunk（motion + React Bits）；切片顺序 B4 → W1 → W2 → S1 → B7。
- 2026-09-05 下半场：W2 工作台、M1 手机长按直存、S1 炫技层全部落地并推送。检查器行是紧凑两行式，三段挤一行会把滑杆压到 0 宽，Base UI 会直接把滑块藏起来。首屏预算已降级为报告。
- 2026-09-05 收尾：owner 看图后要的五件事都做了。布局从「三列常驻检查器」改成「双列挑选栏加按需打开的微调」，
  owner 亲选「默认收起，按需打开」；最近生成挪进顶栏浮层；操作条横跨底部整宽且每个按钮都带文案；
  选中态换实心主色；一键恢复默认进「更多」菜单带确认；service worker 每 15 分钟轮询新版本并弹刷新提示。
- Base UI 滑杆的第二条坑：在 `display:none` 里挂载会量到 0 宽并把滑块设成 `visibility: hidden`，
  之后显示出来也不复测，键盘与拖动全失灵。默认收起的面板必须「开的时候才挂」，不能只用 CSS 藏。
- 星爆粒子（star-burst-tw）已整个移除。它铺满自己那块方形画布，摆在按钮上就是 owner 说的「方形色散」；
  移到预览框加径向遮罩确实好看了，但 owner 的判断是「太花哨，可以去掉」，于是全站换成纯 CSS 涟漪。
  组件文件 `src/components/showcase/star-burst.tsx` 一并删除，要回退就从 registry 重装。
- 进场幕布（preloader）读秒期间会吃掉所有点击，e2e 里所有「打开就点」的用例都会失败。
  现在读秒一结束就 `pointer-events-none`，`openApp` 等的是 `[data-slot="preloader"][data-loading="true"]` 消失。
