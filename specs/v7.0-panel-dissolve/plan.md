# v7.0 计划（怎么造）

规约见同目录 `spec.md`。改动盘点（逐文件逐行）来自本轮代码调查，已并入下面各切片；实施者以当前代码为准，行号只作定位。

## 切片与归属

三个切片由子智能体在同一工作树上并行或接续完成，文件归属互斥，谁的文件谁改，i18n 五份字典与 `keys.md` 只归切片 B 与 C 各自新增或删除的 key，不改对方的。

### 切片 A：契约与环境光（无 i18n）

文件：`src/state/config.ts`、`src/text/fit.ts`、`src/text/layout.ts`、`src/app/showcase/AuroraBackdrop.tsx`、`src/app/AmbientBackground.tsx`、`src/index.css` 的 `ambient-drift` 一段；测试 `tests/state/config.test.ts`、`tests/text/fit.test.ts`、`tests/text/layout.test.ts`。

1. `AvatarConfig.typography.lineOffsetsY: number[]`，`AvatarConfig.layout.graphicOffsetY: number`（±0.25）。`DEFAULT_CONFIG` 补 `[0, 0]` 与 `0`。`normalizeConfig` 照抄水平那两条：`normalizeNumberArray(tp.lineOffsetsY, d.typography.lineOffsetsY, 0, -0.25, 0.25)`、`num(lay.graphicOffsetY, d.layout.graphicOffsetY, -0.25, 0.25)`。文件头注释补一句。
2. `fit.ts`：`Slot` 与 `ParagraphFit` 加 `offsetY`；三处槽位构造补 `offsetY: typography.lineOffsetsY[i] ?? 0`（晋升分支读下标 1）；`build()` 里算完 `blockHeight` 后按 `verticalRoom = box.height - blockHeight` 判 `2 * |offsetY| * height <= verticalRoom + EPS`，与 `fits` 相与。`contained`、二分、`tidy` 不动。
3. `layout.ts`：`placeGraphic` 加 `shiftY = safeBox.height * graphicOffsetY`，两个分支的 `y` 加上它，`textArea` 一个字不改；`layoutText` 加 `offsetYPx = paragraph.offsetY * height`，行 `y` 加上它。
4. 测试：config 默认值、夹值、旧存档补 0；fit 垂直不参与求解、位移小时 `fits` 真、双向越界仍假；layout 垂直互相独立、自动档下字号不变、越界报 `overflow` 不缩字号、图标垂直按安全框高挪且 `lines[0].y` 不变。
5. 环境光：`AuroraBackdrop.tsx` 的 `LAYER_SHAPE` 改 `{0.36, 0.50} {-0.17, 0.42} {0.24, 0.28} {-0.09, 0.18}`，`speed=1.3`、`noiseScale=2.9`、`movementX=-1.15`、`movementY=-0.7`，其余不动；`index.css` 的 `ambient-drift` 改 16 s、`translate3d(6%, -7%, 0) scale(1.12)`；`AmbientBackground.tsx` 的三个 `delay` 改 `0s / -5.5s / -11s`。文件头注释说明为什么两层取负号。

### 切片 B：四张卡片与外壳（i18n 的 panel.* 与 reset.body）

文件：`src/app/workspace/sections/{TextSection,GraphicSection,StyleSection,PaletteSection}.tsx`、新建 `src/app/workspace/sections/row.tsx`、`src/components/blocks/{color-field,panel-section}.tsx`、`src/app/AppShell.tsx`、`src/app/workspace/PickColumn.tsx`、`src/index.css` 工作台栅格与滚动条一段、删除 `src/app/workspace/Inspector.tsx` 与 `src/app/inspector-open.ts`；测试 `tests/app/workspace.smoke.test.tsx`、删除 `tests/app/inspector-open.test.ts`、`tests/components/*`（若新增）；e2e `e2e/helpers.ts`、`e2e/desktop.spec.ts` 与 `e2e/mobile.spec.ts` 里涉及微调、折叠组、备案号手机行的用例；字典里 `panel.*`、`reset.body`。

1. `row.tsx`：把 `Inspector.tsx` 的 `Row`（`SliderField` 包一层 `panel.common.edit/reset` 文案）与 `displayOf` 搬出来共用。
2. `panel-section.tsx` 透传 `data-slot` 到 Collapsible 根；`PaletteSection` 的两个折叠组各加 `data-slot`（`palette-custom`、`palette-seed`）。
3. `color-field.tsx` 加 `inline` 形态：行内标签、预设、自定义色块，无 hex 框。`TextSection` 用 `inline`，预设砍到五档，删 `cream` 与 `slate`。
4. `TextSection` 按 spec D5 的顺序重排，字号行与自动钮从 Inspector 搬来（订阅 `ui.autoFontSize`）；折叠组 `data-slot` 为 `text-group-layout`、`text-group-offset`。`GraphicSection` 加 `graphic` 滑杆与 `graphic-group-offset`。`StyleSection` 加 `style-group-params`。
5. `AppShell`：删 `useInspectorOpen`、`data-inspector`、`inspector-dock`；`PickColumn` 之后加 `data-slot="icp-beian-mobile"` 的一行（`sm:hidden`），并把原 dock 上手机端的底部让位 padding 转移到它或 `PickColumn` 外层。
6. `index.css`：删 `--inspector-w` 与所有 `[data-inspector=…]` 规则，六套列模板收成三套（64rem 两列、70rem 三列、96rem 冻 clamp），两条挑选列 64rem 起各自滚；删操作条容器查询整段；删滚动条规则里的 `inspector-dock` 选择器。
7. 测试与 e2e：按 slot 与可访问名定位滑杆，不用下标；数滑杆前先展开对应折叠组；`'粘贴 hex 列表'` 那条按 `palette-custom` 定位 trigger；`'主预览区不出现滚动条'` 改断 `main` 的 `overflowY` 为 hidden 且画框仍在预览区内；删 `openInspector`，加 `openGroup(page, slot)`。
8. i18n：删 `panel.inspector.*`、`panel.layout.scale`、`panel.text.group.effect`、`panel.text.group.type`、`panel.graphic.offset`、`panel.text.lineOffset`、`panel.text.color.preset.cream`、`panel.text.color.preset.slate`；加 `panel.text.lineOffsetX`（第 {index} 行水平）、`panel.text.lineOffsetY`（第 {index} 行垂直）、`panel.text.line2Size`（第二行字号）、`panel.text.group.layout`（版面）、`panel.common.group.offset`（位置微调）、`panel.graphic.offsetX`（水平）、`panel.graphic.offsetY`（垂直）、`panel.style.group.params`（参数）；改 `panel.text.fontSize` 为“第一行字号”，`reset.body` 里“微调”改“参数”。五份字典与 `keys.md` 同步。

### 切片 C：操作条、顶栏与 store（i18n 的 bottombar.*、topbar.*、footer.*、app.slogan）

文件：`src/app/BottomBar.tsx`、`src/app/TopBar.tsx`、`src/state/store.ts`；测试 `tests/state/store.test.ts`、`tests/app/*` 里涉及顶栏或操作条的；e2e `e2e/desktop.spec.ts` 与 `e2e/mobile.spec.ts` 里涉及操作条、更多菜单、设置菜单、顶栏备案号的用例；字典里 `bottombar.*`、`topbar.*`、`footer.*`、`app.slogan`。

1. `store.ts`：`randomizeAll` 改 `randomizePalette`，只换 `palette`；注释同步；删只有它用的 import。
2. `BottomBar.tsx`：删微调钮、更多下拉、恢复默认对话框（搬去顶栏）、长短文案 span 与 `data-label`；第二颗按钮 `data-slot="shuffle-palette"`，文案 `bottombar.randomPalette`；桌面一行三列，导出格不再跨两列。
3. `TopBar.tsx`：删标语；加 `data-slot="icp-beian"` 链接（`hidden sm:inline`，`ml-auto` 让给它）；加 `data-slot="settings-menu"` 齿轮下拉：主题三档单选（`data-slot="theme-option"`）、`grid-toggle`、`guide-toggle`、`reset-action`；恢复默认对话框连同 `data-slot="reset-confirm"` 搬来。
4. 测试：`describe('randomizeAll')` 改 `randomizePalette`，加“种子与质感不动”的断言。e2e：操作条三格用例、点随机配色后 `seed` 与 `style` 不变、`more-menu` 改 `settings-menu`、新增备案号与设置切主题用例；手机端 `grid-toggle` 从顶栏下拉点。
5. i18n：删 `app.slogan`、`bottombar.more`、`bottombar.randomAll`、`bottombar.randomAll.hint`、`bottombar.randomAll.short`；加 `bottombar.randomPalette`（随机配色）、`bottombar.randomPalette.hint`（只换配色，种子与质感不变）、`topbar.settings`（设置）、`footer.icp`（`京ICP备2026029073号-5`，五语同值）。五份字典与 `keys.md` 同步。

### 主对话收尾

`README.md`、`docs/architecture.md`、`about.html` 第 237 行附近那句操作条容器查询的说明、`CHANGELOG.md` 7.0.0、`package.json` 版本、规约封存、e2e 与截图全跑、分批提交、打 `v7.0.0`、push。

## 顺序与并行

A 与 C 并行先跑（文件互斥，C 不依赖 A）；B 在 A 合入后跑（垂直补偿滑杆要读新字段）。每个切片交付前自己跑 `npm run lint && npm run typecheck && npx vitest run <相关目录>`；全量闸门与 e2e 由主对话在三片合齐后跑。

## 提交批次

1. `fix(ui)`：滑杆行列序与预览裁切两处 bug（已完成，含 e2e 断言调整）。
2. `feat(text)!`：垂直补偿契约与排版（切片 A 的 1 到 4）。
3. `feat(ui)`：环境光参数（切片 A 的 5）。
4. `feat(ui)!`：操作条三格、顶栏设置与备案号、store 改名（切片 C）。
5. `feat(ui)!`：微调面板拆进四张卡片，栅格收三套（切片 B）。
6. `docs`：域名、部署 SOP、架构、README、CHANGELOG 定版 7.0.0。
