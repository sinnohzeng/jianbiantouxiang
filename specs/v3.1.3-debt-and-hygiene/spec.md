# 债务清理与发布卫生 v3.1.3 规约（造什么）

状态：已定稿，2026-08-31。来源是 `docs/audits/2026-08-31-tech-doc-debt-audit.md` 的逐项结论，
本规约把审计发现全部落成可验收的条目，不留 TODO。编号沿用仓库惯例：可用性增量按补丁级走，
先例是 3.1.1。

## 1. 目标

把审计确认的十七项发现清掉：发布卫生四件（版本标签、SECURITY、manifest 版本、MCP 配置），
文档与样张三件（样张、memory 目录名、handoff 类别），CI 与预算守卫三件，契约重复三件，
体验缺口三件，外加一处供应链加固。另有五项（F17 到 F21）以旧规约评审修订的形式落地，不在本规约切片里。
每一项都有验收口径，做完任何一项就提交一项，薄切片推进。

## 2. 发布卫生

1. 给 v3 线补四个标签：`v3.0.0` 打在 `2236687`，`v3.1.0` 打在 `c148a53`，`v3.1.1` 打在
   `b5271fb`，`v3.1.2` 打在 `37a3d3b`。SHA 以提交内容为准：先找该版本 CHANGELOG 条目齐全的
   最后一次提交，标签打在它上面，打前用 `git log --oneline` 核对。
2. `docs/contributing.md` 的“提交”一节补发布约定：CHANGELOG 记了某个版本的收尾提交合入后，
   同轮打 `v<semver>` 标签；`package.json` 的 `version` 与 CHANGELOG 最新版本同轮更新。
3. `package.json` 版本与 CHANGELOG 脱节、`SECURITY.md` 停在 v1 口径、`.mcp.json` 用
   `npx shadcn@latest` 三件，已在审计当轮直接修掉，本规约只记录验收：版本为 3.1.2 且锁文件同步；
   SECURITY 的支持版本表与 v3 安全面描述与现状一致；`.mcp.json` 走 `./node_modules/.bin/shadcn`，
   与 `docs/engineering-lessons.md` 的 EALLOWSCRIPTS 结论一致。

## 3. 样张与视觉文档

1. 新增 `scripts/samples.mjs`：用离屏 `composeAvatar` 逐格渲染“质感 × 配色”网格与文字效果样张，
   经 Playwright 截图落盘到 `docs/assets/samples/`，把审计前随会话消失的 scratchpad 管线收进仓库。
   网格头部写清当轮默认值（styleParams、highlight、示例文字与文字效果），下次改默认值重跑一条命令。
2. 用该脚本重生成三张样张。现行样张是 v3.0 调参期的产物：颗粒列还带 v3.1.2 已移除的同心圆 ripple，
   示例文字与文字效果也不是当前默认（两行“飞书 / 效率先锋”、白色发光）。重生成后 README 的两张
   质感网格与一张文字效果图与正文口径一致。
3. 验收：新样张颗粒列不出现同心圆；头部标注与 `DEFAULT_CONFIG` 一致；`npm run screenshots` 不受影响。

## 4. CI 与体积守卫

1. `.github/workflows/ci.yml` 增加独立 `e2e` job：push 到 main 与 `workflow_dispatch` 时跑，
   步骤为 `npm ci`、`npx playwright install --with-deps chromium`、`npm run build`、`npm run e2e`，
   带 concurrency 组取消进行中的旧跑。PR 上不跑，保住现在的四步反馈速度。
   v3 规约 §4 原来承诺 CI 跑冒烟，落地时只做了四步且没有决策记录，这次把承诺兑现成独立 job。
2. 新增 `scripts/check-budget.mjs`：按 `docs/architecture.md` 的口径，从 `dist/index.html` 取
   entry script 与全部 `modulepreload`，逐文件 gzip 求和，超过 250 KB 退出码非零并打印明细表。
   挂到 CI 的 build 之后，另加 npm script `budget` 供本地跑。
3. 首屏预算以 250 KB gzip 为唯一数字。审计实测当前首屏 204.09 KB gzip（index 154.16、
   preload-helper 11.05、i18n 16.70、useScrollLock 22.18）。v3.1 规约 §5 验收 9 曾给 v3.2 定 160 KB 目标，
   该数字作废：它在写下的当天就低于实际值，保留只会让守卫从第一天起就红；v3.2 的图形与选择器全部
   懒加载、不进首屏，由预算脚本守住总量。

## 5. 契约去重

1. `src/App.tsx` 的 `LOCALE_FONT_FAMILY` 删除，改 import `src/state/config.ts` 导出的
   `LOCALE_DEFAULT_FONT`。现状是契约文件导出并注释“App.tsx 的 LocaleDefaults 用它”，
   App.tsx 另存了一份相同的映射，`tests/state/config.test.ts` 守的是没人读的那份，
   正是 `docs/engineering-lessons.md`“契约里加了字段，不等于有人读它”的常量版本。
2. `src/state/store.ts` 的私有 `randomSeed` 删除，改 import `@/engine/seed` 的 `randomSeed`。
   引擎那份导出后全仓无人使用，store 这份是 10 位 base36，引擎那份 12 位。统一后
   `tests/state/store.test.ts` 第 95 行的 `/^[0-9a-z]{10}$/` 断言同步改成 12 位口径。
3. `layout.scale` 的双写收回：`TextPanel` 的状态徽章滑杆只写 `typography.lineSizeScales`，
   不再同写 `layout.scale`。`normalizeConfig` 里旧链接的迁移保留，`layout.scale` 在
   `config.ts` 注释标为 deprecated，随 v3.2 的 `logo` 用途一起从契约移除。
   新链接只带行级数组，链接更短；v3.1 及更早的旧链接靠迁移照常渲染。

## 6. 体验缺口

1. 配置级撤销与重做：store 增加 past / future 两个栈，上限 50，`setConfig` 一系动作入栈，
   `undo` / `redo` 两个动作；顶栏两颗按钮带禁用态，键盘 `mod+z` 与 `mod+shift+z`，
   焦点在输入框与文本域里不拦截。不进 URL、不进 localStorage、不进历史条。
   判据：用户连调十个滑杆把版式调坏之后，除了 reset 还有路可回；现状只有 reset 一条路。
2. 历史条真缩略图：`pushHistory` 时异步用 `composeAvatar` 渲染 96 px 的 JPEG 缩略图
   （quality 0.7，约几 KB），存进历史条目新增的可选字段 `thumb`。契约只增字段，旧存档没有
   `thumb` 时历史条照现在的配色渐变加首字渲染。序列化超过 400 KB 时从最旧条目开始丢缩略图再写。
   判据：同配色不同质感的两条历史现在缩略图一模一样，认不出哪张是哪张。
3. `index.html` 补 `<noscript>`：一句双语提示（中文加英文），告知本工具需要 JavaScript。

## 7. 供应链加固

镜像 CSS 的 `@latest` 换成具体版本：fontsource API 的目录条目带 `version` 字段，
`src/fonts/catalog.ts` 缓存时保留它；`buildMirrorCssUrlsForHost` 接收版本参数，
有版本就拼 `@<version>`，没有才落 `@latest`。`curated.ts` 给精选清单补固定版本字段，
走镜像时优先用它。主链 css2 由 Google 签发、内容随 UA 变化，无法也不需 SRI，维持现状。

## 8. 文档卫生

1. `docs/memory/` 改名 `docs/memory/`：仓库同时被多种代理会话使用，目录名不绑工具；
   `MEMORY.md`、`README.md`、`docs/contributing.md` 里的引用同轮更新。该目录引用的两份
   全局记忆（shadcn 密钥坑、评审 workflow 判据）的核心结论都已在
   `docs/engineering-lessons.md` 里，改名不丢信息。
2. `docs/contributing.md` 的文档表补两行：审计报告放 `docs/audits/`，按日期命名，
   只记当轮发现与落地去向，不记现状；交接文放 `docs/handoff/`，按特性命名，
   只在会话切换时写，内容过期由接手会话更新或删除。

## 9. 非目标

- 不做像素级视觉回归平台。软件渲染下 WebGL 出图不稳定，像素对比会制造假红；
  视觉核查维持“`npm run screenshots` 加逐张看”，样张脚本让这一步有稳定输入。
- 不给 css2 主链加 SRI，不引 WASM WebP 编码器，不上 i18next，不做 SSR：
  审计复核过，维持 `docs/adr/` 的既有决策。
- 不动导出体积二分与 8192 降级路径：那是 `docs/engineering-lessons.md` 记过的权衡，
  有实测数字背书，不是债务。
