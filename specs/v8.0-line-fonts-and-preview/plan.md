# v8.0 计划（怎么造）

规约见同目录 `spec.md`，调研见 `docs/research/2026-09-23-font-preview.md`，评审处置见 `docs/audits/2026-09-23-v8.0-plan-review.md`。行号只作定位，实施者以当前代码为准。

## 切片与顺序

三个切片串行，每片由一个 Opus 子智能体在主工作树上完成。main 推送即上线，所以每一片自身必须是完整可用的产品状态：切片 A 之后界面照常可用，只是第二行还不能单独选字体；切片 B 之后逐行字体完整可用；切片 C 之后预览上线。

子智能体的纪律：

- 只改自己切片列出的文件；清单外确有牵连的，改完在交付说明里列出来。
- 不做 git 操作，不读 `.env.local`。
- 临时文件只写会话草稿目录，不往仓库根目录落任何文件。
- 不关闭共享的浏览器，不动 `.playwright-mcp/` 里别人的快照。
- 交付前自己跑 `npm run lint && npm run typecheck && npx vitest run <相关目录>`。
- 注释只写现状，不写“不再有 X”“这里没有 Y”；测试不断言已删功能不存在。

主对话在每片交付后依次跑：闸门五步、`npm run e2e`（桌面与手机两档）、`npm run screenshots` 并逐张目检，全绿才提交推送。每片随代码一起提交它改动所牵连的常驻文档，收尾只留 README、ADR、CHANGELOG、版本号与规约封存。

### 切片 A：契约重组、按行加载、存档升键

文件：

- 状态：`src/state/config.ts`、`src/state/persist.ts`、`src/state/store.ts`，`src/state/history.ts` 若哈希牵连。
- 字体：新建 `src/fonts/family.ts`；`src/fonts/loader.ts`、`src/fonts/google.ts`、`src/fonts/catalog.ts`、`src/fonts/curated.ts`；删除 `src/fonts/index.ts`。
- 排版：`src/text/measure.ts`、`src/text/fit.ts`，`src/text/layout.ts` 若类型牵连。
- 导出：`src/export/compose-core.ts`、`src/export/compose.ts`。
- 应用：`src/app/PreviewStage.tsx`、`src/App.tsx`、`src/app/probe.ts`、`src/app/workspace/shared.ts`、`src/app/workspace/sections/TextSection.tsx`（只改字段路径与写入函数，不改版式）、`src/app/panels/FontPicker.tsx`（只改写入路径）、`src/app/panels/font-entries.ts`。
- 测试：`tests/state/*`、`tests/text/*`、`tests/fonts/*`（新建 `family.test.ts`）、`tests/export/compose.test.ts`、`tests/app/workspace.smoke.test.tsx`、`tests/app/locale-defaults.test.tsx`。
- e2e：`e2e/helpers.ts`、`e2e/desktop.spec.ts`、`e2e/mobile.spec.ts`。
- i18n：五份字典，只改 `preview.font.fallback` 与 `preview.font.upload` 两条，加 `{name}` 参数。
- 文档：`docs/architecture.md`、`docs/contributing.md`、`docs/engineering-lessons.md`。

步骤：

1. `config.ts`
   - 常量：`LINE_SIZE_MIN = 0.04`、`LINE2_SIZE_MIN = 0.02`（原 `LINE2_MIN_RATIO`）、`LINE_SIZE_MAX = 0.92`、`LINE_OFFSET_MAX = 0.25`、`LINE2_FOLLOW_SCALE = 0.62`（原 `STATUS_SECOND_LINE_SCALE`）、`LINE_GAP_RATIO = 0.18`（原 `STATUS_GAP_RATIO`）、`FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const`、`FONT_SOURCES`。注释分别写现状含义，例如“第二行跟随时取第一行基准的比例”“两行之间的留白比例”。
   - 类型：`FontWeight = (typeof FONT_WEIGHTS)[number]`、`FontSource`、`FontChoice`、`Line1Style`、`Line2Style`，`typography` 按规约 D1 重组；删除 `AvatarConfig.v`。
   - 删除 `SIZE_MODES`、`LINE_OVERRIDE_MAX`、`normalizeNumberArray`、`normalizeLine2Size` 及 `lineSizeScales` 折算。
   - `nearestWeight(available, want)` 从 `loader.ts` 移来，行为不变。
   - `lineFont(t, line)`：第二行为 `null` 时返回第一行那份。`fontKey(font)`：`${source}|${family}|${weight}`。
   - `withLine1Font(t, next, weights)`、`withLine2Font(t, next)`、`FOLLOW_LINE1`：按规约 D3，返回 `PartialConfig['typography']`。
   - `DEFAULT_CONFIG.typography`：`line1 = { font: { family: 'Noto Sans SC', source: 'google', weight: 700 }, size: null, offsetX: 0, offsetY: 0 }`，`line2 = { font: null, size: null, offsetX: 0, offsetY: 0 }`，其余字段不变。
   - `normalizeFont(value: unknown): FontChoice | null` 按规约 D1 的整份规则；`line1.font` 为 `null` 时回默认；`line1.size` 为有限数时夹进 `LINE_SIZE_MIN..LINE_SIZE_MAX`，否则 `null`；`line2.size` 同理用 `LINE2_SIZE_MIN`；四个补偿夹进 `±LINE_OFFSET_MAX`。
   - 文件头与字段注释只写现状：契约是什么、`null` 的派生语义、两行模型。带版本号的叙事注释一律改成现状句。
2. `persist.ts`：`PERSIST_KEY = 'gradient-avatar:v4'`，注释“存档结构一变就升键，旧键不读”；删除 `PERSIST_VERSION`；外壳 `{ config, history }`，`loadPersistedState` 只校验 `isRecord(parsed.config)`。
3. `store.ts`：`UiState` 删 `fontStatus` 与 `FontStatus`，加 `fontFallbacks: readonly string[]`（回落中的 `fontKey` 列表，默认空数组）；`reset` 与注释同步；叙事注释改现状。`history.ts` 若哈希里带 `v`，一并去掉。
4. `family.ts`：从 `measure.ts` 移来 `SYSTEM_FALLBACK`、`quoteFamily`、`fontFamilyStack`，新写 `fontString(font: Pick<FontChoice, 'family' | 'weight'>, px)`。`measure.ts` 删掉这几个，`fit.ts` 从 `@/fonts/family` 引。
5. `fit.ts`：`Slot` 带 `font: FontChoice`；第一行槽位取 `line1.font`，第二行取 `lineFont(t, 2)`；晋升分支取 `lineFont(t, 2)` 与 `line2` 的补偿；第二行跟随时 `scale = LINE2_FOLLOW_SCALE`，`line2.size` 非空时按定值；手动判据 `line1.size !== null`；二分区间与夹值引用 `LINE_SIZE_MIN`、`LINE_SIZE_MAX`，删本地 `MIN_FONT_RATIO` 与 `MAX_FONT_RATIO`；`composeParagraph` 与 `build` 用 `fontString(slot.font, px)`。
6. `catalog.ts`
   - `FontEntry` 删 `subsets` 与 `category`；`toFontEntry` 读接口原始 `subsets` 派生 `cjk`，图标判断直接比 `r.category === 'icons'`；删 `FontCategory`、`CATEGORIES`、`toCategory`、`SearchOptions.category`。
   - `toWeights` 只保留 `FONT_WEIGHTS` 里的值。
   - `CATALOG_CACHE_KEY = 'gradient-avatar:font-catalog:v1'`。
   - 模块级 `memo`：第一次需要时从缓存解析一次，不看有效期；`fetchCatalog` 成功后替换。`findFontEntry(family)`：先精选、再 `memo`，按去空白后小写比较，内部用按 family 建的 `Map`。
   - `weightsOf(family)` 与 `FALLBACK_WEIGHTS` 从 `font-entries.ts` 移来，改用 `findFontEntry`。
   - `displayName(family, source)`：上传字体去掉 `UPLOAD_FAMILY_SUFFIX`，其余原样返回。切片 C 再接原生名表。
7. `curated.ts`：67 条删 `subsets` 与 `category` 两列，顺序不动。
8. `loader.ts`
   - `interface FontJob { font: FontChoice; text: string }`；`fontJobs(config)`：`twoLinesOf` 取两行，有文字的行按 `fontKey` 合并文字；两行都空时 `[{ font: t.line1.font, text: '' }]`，样本 `'Aa中'` 只在 `sampleText` 一处。
   - 内核 `loadFont(job, opts)` 不导出：现有 `loadFontForConfig` 的逻辑，入参换成一个 job；`settled`、`inflight`、`loadedChars` 改用 `fontKey` 作键；条目用 `findFontEntry`，查不到才 `familyToFontsourceId`；删 `opts.entry`。
   - `loadFontsForConfig(config, opts)`：`Promise.all(fontJobs(config).map(...))`，返回 `FontLoadResult[]`，`FontLoadResult = { font: FontChoice; via: FontLoadVia; ok: boolean }`，`FontLoadSource` 改名 `FontLoadVia`。
   - `topUpGlyphs(config): Promise<boolean>`：遍历 `fontJobs`，只对 `settled` 里已就绪的字体调 `ensureGlyphs`；`ensureGlyphs` 改为返回是否真的加载了新字。
   - `set.load` 的两处字体简写改用 `fontString`。
   - 删除 `fontFamilyCss`、`quoteFamily`、`isFontReady`、`readyFamilies`、`SYSTEM_STACK`、`GENERIC_BY_CATEGORY`、`nearestWeight`。
9. `google.ts`：`MIRROR_HOSTS` 第二档改 `fastly.jsdelivr.net`；文件头按规约 D10 改成现状理由，删掉“Noto CJK 上不生效”与“单片约 2 KB”。
10. 删除 `src/fonts/index.ts`；`App.tsx` 改为直接引 `@/fonts/curated` 与 `@/state/config`。
11. `compose-core.ts`：`ComposeDeps.loadFontForConfig` 改 `loadFonts: (config) => Promise<FontLoadResult[]>`；`compose.ts` 接 `loadFontsForConfig`。
12. `PreviewStage.tsx`
    - 删除 `resolveFontEntry`。`const fontSetKey = useMemo(() => fontJobs(config).map((job) => fontKey(job.font)).join('\n'), [config])`，作为字体 effect 唯一的字体依赖。
    - `fontStatus` 改局部 `useState<'loading' | 'ready' | 'fallback'>('loading')`；结果里 `ok` 为假的字体写进 `setUi({ fontFallbacks })`，全部成功写空数组。
    - 失败提示放进 `useEffectEvent`，读 `t`，effect 依赖里去掉 `t`；每款失败字体按 `fontKey` 提示一次，文案带 `{name}`，取 `displayName(font.family, font.source)`，上传丢失与网络回落各用一句。
    - 补字形 effect 依赖 `[preview.text, fontSetKey, fontLoading]`：`if (fontLoading) return; void topUpGlyphs(preview).then((changed) => { if (changed && !cancelled) setFontTick((n) => n + 1) })`。
    - 自动字号回写的判据改 `line1.size === null`。
13. `App.tsx` 的 `LocaleDefaults`：`OWNED_DEFAULTS.fontFamily` 读 `line1.font.family`；放手判据加 `typography.line2.font !== null`；写入经 `withLine1Font`，字重取 `nearestWeight(weightsOf(family), line1.font.weight)`。
14. `probe.ts`：`GradientAvatarProbe` 加 `config(): AvatarConfig`（返回 `useAvatarStore.getState().config`）与 `flush(): void`（调 `flushConfigSync`）。
15. `shared.ts`：删除 `withLineValue` 与 `LINE_OVERRIDE_MAX` 引用。
16. `TextSection.tsx`
    - 字号两行、补偿四行、字体按钮、字重 chips 改读写新路径；字号与补偿滑杆的上下限引用 D1 常量，`OFFSET_RANGE` 由 `LINE_OFFSET_MAX` 派生。
    - `baseFontSize = line1.size ?? autoFontSize ?? LINE_SIZE_MIN`；第一行“自动”的 `onReset` 先 `setUi({ autoFontSize: line1.size })` 再写 `line1.size = null`，用当前手动值占位到新解回写。
    - 拖第一行字号时第二行字号跟随则钉住的逻辑保留。
    - 字体按钮与字重 chips 经 `withLine1Font` 写入。
17. `FontPicker.tsx`：选中经 `withLine1Font` 写入，勾选态读 `lineFont(t, 1)`；`nearestWeight` 从 `@/state/config` 引。
18. `font-entries.ts`：只留 `useFontCatalog` 与 `ensureCatalog`。
19. 测试
    - `config.test`：删 `lineSizeScales` 与版本号用例；补 `normalizeFont` 五条（`line2.font = { family: '  ' }` 得 `null`；`weight: 450` 得 500；`weight: 1000` 得 900；来源非法整份作废；`line1.font = 'x'` 回默认）；`lineFont` 跟随与独立；`withLine2Font` 等于第一行时写 `null`；`withLine1Font` 三种第二行状态：跟随不动、只改过字重随第一行换款并吸附字重、钉在别款不动；`FOLLOW_LINE1`。
    - `fit.test`：第二行独立字体进 `ParagraphFit.font`；晋升行用第二行生效字体；手动档下第二行换字体，第一行的 `fontSizePx` 与 `font` 不变；自动档只断言 `fits` 与第二行 `font`。
    - `family.test`：合并 `measure.test` 与 `loader.test` 里的 `quoteFamily`、`fontFamilyStack`、`fontString` 用例。
    - `loader.test`：`fontJobs` 两行同字体合并、两行不同字体各一条、第二行钉了别款但文字为空时只有第一行、两行都空时给第一行；`loadFontsForConfig` 同字体只请求一次、不同字体并行；条目解析：精选命中、缓存 `at` 设成 30 天前也命中、都不中按 family 猜 id，三条都断言 `fetch` 没有打到 `CATALOG_URL`；`topUpGlyphs` 对未就绪或失败的字体不发 load，对已就绪的只补新字且返回值区分有无新字；`result.via` 断言。
    - `catalog.test`：夹具删两列；`findFontEntry` 大小写与空白；`weightsOf` 未知 family 回 `FALLBACK_WEIGHTS`。`curated.test` 夹具同步。
    - `persist.test`、`store.test`：用 `PERSIST_KEY` 常量与新外壳；`fontStatus` 断言换成 `fontFallbacks`。
    - `compose.test`：依赖名同步。
    - `locale-defaults.test`：默认档把第二行字重改成 400 再切到 ja，两行字体都不变。
    - smoke：写入路径同步；第二行从空变成有字、字体与第一行不同时 `loadFontsForConfig` 再被调用一次。
20. e2e
    - `helpers.ts`：`probeConfig(page)` 与 `probeFlush(page)`。
    - `desktop.spec.ts`：`readStoredConfig`、`readStoredTypography`、`readIcon` 改走 `probeConfig`，删掉对应的 poll；`readStoredTypography` 读 `typography.line1.offsetY`。“刷新后从存档恢复”改成：填字、`probeFlush`、`page.reload()`、断言输入框。
    - `mobile.spec.ts`：同上那条。
21. 全仓 grep 旧名，一个不剩：`fontFamily`（配置字段用法）、`fontSource`、`fontWeight`（配置字段用法）、`sizeMode`、`line2Size`、`lineOffsets`、`STATUS_`、`LINE2_MIN_RATIO`、`MIN_FONT_RATIO`、`loadFontForConfig`、`fontStatus`、`gradient-avatar:v3`、`ga3.fonts.catalog`、`@/fonts'`。
22. 文档（随本片提交）
    - `architecture.md`：共享契约首段改成“换结构升 `PERSIST_KEY`，旧存档不读”；契约表 `typography` 行；文字排版一节的字段名与 `null` 语义；状态与持久化一节的存档外壳与测试注入口径（探针读配置，截图注入往 `PERSIST_KEY` 写 `{ config }`）；字体一节写 `fontJobs`、`loadFontsForConfig`、`topUpGlyphs`、`findFontEntry`、fastly 镜像与 `text=` 的现状理由；模块表补 `src/fonts/family.ts`，写明 `src/text` 引用 `src/fonts/family`、`src/fonts` 不引用 `src/text`。
    - `contributing.md`：存档注入一条同上；“目录约定”里桶文件那句改成“库目录都没有出口文件，跨目录直接引用模块”。
    - `engineering-lessons.md`：两处 `gradient-avatar:v3` 与 `{ v: 3, config }` 的操作口径改成引用 `PERSIST_KEY` 与 `{ config }`。

### 切片 B：逐行字体的界面

文件：

- 生成件：`src/components/ui/select.tsx`（CLI 生成，不手改）。
- 块：新建 `src/components/blocks/auto-toggle.tsx`；`src/components/blocks/slider-field.tsx`。
- 文字卡片：`src/app/workspace/sections/TextSection.tsx`；新建 `src/app/workspace/sections/line-font-field.tsx`。
- 选择器：`src/app/panels/FontPicker.tsx` 改名 `FontPickerPanel.tsx`；`src/app/panels/lazy.ts`；`src/app/panels/recent-fonts.ts`。
- 字体：`src/fonts/catalog.ts`（`keepOrder` 与数组形式的 `cjk`）；`src/fonts/curated.ts`（`SYSTEM_FONTS` 从选择器移来）。
- i18n：五份字典与 `src/i18n/keys.md`。
- 测试：`tests/app/workspace.smoke.test.tsx`、`tests/components/slider-field.test.tsx`、新建 `tests/components/auto-toggle.test.tsx`、`tests/i18n/keys.test.ts`、`tests/fonts/catalog.test.ts`。
- e2e：`e2e/desktop.spec.ts`、`e2e/mobile.spec.ts`。
- 文档：`docs/architecture.md`。

步骤：

1. `./node_modules/.bin/shadcn add select`。
2. `auto-toggle.tsx`：`AutoToggle({ active, label, ariaLabel, hint, onClick, slot, disabled })`，从 SliderField 的自动钮抽出，文件头注明出处。可见样式与原来一致；热区 `relative after:absolute after:-inset-y-[11px] after:-inset-x-1 lg:after:-inset-1`；`aria-pressed={active}`，按下态加 `aria-disabled="true"` 且点击不回调；`aria-label={ariaLabel}`，`title={hint}`。
3. `slider-field.tsx`：`auto` 加 `ariaLabel`，自动钮改用 `AutoToggle`，`slot` 为 `slider-auto`。
4. `line-font-field.tsx`：`LineFontField({ line })`。
   - 标签行：`panel.text.line1Font` 或 `line2Font`；第二行标签文字后跟 `AutoToggle`（`slot="font-follow"`，`label=t('panel.text.follow')`，`ariaLabel=t('panel.text.line2Font.follow')`，`hint=t('panel.text.line2Font.followHint')`，`active=line2.font === null`，点击写 `FOLLOW_LINE1`）。
   - 字体按钮（`data-slot="font-trigger"`，`flex-1`，`justify-between`）：名字 `displayName(font.family, font.source)`，这一片先用界面字体渲染；第二行跟随时 `text-muted-foreground`；右侧 `ChevronDownIcon`；`fontFallbacks` 含 `fontKey(生效字体)` 时名字前放 `TriangleAlertIcon`（`size-4 text-amber-600 dark:text-amber-400`，`aria-hidden`），按钮 `aria-describedby` 指向 sr-only 的 `panel.text.fontFallback`；`aria-labelledby` 同时引用标签与名字；`title={font.family}`。
   - 字重：`<Select value onValueChange>`，`SelectTrigger` 带 `data-slot="font-weight"`、`aria-label`（`panel.text.line1Weight` 或 `line2Weight`）、`className="w-30 shrink-0 text-base data-[size=default]:h-11 lg:w-28 lg:text-sm lg:data-[size=default]:h-9"`（高度必须带 `data-[size=default]:` 前缀才压得过生成件）；`SelectValue` 只渲染名字；`SelectItem` 渲染名字加右侧 `tabular-nums` 的小号数值，行内 `style={{ fontWeight: w }}`，手机 `min-h-11`。档位取 `weightsOf(font.family)`，只有一档时 `disabled`。第一行经 `withLine1Font`，第二行经 `withLine2Font`。
   - 弹层外壳：桌面 `<Popover open onOpenChange>`，`PopoverTrigger render` 为字体按钮，`PopoverContent side="bottom" align="start" className="w-[max(var(--anchor-width),22rem)] gap-0 p-0"`，内容 `<Suspense fallback={同高占位}><FontPickerPanelLazy line onDone={close} /></Suspense>`；列表高 `max-h-[min(60vh,calc(var(--available-height)-3.5rem))]`。手机：按钮点击 `setMounted(true)` 并打开，`mounted` 后挂 `<Suspense><FontPickerDrawerLazy line open onOpenChange /></Suspense>`。
5. `FontPickerPanel.tsx`
   - 导出 `FontPickerPanel({ line, onDone })` 与 `FontPickerDrawer({ line, open, onOpenChange })`。抽屉写法照 `IconPicker` 的手机分支：`Drawer`、`DrawerContent className="h-[85dvh] max-h-[85dvh]"`、`DrawerHeader` 里可见的 `DrawerTitle`（该行字体标签），内容是面板。删除 `CommandDialog`、非受控模式与 `trigger`。
   - 分组：已上传（`listUploadedFonts()`，`value` 为 `upload:<family>`，名字 `displayName(family, 'upload')`，用自身 family 渲染，`font.uploaded`）、最近使用、精选（按 `useLocale()` 排组，见规约 D5；繁体组 `cjk: ['tc', 'hk']`；`keepOrder: true`）、全部、系统（`SYSTEM_FONTS`）、上传按钮。
   - 选中：`const current = lineFont(t, line)`；候选的 family 与 source 等于 `current` 时只 `onDone()`；否则 `next = { family, source, weight: nearestWeight(weights, current.weight) }`，第一行 `withLine1Font(t, next, weights)`，第二行 `withLine2Font(t, next)`；Google 字体 `pushRecentFont(family)`；`onDone()`。上传成功后按同一路径写入，`weights` 取 `weightsOf(family)`。
   - `<Command defaultValue={currentValue} shouldFilter={false}>`：`currentValue` 是当前字体在列表里第一次出现的 `分组:id`，依次查已上传、最近使用、精选、全部、系统。
   - 勾选项追加 `<span className="sr-only">{t('font.current')}</span>`。
   - `query` 与 `uploadError` 是面板局部状态。
6. `recent-fonts.ts`：`recentFonts = createPersistedAtom<string[]>({ key: 'gradient-avatar:recent-fonts', fallback: [], parse, serialize: JSON.stringify, equals })`，`parse` 过滤非字符串并截到 8 条，`equals` 逐项比较；`pushRecentFont(family)` 在 `recentFonts.get()` 上置顶去重后 `set`；面板用 `recentFonts.useValue()`。
7. `lazy.ts`：`FontPickerLazy` 换成 `FontPickerPanelLazy` 与 `FontPickerDrawerLazy`，同一个模块两个出口。
8. `catalog.ts`：`SearchOptions` 加 `keepOrder?: boolean`（为真且查询为空时跳过排序），`cjk` 接受单值或数组。
9. `curated.ts`：`SYSTEM_FONTS` 从选择器移来，内容不变。
10. `TextSection.tsx`：按规约 D4 的顺序重排；删原“字体”“字重”两段、`fontOpen`、`fontMounted` 与 `FontPickerLazy`；第二行字号的 auto 用 `panel.text.follow` 与 `panel.text.line2Size.follow`；文件头注释改成“字体紧跟自己那一行输入，字号在字体之下”。
11. i18n，五语同步，`keys.md` 同步
    - 删：`panel.text.font`、`panel.text.fontWeight`、`font.title`。
    - 加：`panel.text.line1Font`、`panel.text.line2Font`、`panel.text.line1Weight`、`panel.text.line2Weight`、`panel.text.follow`（跟随、跟隨、Match、連動、연동）、`panel.text.line2Font.follow`、`panel.text.line2Size.follow`、`panel.text.line2Font.followHint`、`panel.text.fontFallback`、`font.weight.100` 到 `font.weight.900`（规约 D4 的五语名）、`font.current`（当前、目前、current、使用中、사용 중）、`font.uploaded`（已上传、已上傳、Uploaded、アップロード済み、업로드됨）。
    - 改：`panel.text.line2Size.autoHint` 的“改为手动”改成“改为独立”。
    - `keys.test` 的 `dynamicKeys()` 把 `FONT_WEIGHTS` 每一档展开成 `font.weight.<n>`。
12. 测试
    - smoke：两行都有内容时两条字体行，只有第一行时一条；第二行默认跟随态，“跟随”钮 `aria-pressed="true"`，按钮写第一行的字体名且带次要前景色；第二行跟随时打开第二行选择器点打勾项，`line2.font` 仍为 `null`、`past` 长度不变；`line={2}` 选中写 `line2.font`，`line={1}` 选中写 `line1.font` 且第二行仍 `null`；打开时 `[aria-selected=true]` 是该行生效字体；关掉再开搜索框为空；ja 界面第一个精选组是日文；注册一款上传字体后第二行选择器里有这一行，选中后 `line2.font.source === 'upload'`；预置目录缓存、第一行设非精选字体，字重下拉只列真实档位；`fontFallbacks` 含第二行字体键时第二行按钮出现告警图标；手动态点“自动”后回写之前滑杆值不变。
    - `auto-toggle.test`：按下态点击不回调，`aria-label` 与 `aria-pressed`。
    - `slider-field.test`：自动钮走 `AutoToggle` 后原有用例照过。
    - `catalog.test`：`keepOrder` 与数组 `cjk`。
13. e2e
    - 桌面：点第二行字体按钮，`[data-slot=popover-content]` 的顶边不高于按钮底边，左边与按钮左边相差不超过 1 px，页面上没有遮罩层；`getByRole('combobox', { name: '第二行字重' })` 点开，点 `getByRole('option', { name: /常规/ })`，`probeConfig` 的 `typography.line2.font.weight` 为 400；点第二行字体的“跟随”，`line2.font` 回 `null`；“桌面首屏放得下四节”原样通过。
    - 手机：字体按钮、字重触发器高度不低于 44 px；在“跟随”钮可见框上沿外 10 px 处 tap 也能触发；打开第二行字体抽屉，抽屉头可见“第二行字体”。
14. 本片额外核对：`npm run build` 后 `dist/index.html` 的入口与 modulepreload 引用的 chunk 里搜不到 `cmdk-input` 与抽屉的 `data-slot="drawer-content"`，`npm run budget` 的首屏数字写进交付说明。
15. 文档（随本片提交）：`architecture.md` 界面结构里文字卡片的顺序、字重下拉与“跟随”钮、字体选择器桌面弹层与手机抽屉、选择器分组；代码分割一节的懒加载出口。

### 切片 C：字体名预览

文件：

- 字体：`src/fonts/curated.ts`（`NATIVE_NAMES`）、`src/fonts/catalog.ts`（`displayName` 接原生名、`score`、`langOfScript`）、`src/fonts/google.ts`（`buildCss2TextUrl`）、新建 `src/fonts/preview.ts`。
- 界面：新建 `src/app/panels/use-font-preview.ts`、新建 `src/app/panels/font-item.tsx`、`src/app/panels/FontPickerPanel.tsx`、`src/app/workspace/sections/line-font-field.tsx`。
- 测试：`tests/fonts/google.test.ts`、`tests/fonts/catalog.test.ts`、`tests/fonts/curated.test.ts`、新建 `tests/fonts/preview.test.ts`、`tests/setup.ts`、`tests/app/workspace.smoke.test.tsx`。
- e2e：`e2e/desktop.spec.ts`、新建 `e2e/fixtures/preview-subset.woff2`。
- 文档：`docs/architecture.md`、新建 `docs/adr/0007-font-name-preview.md`、`docs/adr/0003-google-fonts-loading.md` 状态行。

步骤：

1. `curated.ts`：`NATIVE_NAMES: Readonly<Record<string, string>>`，键是 family。精选 29 条取自评审轮核实结果（`docs/audits/2026-09-23-v8.0-plan-review.md` 附录），系统字体 4 条：PingFang SC 苹方-简、Microsoft YaHei 微软雅黑、Hiragino Sans ヒラギノ角ゴシック、Apple SD Gothic Neo 애플 SD 산돌고딕 Neo。这一段单独写来源与核对日期。
2. `catalog.ts`
   - `displayName(family, source)`：上传字体去后缀，其余 `NATIVE_NAMES[family] ?? family`。
   - `score()` 比完 family 与 id 再比 `normalize(displayName(entry.family, 'google'))`；系统组的过滤同时匹配 family 与显示名。
   - `langOfScript(cjk)`：sc 为 `zh-Hans`，tc 为 `zh-Hant`，hk 为 `zh-HK`，jp 为 `ja`，kr 为 `ko`。
3. `google.ts`：`buildCss2TextUrl(family, weight, text)`，输出 `${GOOGLE_CSS2_ENDPOINT}?family=${encodeFamily(family)}:wght@${weight}&text=${encodeURIComponent(text)}`，不带 display；`encodeFamily` 保持私有。
4. `preview.ts`，只 import `./google`、`./catalog` 与 `@/state/config`
   - `previewFamily(id)` 返回 `fp-<id>`。
   - 模块状态：`Map<id, string | null>` 记结果，`Set<id>` 记已发出的请求，`Set<() => void>` 记订阅者。
   - `requestPreview(entry)`：幂等，每个 id 只发一次。`fetch(buildCss2TextUrl(entry.family, nearestWeight(entry.weights, 400), displayName(entry.family, 'google')), { priority: 'low' })`，取文本，正则取第一条 `url(...)`，取不到算失败；`new FontFace(alias, 'url(' + url + ')')`，不写字重描述符；`await face.load()`，`document.fonts.add(face)`；成功记别名，任何一步抛错记 `null`；通知订阅者。
   - `previewFamilyOf(id): string | null`、`subscribePreview(cb): () => void`。
   - `resetPreviewState()`，仿照加载器的 `resetFontLoaderState`，供测试 `afterEach` 用。
5. `use-font-preview.ts`
   - `usePreviewFamily(entry | undefined)`：`useSyncExternalStore(subscribePreview, () => (entry ? previewFamilyOf(entry.id) : null))`。
   - `useEagerPreview(entry | undefined)`：effect 里 `requestPreview(entry)`，返回 `usePreviewFamily(entry)`。卡片按钮用。
   - `useFontPreview(entry)` 返回 `[ref, family]`：`ref = useCallback((node) => { … }, [entry.id])`，节点上 `new IntersectionObserver(cb, { root: node.closest('[cmdk-list]'), rootMargin: '50% 0px' })`，相交时 `requestPreview(entry)` 并 `disconnect()`；返回的清理函数 `disconnect()`（React 19 ref cleanup）。已请求过的 id 不再观察。
6. `font-item.tsx`：`FontItem`，选择器里唯一的候选项组件，面板的三种来源都用它，也是唯一调用 `useFontPreview` 的组件。
   - `CommandItem`：`value`、`data-checked`、`className="min-h-11 lg:min-h-9 gap-2"`、`onSelect`。
   - 名字格：`const [nameRef, alias] = useFontPreview(entry)`（Google 字体），`ref={nameRef}`，就绪后 `data-preview="ready"` 与 `style={{ fontFamily: fontFamilyStack(alias) }}`；系统与上传字体直接 `fontFamilyStack(family)`。类名 `truncate -mx-1 px-1 text-base leading-6 font-normal [font-synthesis:none] data-[preview=ready]:animate-in data-[preview=ready]:fade-in-0 duration-150 motion-reduce:animate-none`；有原生名时加 `shrink-0 max-w-[65%]` 与 `lang={langOfScript(entry.cjk)}`；没有原生名时加 `min-w-0 [font-size-adjust:cap-height_0.7]` 与 `lang="en"`。
   - 有原生名时后面跟 `<span lang="en" className="text-muted-foreground min-w-0 truncate text-xs">{family}</span>`。
   - 勾选项的 sr-only “当前”随组件走。
7. `FontPickerPanel.tsx`：各组改用 `FontItem`，面板只管分组、搜索、上传与写入。
8. `line-font-field.tsx`：Google 字体经 `findFontEntry(family)` 取条目，`useEagerPreview(entry)` 就绪后按钮名字写 `fontFamily: fontFamilyStack(alias)`、`font-normal`、`[font-synthesis:none]`，`lang` 同选择器行；系统与上传字体用自身 family。
9. 测试
   - `tests/setup.ts`：惰性 `IntersectionObserver` 替身，observe 不回调，和现有替身放一起，保证其余用例不发真实请求。
   - `preview.test`：假 `fetch`、假 `FontFace`、`Object.defineProperty(document, 'fonts', …)` 提供 `add`：请求的是 `buildCss2TextUrl` 给出的地址，带 `priority: 'low'`；别名以 `fp-` 开头且不等于真名；同一字体请求两次只 `fetch` 一次；`fetch` 失败、CSS 无 `url`、`load` reject 都记 `null` 且不再请求；成功后订阅者被通知、`previewFamilyOf` 返回别名。
   - `google.test`：`buildCss2TextUrl` 带显式字重，中文文本正确编码。
   - `catalog.test`：`displayName` 三种来源；用 fontsource 形态的目录条目，搜原生名能命中；`langOfScript`。
   - `curated.test`：`NATIVE_NAMES` 的每个键都是带 `cjk` 的精选 family 或 `SYSTEM_FONTS` 之一，值非空且不等于键。
   - smoke：用例内 `vi.stubGlobal` 一个 observe 即以 `isIntersecting: true` 回调的 IO、返回一段 `@font-face` 的假 `fetch`、`load` 直接 resolve 的假 `FontFace` 与 `document.fonts.add`，走真实链路断言行出现 `data-preview="ready"`、名字格 `style.fontFamily` 以 `"fp-` 开头；同一款精选字体在“精选”与“全部”两组的名字格文字相同；带原生名的行 `lang` 与书写系统一致，拉丁行带 `font-size-adjust`；卡片按钮就绪后 `style.fontFamily` 以 `"fp-` 开头。`afterEach` 调 `resetPreviewState()`。
10. e2e
    - 夹具 `e2e/fixtures/preview-subset.woff2`：用 Chrome UA 请求 `https://fonts.googleapis.com/css2?family=Inter:wght@400&text=Inter`，取 `src` 下载，约 1.3 KB；来源写在 `helpers.ts` 的注释里。夹具不放 `public/`，那里的 woff2 会进 PWA 预缓存。
    - 用例 `test.use({ serviceWorkers: 'block' })`。`page.route((url) => url.hostname === 'fonts.googleapis.com' && url.searchParams.has('text'), …)` 回一段 `@font-face`，`src` 指向 `https://fonts.gstatic.com/l/preview-test.woff2`；后者 `route.fulfill({ path })` 回夹具；其余请求 `route.fallback()`。
    - 打开第一行字体选择器，等第一屏某个 `[data-preview="ready"]` 出现，断言名字格 `font-family` 以 `"fp-` 开头；关掉再打开，搜一款首屏没出现过的字体，等它那一行就绪。
11. 文档（随本片提交）
    - `architecture.md` 字体一节加预览通道：别名注册、每行一个观察器、每款一次、低优先级、只走 Google、失败留界面字体；原生名表的维护口径。
    - 新建 ADR-0007：预览通道的决策、否决的预渲染与镜像兜底、`text=` 结论的更正。
    - ADR-0003 状态行注明“`text=` 一条被 ADR-0007 修订”。

## 收尾（主对话）

- `README.md` 特性段补逐行字体与字体名预览。
- `CHANGELOG.md` 8.0.0（major：存档键升级，旧存档作废）；`package.json` 与 `package-lock.json` 版本 8.0.0。
- `docs/engineering-lessons.md` 新增“逐行字体与字体名预览（v8.0，2026-09-23）”一节：外部事实会过期，复用前用浏览器 UA 复测；预览字体用别名注册防污染；样式重算按帧合并，排队限流是负优化；存档键只在一处定义，测试经探针读配置；弹层外壳常驻、面板懒加载的拆法。
- `docs/contributing.md` “智能体协作”加两条：临时文件只写会话草稿目录；不关闭共享浏览器。
- `docs/memory/owner-preferences.md` 加“预览只要最小形态”一条。
- 规约封存：`spec.md` 尾部补“实到范围”，状态行改已封存。
- 闸门五步、e2e 两档、`npm run screenshots` 逐张看图，README 样张若受影响一并重生成。
- 打 `v8.0.0` 标签并推送。

## 提交批次

1. `docs: v8.0 逐行字体与字体名预览的调研、规约、计划与评审处置`
2. 切片 A：`refactor(config)!: 逐行参数收成 line1 与 line2，字体按行加载，存档键升 v4`
3. 切片 B：`feat(text): 第一行与第二行分别设字体与字重，第二行默认跟随`
4. 切片 C：`feat(font): 字体选择器里每个字体名用自己的字体渲染`
5. 收尾：`docs: v8.0 收尾，README 与 CHANGELOG 定版 8.0.0，规约封存，经验落盘`
