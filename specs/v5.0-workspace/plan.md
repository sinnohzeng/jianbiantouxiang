# 工作台与债务清理 v5.0 计划（怎么造）

对应 `spec.md`。状态：§A 五个切片已于 2026-09-04 落地（闸门与 e2e 全绿）；§B 等信息架构定稿后追加切片。
每个切片独立提交、独立过闸门；主会话做 git，子智能体不做 git 操作、不读 `.env.local`。

## 切片 A1：补偿独立（先红后绿）

1. `tests/text/layout.test.ts` 新增 `auto` 档用例：两行、`padding 0.1`、
   `lineOffsetsX [0, 0]` 与 `[-0.1, 0]` 各排一次，断言第二行 `x`、`y`、`fontSizePx` 相等，
   第一行 `fontSizePx` 相等、`x` 差 100。当前实现下必红。
2. `src/text/fit.ts`：`build()` 里 `maxWidth` 直接取 `box.width`；
   求解用的 `contained` 只看未位移的块；对外的 `fits` 另算，把 `2 × |offset| × width` 加进去。
3. `tests/text/fit.test.ts` 里「水平补偿在求解阶段预留宽度余量」改写为
   「补偿不参与求解，只影响 fits」。
4. `docs/architecture.md` 文字排版一节改一句。

## 切片 A2：字号自动与手动

1. `src/state/store.ts`：`UiState` 加 `autoFontSize: number | null`，默认 null。
2. `src/app/PreviewStage.tsx`：排版回调里 `setUi({ autoFontSize: layout.fontRatio })`（求解器带出的基准比例，
   按 `FONT_SIZE_STEP` 向下对齐到滑杆步进），只在值变化时写，避免每帧触发订阅。
3. `src/components/blocks/slider-field.tsx`：新增可选 `auto` 属性
   `{ active, label, onReset }`，渲染为数值前的一个 `aria-pressed` 按钮。
4. `src/app/panels/TextPanel.tsx`：删「字号模式」分段；字号滑杆改为常驻可用，
   `auto` 时值取 `ui.autoFontSize ?? fontSize`，`onChange` 同时写 `sizeMode: 'manual'`。
5. 五份字典与 `keys.md`：删 `panel.text.sizeMode`、`.auto`、`.manual`，
   加 `panel.text.fontSize.auto`（自动）与 `panel.text.fontSize.autoHint`。
6. 单测：`tests/state/store.test.ts` 加 `setUi({ autoFontSize })` 用例；
   `tests/panels/panels.smoke.test.tsx` 若引用了分段控件则同步改。

## 切片 A3：网格参考线

1. 新建 `src/app/preview-overlays.ts`：与 `ambient.ts` 同款的模块级状态加 localStorage，
   导出 `usePreviewOverlays()` 返回 `{ guide, grid, setGuide, setGrid }`。
2. `PreviewStage.tsx`：`guide` 改读该 hook；新增网格图层与开关按钮（`Grid3x3Icon`），
   格子边长 `min(box.width, box.height) / 12`，`background-position: center`，中心十字加粗。
3. 字典加 `preview.grid`、`preview.grid.hint`。
4. 单测 `tests/app/preview-overlays.test.ts`：默认关、写入后可读回、坏值回落。
5. e2e：桌面档加「开网格、刷新仍开」。

## 切片 A4：移除 URL 分享

1. 删 `src/state/url.ts`、`tests/state/url.test.ts`。
2. `store.ts`：`readInitialConfig` 只读存档；`writeSync` 只写存档；删 `initialHashBroken`、
   `brokenHash`；`ConfigSource` 收成 `'storage' | 'default'`。
3. `App.tsx` 删 `ShareLinkNotice`；`BottomBar.tsx` 删复制链接按钮与相关 import。
4. 字典删 `bottombar.copyLink`、`common.copied`、`share.invalid`；
   `common.copyFailed` 改「复制失败」。
5. `tests/state/store.test.ts`：删 hash 相关用例，同步改「300 ms 后才写」用例。
6. e2e：删两条链接往返；「常驻操作条」用例改断言 localStorage 存档变化。
7. 文档：README、architecture、contributing、AGENTS.md、项目记忆。

## 切片 A5：收尾

- CHANGELOG 加「未发布」段，四个切片各一条；版本号与标签等 §B 落地后按 major 一次定。
- 闸门全绿后 commit 加 push。

## §B 切片（待定稿后追加）

- B1 工作台布局、B2 控件形态、B3 手机端预览与拖拽分隔、B4 内置品牌图形、B5 默认配方。
- 每个切片先在本文件补一节，再动手。

## 风险与对策

- A1 改求解语义后长文本加大补偿会越出安全区：`fits` 仍按位移后外沿判定，界面提示照旧。
- A2 的 `setUi` 在 rAF 回调里触发订阅：只在值变化时写，且面板只订阅这一个字段。
- A4 删除 hash 后，截图与调试失去喂配置的通道：用存档注入替代，写进记忆与 contributing。
