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

## §B 切片（已定稿）

执行切片交给 Opus 5 子智能体，每个切片一个智能体，不做 git，不读 `.env.local`；主对话跑闸门、目检、提交。
验收类智能体全轮合计不超过 5 个，只在 W2 与 S1 结束后各做一遍单人评审。

## 切片 B4：品牌图形

1. `scripts/gen-brand-icons.mjs`：读 `scripts/brand-list.json`，远端条目按 `source + id + '.svg'`（含 `white` 变体）
   拉取，本地条目从 `file` / `whiteFile` 拷贝；写 `public/brand/`，生成 `src/graphics/generated/brand-index.ts`
   （`BRAND_INDEX: readonly BrandEntry[]`，`BRAND_CATEGORIES`）。`package.json` 加 `gen:brand`。跑一次并提交生成物。
2. `src/state/config.ts`：`IconSource` 加 `'brand'`；`src/graphics/brand.ts` 新建，`source.ts` 加分支；
   `Graphic` 走 `kind: 'image'`。
3. `IconPicker.tsx`：模式分段加“品牌”，变体分段“原色 / 单白”，分类分组与缩略图；
   i18n 新键 `icon.brand` `icon.search.brand` `icon.brand.variant` `icon.brand.variant.color` `icon.brand.variant.white`
   与 `icon.brand.category.{office,ai,dev,social,cloud,brand}`，五个字典与 `keys.md` 同步。
4. 测试：`tests/graphics/brand.test.ts`（fetch 打桩：SVG 成功、PNG 成功、404 回 null、缓存命中）；
   `tests/panels/panels.smoke.test.tsx` 加品牌页切换用例；e2e 桌面加“图标徽章能在品牌页选到 GitHub 并导出”。
5. README“素材与致谢”与 `docs/architecture.md` 图形一节补 brand 来源。

## 切片 W1：控件形态

1. `SliderField` 数字框与重置按钮；`ColorField` 预设色块；字重分段组件（沿用 `SegmentedControl`）。
2. 单测覆盖数字框提交对齐与夹取。

## 切片 W2：工作台与手机预览

1. `src/app/workspace/PickColumn.tsx` `Inspector.tsx` `MobileDivider.tsx`，`src/app/preview-height.ts`。
2. `AppShell.tsx` 三档断点重排；`PreviewStage.tsx` 手机边长公式接 `--preview-h`。
3. 删除四个旧面板与 `SegmentedTabs`，i18n 去掉页签键、加分组标题键，`keys.md` 同步。
4. 测试：`tests/panels/panels.smoke.test.tsx` 改为 `tests/app/workspace.smoke.test.tsx`；
   `tests/app/preview-height.test.ts`；e2e 手机加“拖分隔条后预览变矮且刷新留存”，桌面用例选择器对齐。
5. `npm run screenshots` 重出 README 截图。

## 切片 S1：炫技层

1. 装 `motion`；`./node_modules/.bin/shadcn add @reactbits-starter/star-burst-tw @reactbits-starter/staggered-text-tw`
   与选定的背景组件；落到 `src/components/showcase/`。
2. `src/app/showcase/` 懒 chunk：`ShowcaseGate`（reduced-motion 与 `VITE_SHOWCASE` 判定）、背景、进场编排、
   选中态流动、随机粒子；其余项量力。
3. 单测：reduced-motion 下不发起 showcase 动态导入；e2e 桌面断言 `data-slot="showcase-background"` 存在且导出无变化。
4. `npm run budget` 仍在 250 KB 内，写下新数字。

## 切片 B7：收尾

CHANGELOG、architecture、engineering-lessons、记忆文件；B5 由 owner 试用后另起一轮。

## 风险与对策

- A1 改求解语义后长文本加大补偿会越出安全区：`fits` 仍按位移后外沿判定，界面提示照旧。
- A2 的 `setUi` 在 rAF 回调里触发订阅：只在值变化时写，且面板只订阅这一个字段。
- A4 删除 hash 后，截图与调试失去喂配置的通道：用存档注入替代，写进记忆与 contributing。
- W2 一次性删四个面板，e2e 选择器大面积失效：先列出所有 data-slot 与角色名再动手，槽位名不改。
- S1 的 React Bits 组件可能带 GSAP 或 three.js：安装后看 `package.json` diff，超过 60 KB gzip 的运行时换方案。
- brand 的 PNG 条目只有 266px，放大到导出尺寸会糊：清单里标 `ext: png`，选择器不额外提示，等 owner 拿到矢量替换。
