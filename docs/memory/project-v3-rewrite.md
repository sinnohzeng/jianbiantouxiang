---
name: project-v3-rewrite
description: 2026-08-29 至 2026-08-31 的 v3 重构、v3.1 状态徽章、v3.1.1 直接导出行级排版、v3.1.2 默认值/颗粒调整、v3.1.3 审计与债务清理、v3.2 图标徽章的分工方式、验收口径、推迟范围与后续维护约定
metadata:
  type: project
---

2026-08-29 用一天完成 v3 重构：规约 `specs/v3-gradient-avatar/spec.md`、计划 `plan.md`、四份 ADR、调研沉淀 `docs/research/2026-08-29-ai-gradient-technique-survey.md`。阶段顺序是脚手架 → 六个核心库并行 → 界面两智能体并行 → 收尾（体积、e2e）→ 视觉调参 → 六维审查 → 文档 → 评审收尾，每阶段主会话验证后单独提交。

**Why:** 用户要求对标 OpenAI 风格柔光渐变、文字排版可配、Google Fonts 动态加载、导出体积可控、手机端好用；技术决策由主会话拍板，机械实现交给 Opus 子智能体；不留历史包袱。

**How to apply:**
- 改引擎参数前先跑样张：`scratchpad/contact` 那套管线（`composeAvatar` 逐格渲染拼图）随会话消失，仓库里等价做法是 `scripts/screenshots.mjs` 加临时 vite 入口；判定用 std luma、可见停靠色数与文字对比度，不只看单张。
- 视觉验收看 `docs/assets/samples/`，交互验收跑 `npm run e2e`（桌面 + iPhone 15）与 `npm run screenshots` 后用 Read 看图。
- 子智能体一律不做 git 操作、不 cat `.env.local`；主会话提交前看 `git status --short` 有无 `D ` 前缀。
- 付费 registry 用 `./node_modules/.bin/shadcn`，密钥只在 `.env.local` 与 `~/.zshenv`，任何文件与输出不得出现明文。跨项目细节见 `docs/engineering-lessons.md` 的脚手架阶段。
- 常驻文档只写现状；变更进 `CHANGELOG.md`，踩坑进 `docs/engineering-lessons.md`。
- 评审那一轮的两条已知取舍写在 `docs/engineering-lessons.md` 的「评审收尾」：导出体积二分仍在全分辨率画布上做（实测 4096 最坏约 3.3 s，在预算内，不换缩图代理）；8192 加 1 MB 的降级路径只有单测覆盖，没有 e2e（软件渲染下一次 8192 合成要几分钟）。这两条是取舍不是待办，别当技术债重开。
- 评审型 workflow 的规模与「零问题」判据见 `docs/engineering-lessons.md` 的评审收尾。

## v3.1（2026-08-29 当晚）

状态徽章落地，图标徽章与图形来源推迟到 v3.2。规约与计划都在 `specs/v3.1-badge-templates/`，
plan.md 开头有一张「落地范围」表，spec.md 里标了「v3.2」的小节是设计已定、代码未写。

**Why 停在这里：** 图标徽章只落排版内核，主干上会留一块画不出东西的预留区。
用户当晚明确要求「完成最小闭环之后，更多的功能就不往下推」，并点了 Agentic Coding 代码红线。
判据是「半成品不进主干」，不是「做不动」。已经写好的 lucide 索引、emoji 索引与 SVG 消毒代码
当时是子智能体产出、未验证完，随会话丢弃，v3.2 照 plan.md §2.1 重做即可。

**How to apply:**
- `LayoutKind` 只有 `text` 与 `status`。v3.2 加 `logo` 时同时要加 `graphic`、`icon` 与图形来源，
  三者缺一就别加取值：枚举校验会让老版本把未知取值退回 `text`，这是有意的向前兼容路径。
- 跨模块契约加了字段，同一轮必须补一条**在消费端**断言的用例，判据见
  `docs/engineering-lessons.md` 的「契约里加了字段，不等于有人读它」。v3.1 就栽在这里。
- 视觉类改动收工前跑一遍真实浏览器。起 `npm run dev`，用 `page.addInitScript` 往 localStorage 的
  `gradient-avatar:v3` 写 `{ v: 3, config }` 再打开页面截图（v5.0 起配置不进 URL，应用只在模块初始化时读一次存档）。

## v3.1.1（2026-08-29 深夜）

直接导出与行级排版已落地，规约在 `specs/v3.1.1-direct-export-line-controls/`。
默认值是方形画布、白色文字、两行「飞书 / 效率先锋」，第二行字号 0.62 倍。

**Why:** 用户要“点导出就下载”、复制与下载拆成显式按钮，并且能逐行调字号与视觉补偿；
这类默认值和交互变化必须在规约里先定验收，不然 e2e 会继续守护旧口径。

**How to apply:**
- 主“导出”按钮走 `createExportArtifact` 后直接 `downloadBlob`；旁边设置图标才打开导出抽屉。
- 复制图片固定 PNG，且必须把 `createClipboardBlob(config)` 的 Promise 同步交给 `ClipboardItem`，
  不能先 await 成 Blob，否则 Safari 会判定用户手势失效。
- 行级参数在 `typography.lineSizeScales` 与 `lineOffsetsX`；旧 `status` 链接靠
  `normalizeConfig` 把 `layout.scale` 迁移到第二行，别删这条兼容逻辑。
- `npm run e2e` 使用 `vite preview`，改源码后必须先 `npm run build`，否则测试的是旧 `dist`。

## v3.1.2（2026-08-31）

默认值与交互微调已落地，规约在 `specs/v3.1.2-defaults-and-grain/`。
默认画布仍是方形；文字边距 15%、行高 1.03；种子区前置；颗粒形状池去掉 ripple；行级字号控件前置且带常驻数值输入。

**Why:** 用户反馈圆角默认、边距、行高、种子入口、颗粒画圈和行级字号可发现性都需要立刻调整；导出默认下载已经在 v3.1.1 落地，不需要重复改。

**How to apply:**
- 改默认值时，默认值、显式旧值兼容用例、README、architecture、CHANGELOG 与 spec 要同轮更新。
- 存档缺字段时由 `normalizeConfig` 补当前默认值（v5.0 起配置不再进 URL，这条只对存档成立）。
- 颗粒形状池保留 wave 与 corners，别把 ripple 加回来；它是同心圆观感的直接来源。
- 行级字号只做前置与常驻输入，不扩展成自由排版，也不把所有滑杆都改成常驻输入。

## v3.1.3（2026-08-31 审计与债务清理）

全仓技术与文档债务审计在 `docs/audits/2026-08-31-tech-doc-debt-audit.md`，
十七项发现的实施规约与计划在 `specs/v3.1.3-debt-and-hygiene/`，六个切片全部落地。
v3.2.0 先发布，本轮按补丁级发布为 3.2.1。

**Why:** 债务不在主干代码，在发布卫生、文档漂移与契约重复，体验层缺撤销与历史可辨识性；
不修则每项都会被后续会话反复重开。全部按薄切片带验收修掉，权衡与排除项记进报告，
防止再被当债重开。

**How to apply:**
- 首屏唯一数字是 250 KB gzip，`scripts/check-budget.mjs` 在 CI 构建后跑；
  v3.1 规约的 160 KB 目标已作废，别引用。
- 样张重生成走 `npm run samples`，头部标注当轮默认值；改默认值后重跑这一条命令并逐张目检。
- 撤销重做栈在 store 的 past/future（上限 50），不进 URL、localStorage 与历史条目；
  历史条目的可选 `thumb` 是异步补写的 96 px JPEG，旧存档无缩略图时回落渐变加首字。
- 镜像 CSS 用 `FontEntry.version` 固定版本；新增精选字体要同轮查 jsDelivr 版本填上，
  没有 npm 包的字体才回落 `@latest`。
- 审计报告放 `docs/audits/` 按日期命名，交接文放 `docs/handoff/` 按特性命名，
  两者已进 contributing 文档表；交接文在工作完成后由接手方更新或删除。
- 审计报告 §5 与 §6 的条目别重开：那是既有权衡与过度工程化排除项，不是债务。

## v3.2（2026-08-31）

图标徽章与图形来源已落地，规约与计划在 `specs/v3.2-icon-badge/`。

**Why:** v3.1 只落状态徽章，图标徽章没有图形来源会变成画不出东西的预留区；本版把契约、排版、三种来源、选择器、导出与文档接成完整链路。

**How to apply:**
- `layout.kind` 现在是 `text` / `status` / `logo`；`layout.graphic` 与 `layout.icon` 同轮存在。`layout.scale` 已移除，旧状态徽章存档靠 `normalizeConfig` 迁移到第二行行级字号，不要把它加回契约。
- 上传图形的字节只存在模块级会话注册表；配置里的 `upload` 引用会随存档落盘，刷新后图形位留空、提示重新上传（v5.0 起没有 URL 通道，原来「分享时降级为 none」的逻辑随之删除）。
- 图形索引是生成产物：lucide 1790 个主图标、emoji 1879 个条目与五语标签由 `npm run gen:icons` / `gen:emoji` 生成，产物与脚本同批提交，不手改。
- SVG 消毒只走白名单重建。新增 SVG 能力前先看 `docs/engineering-lessons.md` 的 v3.2 一节，不要退回黑名单修补。
- 图形选择器与全部索引都懒加载。首屏实测 200.22 KB gzip，预算仍为 250 KB；改图形入口时先跑 build 看 chunk 清单。
