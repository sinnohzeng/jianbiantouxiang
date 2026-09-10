# v6.0 实施计划（怎么造）

规约见同目录 `spec.md`，章节号与规约对应。切片按「闸门可独立验证、中间态不红」切，每片完成即提交。

顺序依据评审修正：字典与 keys.md 的删改必须与代码同提交落地（`tests/i18n/keys.test.ts:171-178` 的反向断言会让分步中间态红）；`switch.tsx` 的删除跟着 §C 走而不是 S1；S5 的推算表与「四节同屏」依赖 S2/S4 之后的节高度。

## S1 债务清理（规约 §F1、§F2、§F3）

1. 删 `src/components/ui/` 九件：`badge`、`scroll-area`、`select`、`separator`、`sheet`、`tabs`、`toggle`、`toggle-group`、`tooltip`。不碰 `switch.tsx`。
2. 删四个零 importer 桶（engine/text/export/state）；`tests/app/workspace.smoke.test.tsx:10` 拆三条叶子导入；`tests/components/segmented-control.test.tsx:13` 改 `@/palettes/color`；`docs/contributing.md` 桶约定同步。
3. 删 `src/hooks/use-debounced.ts` 与 `tests/app/use-throttled.test.tsx:47-53` 用例，改写该测试文件头；删 `src/app/use-throttled.ts:6` 指向注释。
4. 三处死导出去 `export`；`source.ts` 改 const 收窄加 `never` 收口；删 `tsconfig.json:4-8`。
5. `config.ts` 删 `:293-295` 分支、改写 `:6-9` 与 `:263-265` 注释；`tests/state/config.test.ts:268-275` 删、`:164` 留。
6. `engine/math.ts` 的 clamp 改 NaN-only 守卫；`text/fit.ts`、`config.ts`、`slider-field.tsx`、`harmony.ts` 改导入；复核 `tests/text/fit.test.ts`；`harmony.ts` 的 `WCAG_MIN` 改导入 `WCAG_AA`。
7. 画布四函数下移 `src/lib/canvas.ts`，engine 与 export 同向下引用。
8. `createPersistedAtom` 工厂收编三个持久化模块（theme 排除）；`FALLBACK_COLOR` 落 `engine/colors.ts`。
9. 闸门：五步全跑，另加 `npm run e2e`（落盘读写路径的唯一端到端兜底）。

## S2 微调面板（规约 §B）

1. `slider-field.tsx`：删 `layout` prop 与 `stack` 分支；`row` 重写为 B2 的 grid 行，致密值一律 `lg:` 前缀；自动钮 `text-[11px] px-1`；数值框 `lg:text-[11px]`；滑杆命中区 `[@media(hover:none),(pointer:coarse)]`；重写文件头。
2. 同步 `CanvasFields.tsx:162`、`tests/components/input.test.tsx`、`tests/components/slider-field.test.tsx`。
3. `Inspector.tsx`：逐行组合并进排版组；`lg:` 不渲染折叠头；删 `Group` 的 `p-2.5` 覆盖；`StaggerRoot gap-3` 收 `gap-2`。
4. `card.tsx`：基值 `p-2.5`、头行 `min-h-6`、标题 `text-xs`、`mb-1.5`、子内容 `gap-2`；头注释的例子从「图形开关」换成「当前选中配色名」。`PickColumn.tsx:18/26` 的 `gap-3` 收 `gap-2`。
5. 单测补一条对齐断言：有 auto 与无 auto 的两行数值框左缘相同。

## S3 图标模块（规约 §C，代码 + 五份字典 + keys.md 单提交）

1. `GraphicSection.tsx` 按 C2 重写；删 `src/components/ui/switch.tsx`。
2. 五份字典与 `src/i18n/keys.md` 删 §E 清单里属于图标节的六条（`panel.graphic.pick/change/intro/empty/current`、`panel.text.icon`）。
3. e2e 与单测按 C2 的槽契约改；补「点 X 移除」用例。

## S4 挑选栏致密化（规约 §D）

1. `PaletteSection.tsx`：6 列无名磁贴、选中名进节头 `action` 位（custom 态显示自定义配色）、`title`/`sr-only` 保留全名。
2. `StyleSection.tsx` 与 `radio-card-group.tsx`：单行四格、描述进 `title` 加 `sr-only` 加组下常显选中项一行、种子行压一行。
3. `TextSection.tsx`：D3 的尺寸收紧。

## S5 栅格重平衡（规约 §A、§G）

1. `index.css`：A2 六套列模板与 96rem 冻结档、变量块只留 `--inspector-w`/`--preview-w`、A3 两段有界 media、A4 内拆态滚动规则、工作台 `max-w`；重写 186–218 行注释（960 已改 640、富余不再全给画框）。
2. `AppShell.tsx`：外壳 `max-w` 类；`--preview-max` 桌面档 `calc(100svh - 200px)`。
3. `PreviewStage.tsx:292`：960 改 640。
4. `e2e/desktop.spec.ts` 固化 §G 的布局断言（底边、溢出量、画框上限）。
5. 一次性量测脚本跑八组合核对推算表，数进 CHANGELOG，脚本与产物删除（产物只落 `/tmp`，不进仓库）。

## S6 操作条（规约 §E，代码 + 五份字典 + keys.md 单提交）

1. `BottomBar.tsx`：换一版改单 span 裸 `data-label`；`randomAll` 保留双 span。
2. 五份字典与 keys.md 按 §E 增删改（删 4 条、增 2 条、改 2 条）。
3. e2e 文案断言同步（`shuffle-color` 一条；`shuffle-all` 无文案断言不必改）。

## S7 收尾

1. 全闸门 + `e2e` + `screenshots` 逐张目检（三设备 × 两主题）。
2. 文档同步：`README.md`（界面描述与操作条文案）、`docs/architecture.md`（界面结构一节、目录表补 `src/lib/`、画框上限 720→640 的既有漂移一并修、操作条宽度口径）、`docs/contributing.md`（桶约定）、`CHANGELOG.md` 新条目含八组合量测数、本规约补「实到范围」并封存。
3. `docs/engineering-lessons.md` 落盘本轮经验：`justify-between` 遇上可变宽兄弟元素必然错位（固定列 grid 是解）；预览列用 `1fr` 捡漏会把控制面板压到不可用（预览按视口定宽、控制列吃剩余）；`display:contents` 的元素承担不了 `container-type`（容器查询挂载点要先有盒）。
4. `docs/memory/` 按四问准入核对，只收前两层推不出的事实。
5. 定版 v6.0.0、CHANGELOG、标签、分批提交、推送。
