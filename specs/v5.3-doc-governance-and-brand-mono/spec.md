# 文档治理与品牌单色 v5.3 规约（造什么）

状态：已封存。与实到实现的差异见文末“实到范围”，现状以常驻文档与代码为准。

## 1. 目标

四件事，一轮做完：把常驻文档里的漂移清零并归位到单一定义处；把 CI 上失效的闸门修好；给项目记忆与规约定一套准入判据，让它们不再囤积历史叙事；把品牌图标的单色切换搬到界面上，并且让 58 个品牌全部支持。

前三件是债务，第四件是需求。合成一轮的理由是它们共用同一次闸门与同一次文档同步。

## 2. 用户故事

- 作为下一个接手这个仓的人（或智能体），我照着 `docs/architecture.md` 配部署，不会踩到一条已经被删掉的重写规则。
- 作为提交者，我 push 到 main 之后 CI 是可信的：绿就是真绿，红就有人管。
- 作为长期维护者，我的项目记忆不会因为每发一版就长一截而变得没人读。
- 作为用户，我在挑选栏就能把品牌标志切成单色，不必先打开选择器；而且我挑的每一个品牌都切得动。

## 3. §A 文档漂移清零与 SSOT 归位

### A1 危险漂移，优先修

两处把已删除且已判定有害的部署规则写成现行口径，照做会复现线上 `/about` 的 `ERR_TOO_MANY_REDIRECTS`：

- `docs/architecture.md` 的构建与部署一节，`_redirects` 里 `/about` 排在通配之前那句。
- `docs/memory/project-v5-workspace.md` 同一句。它比前者更危险，记忆是给后续会话当操作指引读的。

改法：删掉重写规则那半句，只保留仍然成立的部分（service worker 关掉导航兜底，`vite.config.ts` 的 `navigateFallback: null`），并写清 `/about` 由 Pages 静态资源层自己映射到 `about.html`。

### A2 事实性过期

| 落点 | 现在写的 | 实际 |
| --- | --- | --- |
| `README.md` 它做什么 | JPG 默认压到 1 MB 以内 | `src/state/config.ts` 的 `sizeTarget: '2mb'` |
| `README.md` 怎么用第 2 步 | “随机配色与质感”；操作条有“文字”快捷入口 | 已改名“全部随机”；“文字”入口 5.0.0 删除 |
| `README.md` 技术说明 | 首屏 JS 205 KB gzip | 当前 `dist/` 实跑 `npm run budget` 得 245.30 KB |
| `README.md` English 摘要 | 26 palettes | 37 套，中文段自己写的就是 37 |
| `docs/architecture.md` 技术栈表 | React 19，无路由，单页单视图 | `appType: 'mpa'`，两个入口，同文件 304 行自己写的是两个入口 |
| `docs/architecture.md` 目录结构表 | `src/palettes/` 26 套 | 37 套，同文件 225 行自己写的是 37 |
| `docs/architecture.md` 测试一节 | e2e 覆盖清单 | 缺关于页、赞赏区、炫技层背景、微信长按四类现存用例 |
| `docs/contributing.md` 命令表 | 自称完整 | 缺 `npm run gen:brand` |
| `docs/contributing.md` 目录约定 | 六个库目录，每个有 `index.ts` | `src/graphics/` 是第七个且无 `index.ts`；`src/about/` 未列 |
| `docs/contributing.md` i18n 前缀 | 12 个 | 16 个，缺 `about`、`icon`、`reset`、`update` |
| `docs/adr/0004-export-pipeline.md` | 默认 1024×1024 | 2048×2048，体积档 2 MB |
| `docs/memory/project-v3-rewrite.md` | 首屏预算 250 KB 由 CI 守 | 5.0.0 已从闸门与 CI 撤下 |

首屏体积这个数字在四处出现过，是本轮 SSOT 归位的样板：**只在 `docs/architecture.md` 留一处定义**，README 与记忆改成指过去，不复述数字。数字会变，指针不会。

### A3 常驻文档里的变更叙事

`docs/contributing.md` 自己写着常驻文档只写现状，变更叙事进 `CHANGELOG.md`。`docs/architecture.md` 有三处违反自己这条约定（v5 之前的自动取色、5.0 之前的 star-burst 粒子、炫技层落地后的实测数字），`README.md` 有一处（颗粒质感的随机形状池）。四处全部删掉，对应叙事在 CHANGELOG 里已有条目。

### A4 缺一份 ADR

站点从单入口改成 `appType: 'mpa'` 两入口、关掉 service worker 导航兜底、以及 `_redirects` 重写规则被 Pages 资源层的 HTML 规范化否决，这三件事是一条连贯的决策链，目前只散在 CHANGELOG 里。补 `docs/adr/0006-multi-page-and-pages-routing.md`，把否决掉的方案（给 `/about` 写 200 重写）连同否决理由一起记上。ADR-0004 的默认尺寸按 A2 修正，并补一条状态注解。

### A5 规约回写

`specs/v5.0-workspace/spec.md` 与 `plan.md` 的头部状态行还停在“§B 待定稿”，而 §B 已经全部落地并发布三个版本。§4 里另有六处与实到实现相反的描述（微调列位、拆列断点、操作条跨度、参考层开关位置、文字色自动挡、字重与画布落点）。

按 §5 定的规约治理口径处理：**不逐条改写正文**，在文件尾部补一节“实到范围”，把差异一次性列清并指向 CHANGELOG 的 5.0.0 段，头部状态行改成已封存。

## 4. §B CI/CD 修复

`main` 上的 CI 从 v5.0 开发期起连红六轮无人处理，红的都是 e2e job；同一提交打 tag 那几次是绿的，因为 e2e 只在 `refs/heads/main` 跑。本地全量 33 条 1.6 分钟全绿，CI 上同一套要 10 分钟并挂两条。

### B1 测试超时预算重排

Playwright 的测试超时与断言超时是两条独立预算，测试超时会直接终止测试，断言拿不满自己那份，报出来的错就变成 `Test timeout exceeded`，把真正的失败点盖掉。

`e2e/desktop.spec.ts` 有六处 `test.setTimeout(PROBE_TIMEOUT_MS)` 与断言的 `timeout: PROBE_TIMEOUT_MS` 同为 60 秒，正踩在这上面。改法：

- `PROBE_TIMEOUT_MS` 保持 60 秒，作为**断言**预算。
- 新增 `PROBE_TEST_TIMEOUT_MS`，取 `PROBE_TIMEOUT_MS` 的两倍再加 `openApp` 的余量，作为 `test.setTimeout` 的值。测试预算必须严格大于它内含的最大断言预算。
- CI 上再乘一档系数：runner 是 2 vCPU 跑 2 worker，两路 SwiftShader 上下文加 2048² 合成，比本机慢约六倍。系数由 `process.env.CI` 判定，写在 `playwright.config.ts` 与 `e2e/helpers.ts`，不在用例里散落魔数。

### B2 硬编码轮询预算

`expect.poll` 的五处 `timeout: 5000`（desktop 三处、mobile 两处）在 CI 上偏紧。统一改用 `e2e/helpers.ts` 导出的 `POLL_TIMEOUT_MS`，本机 5 秒、CI 15 秒。

### B3 playwright.config.ts 的过期注释与 worker

配置里那句“软件渲染下合成 1024 要几秒”的注释停在默认画布还是 1024² 的时代，现在默认是 2048²。注释按现状改写。CI 的 worker 数显式钉成 2，不依赖 runner 核数的默认推断。

### B4 闸门缺口

- `npm run format:check` 不在任何闸门里。加进 CI 的 check job，排在 lint 之后。
- `npm test` 带 `--passWithNoTests`，零用例也能绿。去掉这个开关。
- e2e job 生成 HTML 报告但不上传。失败时上传 `playwright-report/` 与 `test-results/`，否则 CI 红了只能靠日志猜。

### B5 `_redirects` 的回归守卫

5.2.0 修掉的那个死循环目前只有一条注释在警告。加一条单测读 `public/_redirects`，断言不出现任何指向 `.html` 的 200 重写。这条守的是配置文件本身，不需要起 Pages 资源层。

### B6 覆盖缺口补测

- `src/about/` 无任何单测：补 `hasSupport()` 与渲染分支的 jsdom 单测，覆盖赞赏区空态（5.2.0 把那条 e2e 改写后空态就没人守了）。
- `src/app/sw-update.ts` 无任何测试：补轮询间隔、`visibilitychange` 与 `focus` 复查、`onNeedRefresh` 分支的单测。
- 品牌变体切换写回 `icon.id` 缺用例：并入 §6 的验证。

## 5. §C 记忆与规约治理

### C1 按半衰期分三层

| 层 | 落点 | 写什么 | 谁读 |
| --- | --- | --- | --- |
| 常驻文档 | `README.md`、`docs/architecture.md`、`docs/contributing.md`、`AGENTS.md` | 现状。同一事实只定义一次，别处给指针 | 人与智能体，每次 |
| 冻结快照 | `specs/<version>/`、`docs/adr/`、`CHANGELOG.md` | 当时为什么这么定、否决了什么、改了什么。写完封存不回写 | 按需 |
| 项目记忆 | `docs/memory/` | 前两层都推不出来的当前事实 | 按需，索引常驻 |

### C2 记忆准入四问

一条事实要进 `docs/memory/`，四问全过才准入：

1. 能从代码或配置读出来吗？能，就不进。
2. 能从 `git log` 或 `CHANGELOG.md` 读出来吗？能，就不进。
3. 属于“现状”吗？属于，就进常驻文档，记忆最多留一行指针。
4. 是踩过的坑吗？是，就进 `docs/engineering-lessons.md`，那里才是教训的 SSOT。

四问都不命中的才是记忆该收的：owner 的偏好与授权、协作口径、外部约束、以及跨会话才用得上而代码里看不出来的约定。

### C3 记忆的形态

- **按主题命名，不按版本**。`project-v3-rewrite.md`、`project-v5-workspace.md` 这种版本切分的文件每发一版就多一个，是本轮要根治的形态。
- **禁历史叙事**。“此前是 X，后来改成 Y”在记忆里只留 Y。需要 X 的人去 `CHANGELOG.md` 查。唯一例外是判据本身依赖于“试过 X 不行”的那类，写成一句结论加一个 CHANGELOG 锚点，不展开过程。
- **总量设上限**：`docs/memory/` 全部文件合计不超过 120 行，索引 `MEMORY.md` 一行一条。超了就先合并再新增。
- 重组后的文件：`decisions-and-conventions.md`（工程口径与协作约定）、`owner-preferences.md`（owner 偏好与授权，含炫技优先那条）、`MEMORY.md`（索引）。原三份内容按四问过滤后并入，过滤掉的进常驻文档或直接丢弃。

### C4 规约治理

- `specs/<version>/spec.md` 与 `plan.md` 是**当轮意图快照**，实现开始后不再回写正文。理由：现状的 SSOT 已经是常驻文档加代码，规约再维护一份必然漂，而规约真正的价值（当时为什么这么定、否决了什么）是历史，历史不需要跟着现状改。
- 每轮收尾时在 `spec.md` 尾部补一节“实到范围”，一次性写清与规约不同的地方并指向 CHANGELOG 对应版本段，然后把头部状态行改成已封存。
- 这套口径写进 `docs/contributing.md`，并在 `AGENTS.md` 留一行指针。

## 6. §D 品牌图标单色切换

### D1 为什么 44 个品牌没有单色稿

上游 `homarr-labs/dashboard-icons` 只给一部分品牌配了第二个变体，58 个里 14 个有（`github-light`、`anthropic-dark` 这类，实测都是纯白稿）。这是素材源的覆盖问题，不是本仓漏做，也不需要手画。

现在的行为是静默失效：`brandFileOf()` 在 `entry.white` 缺失时退回原色稿，用户点了“单白”画面不变，也没有任何提示。

### D2 改成绘制期着色

不再依赖素材源是否提供单色稿，改在绘制期把图形压成单色：

- 有官方单色稿的（14 个）优先用官方稿。它保留了品牌自己处理过的镂空与留白。
- 没有的（44 个）取原色稿按 alpha 通道压平成剪影。
- 两者都用离屏画布加 `source-in` 着成当前文字色，预览与导出走同一条路径，`src/graphics/draw.ts` 一处改动即可。

跟随文字色而不是钉死纯白，是因为文字色本来就是用户挑的，图标与文字同色才是一件东西。

代价要说清：alpha 压平会丢掉原色稿内部的镂空细节，多色徽标压平后可能糊成一团。所以官方稿优先，且这是“单色”不是“单白”，词条一并改名。

### D3 界面

切换搬到挑选栏的图标节，摆在“更换”按钮旁边，只在当前图标来源是品牌时出现。用分段控件，两格：**原色 / 单色**。选择器里那个分段控件保留，两处读写同一个状态。

状态落在配置里而不是选择器的局部 state：新增 `layout.icon.mono: boolean`，默认 `false`。契约版本不升，`normalizeConfig` 给旧存档补 `false`。

## 7. 边界（不做）

- 不给记忆做自动裁剪脚本。准入判据是人与智能体读的规则，不做成工具。
- 不回写 v5.0 之前各版规约的正文，只在 v5.0 那份补“实到范围”。更早的规约已随版本发布封存。
- 不为 `/about` 在 CI 里起 `wrangler pages dev` 的 e2e。`_redirects` 的单测已经守住会复发的那一条。
- 不做品牌图标的在线搜索、自定义上传合流，也不补齐上游缺的官方单色稿。
- 不改 CI 的触发条件。e2e 仍只在 main 与手动触发时跑。

## 8. 验证

- 单测：`_redirects` 无 `.html` 200 重写；`src/about/` 的 `hasSupport()` 空态与渲染分支；`sw-update` 的轮询与复查分支；`normalizeConfig` 给旧存档补 `icon.mono`；单色着色对有官方稿与无官方稿两条路径各一例。
- e2e：品牌页选一个无官方单色稿的品牌，在挑选栏切到单色，断言 `config().layout.icon.mono` 为 `true` 且导出成功；桌面档断言非品牌来源时切换不出现。
- CI：check job 含 `format:check`；`npm test` 不带 `--passWithNoTests`；e2e 失败时能取到报告制品。
- 闸门：`npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`，再 `npm run e2e` 全绿；push 后确认 main 的 CI 转绿。
- 文档：§3 表里每一行逐条核对；`docs/memory/` 合计不超过 120 行；全仓 grep 不出“首屏 JS 205 KB”这类被归位的重复数字。


## 9. 实到范围

与规约正文的差异，一次性列清，正文不回改。变更叙事见 `CHANGELOG.md` 的 5.3.0 段。

- §4 B1 说 `e2e/desktop.spec.ts` 有六处 `test.setTimeout(PROBE_TIMEOUT_MS)`，实到是七处，分布在 desktop、mobile、wechat 三份。
- §4 B2 只点名五处 `timeout: 5000`。实到另有五个裸数字（15000 两处、20000 两处、30000 一处），一并收进 `SETTLE_TIMEOUT_MS` 与 `RENDER_TIMEOUT_MS` 两个新常量，理由是计划写着用例里不留裸数字，而这几处正是慢 runner 上最可能超的。
- §4 B1 与 B3 原打算把 CI 系数分别写在 `playwright.config.ts` 与 `e2e/helpers.ts`。实到抽成 `e2e/ci-factor.ts` 一处定义，两边引用，与本轮 §5 定的 SSOT 口径一致。
- §3 A2 表里 README 的命令表一行没做：README 那份本来就是精选列表而非完整清单，补 `npm run gen:brand` 的落点在 `docs/contributing.md`。
- §5 C3 预计记忆重组后合计不超过 120 行，实到 54 行。
- §6 D2 说单色着色改 `src/graphics/draw.ts` 一处。实到 `src/graphics/brand.ts` 的文件解析也要改：单色档要优先取官方单色稿，缓存键随之改成真正取到的文件名。
- 收尾时另有两条踩坑内容从项目记忆转入 `docs/engineering-lessons.md`（滑杆被压到 0 宽会永久隐藏、样张分三张排是被截图能力卡住的），规约里没提。
