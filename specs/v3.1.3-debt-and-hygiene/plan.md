# 债务清理与发布卫生 v3.1.3 计划（怎么造）

对应规约：`spec.md`。按薄切片推进，每一步都能独立验证、独立提交，
提交切分见 §6。审计当轮已修掉的三件（SECURITY、版本、MCP）在 §0 记录验收。

## 0. 审计当轮已修（验收即可，不再动代码）

1. `SECURITY.md` 重写：支持版本表改到 3.1.x，安全实践改述 v3 的真实安全面。
2. `package.json` 与 `package-lock.json` 根条目版本升到 3.1.2，与 CHANGELOG 对齐。
3. `.mcp.json` 的 shadcn MCP 改走 `./node_modules/.bin/shadcn mcp`，不再 `npx @latest`。

验收：`node -e` 读两个 JSON 版本一致；SECURITY 无 v1 口径残留；`.mcp.json` 无 `npx`。

## 1. 切片一：发布标签与约定

1. 按规约 §2 的 SHA 打四个标签，打前 `git log --oneline` 核对提交内容。
2. `docs/contributing.md` 补发布约定两句话。
3. 验证：`git tag` 列出 v3 线四标签；`git describe` 在 HEAD 上给出 v3.1.2 后代。

## 2. 切片二：样张脚本与重生成

1. 写 `scripts/samples.mjs`：起 `vite preview`（先 `npm run build`），Playwright 打开临时入口页，
   页面里对 `STYLE_LIST × PALETTES` 逐格调 `composeAvatar`（352 px，与旧样张同尺寸），
   拼成两张网格加一张文字效果样张，截图落 `docs/assets/samples/`。
   临时入口走 `?samples=1` 的 dev-only 动态 import，与 probe 同一套路，不进生产 chunk。
2. 重生成三张图，README 的图注不动（正文口径已经是对的，换图即对齐）。
3. 验证：肉眼逐张看，颗粒列无同心圆；头部默认值标注与 `DEFAULT_CONFIG` 逐字核对。

## 3. 切片三：CI e2e 与预算守卫

1. `ci.yml` 加 `e2e` job 与 concurrency；触发限 push 到 main 与 `workflow_dispatch`。
2. 写 `scripts/check-budget.mjs`：读 `dist/index.html`，取 entry 与 modulepreload 的 href，
   用 `node:zlib` 的 gzip 逐文件求和，与 250 KB 比较，超了退出码 1 并打印每行明细。
   `package.json` 加 `"budget": "node scripts/check-budget.mjs"`，CI 在 build 后跑。
3. 验证：本地 `npm run build && npm run budget` 打印 204 KB 上下并通过；
   临时把阈值调低跑一次确认会红，再改回。e2e job 在推送后看一次绿灯。

## 4. 切片四：契约去重

1. `App.tsx` 删 `LOCALE_FONT_FAMILY`，import `LOCALE_DEFAULT_FONT`；
   `tests/app/locale-defaults.test.tsx` 若引用本地常量同步改。
2. `store.ts` 删私有 `randomSeed`，import 引擎那份；`tests/state/store.test.ts` 的
   10 位断言改 12 位（`/^[0-9a-z]{12}$/`），注释里“10 位 base36”的措辞同步。
3. `TextPanel` 状态徽章滑杆的 `onChange` 去掉 `layout: { scale }` 那一支；
   `config.ts` 的 `layout.scale` 注释加 deprecated 与移除条件（随 v3.2 `logo` 一起删）。
4. 补一条单测：状态徽章下调滑杆后 `encodeConfigToHash` 的载荷不含 `layout.scale`；
   只带 `layout.scale` 的旧载荷解出来第二行比例仍等于该值（迁移用例若已有则核对不红）。
5. 验证：`npm test`、`npm run typecheck` 全绿；grep 全仓 `LOCALE_FONT_FAMILY` 与
   store 私有 randomSeed 无残留。

## 5. 切片五：撤销重做、历史缩略图、noscript

1. store 加 `past` / `future` 栈与 `undo` / `redo`；`setConfig`、`randomize`、`randomizeAll`、
   `restore`、`reset` 入栈；`setUi` 与字体接管写的 patch 同样经过 `setConfig`，自然入栈。
   顶栏加两颗 `Undo2` / `Redo2` 按钮带禁用态；`useEffect` 挂键盘监听，
   事件目标在 `input` / `textarea` 或 `isContentEditable` 时放行。五份字典加 key。
2. `history.ts` 的条目类型加可选 `thumb`；`pushHistory` 保持纯函数，缩略图由调用方
   （BottomBar 与 ExportDrawer 的 push 点）异步生成后调 `attachThumb(index, dataUrl)` 补写，
   生成失败就留空，历史条回落到 CSS 近似。`persist.ts` 写盘前量 JSON 长度，
   超 400 KB 从最旧条目丢 `thumb` 直到放下。
3. `index.html` 的 `<body>` 里加 `<noscript>` 双语一句。
4. 验证：单测覆盖入栈、上限 50、undo 后 redo 再 undo 的往返；e2e 加一条：
   改文字、按 `mod+z`、输入框回到旧值；历史缩略图在导出后一格内出现 `img`。

## 6. 切片六：镜像版本固定与文档卫生

1. `catalog.ts` 缓存条目保留 `version`；`google.ts` 的镜像 URL 函数加版本参数；
   `loader.ts` 传 `entry.version`；`curated.ts` 的 `FontEntry` 加可选 `version`，
   精选清单按 fontsource 当前版本填一次并注释核对日期。
2. 单测：目录带版本时镜像 URL 含 `@<version>`；无版本回落 `@latest`。
3. `docs/memory/` 改名 `docs/memory/`，更新 `MEMORY.md` 自指、`README.md` 与
   `contributing.md` 的路径；`contributing.md` 文档表加 `docs/audits/` 一行。
4. 验证：grep 全仓 `docs/memory` 无残留引用；`npm test` 全绿。

## 7. 提交切分

1. 标签与 contributing 约定。
2. 样张脚本与三张图。
3. CI e2e job 与预算脚本。
4. 契约去重三件加测试。
5. 撤销重做。
6. 历史缩略图。
7. noscript、镜像版本、memory 改名与文档表。
8. CHANGELOG 记 3.1.3，`package.json` 版本同轮升到 3.1.3，`docs/memory` 的
   项目记忆补 v3.1.3 一节（改名后是 `docs/memory`）。

## 8. 风险

- 样张脚本要起 preview 与 WebGL 软件渲染，首次跑约一两分钟；它是按需脚本，不进 CI。
- 撤销栈会让每次 `setConfig` 多存一份配置引用，配置对象小（约 1 KB），50 份可忽略；
  但拖滑杆的 300 ms 防抖落盘不受影响，入栈按动作不按防抖。
- 历史缩略图让写盘体积上涨，400 KB 的降级线按 8 条全带图实测后定，规约给的是起点。
