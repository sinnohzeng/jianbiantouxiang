---
name: project-v3-rewrite
description: 2026-08-29 完成的 v3 重构与 v3.1 状态徽章的分工方式、验收口径、推迟范围与后续维护约定
metadata:
  type: project
---

2026-08-29 用一天完成 v3 重构：规约 `specs/v3-gradient-avatar/spec.md`、计划 `plan.md`、四份 ADR、调研沉淀 `docs/research/2026-08-29-ai-gradient-technique-survey.md`。阶段顺序是脚手架 → 六个核心库并行 → 界面两智能体并行 → 收尾（体积、e2e）→ 视觉调参 → 六维审查 → 文档 → 评审收尾，每阶段主会话验证后单独提交。

**Why:** 用户要求对标 OpenAI 风格柔光渐变、文字排版可配、Google Fonts 动态加载、导出体积可控、手机端好用；技术决策由主会话拍板，机械实现交给 Opus 子智能体；不留历史包袱。

**How to apply:**
- 改引擎参数前先跑样张：`scratchpad/contact` 那套管线（`composeAvatar` 逐格渲染拼图）随会话消失，仓库里等价做法是 `scripts/screenshots.mjs` 加临时 vite 入口；判定用 std luma、可见停靠色数与文字对比度，不只看单张。
- 视觉验收看 `docs/assets/samples/`，交互验收跑 `npm run e2e`（桌面 + iPhone 15）与 `npm run screenshots` 后用 Read 看图。
- 子智能体一律不做 git 操作、不 cat `.env.local`；主会话提交前看 `git status --short` 有无 `D ` 前缀。
- 付费 registry 用 `./node_modules/.bin/shadcn`，密钥只在 `.env.local` 与 `~/.zshenv`，任何文件与输出不得出现明文。跨项目细节见全局记忆 `reference_shadcn_cli_env_gotchas.md`。
- 常驻文档只写现状；变更进 `CHANGELOG.md`，踩坑进 `docs/engineering-lessons.md`。
- 评审那一轮的两条已知取舍写在 `docs/engineering-lessons.md` 的「评审收尾」：导出体积二分仍在全分辨率画布上做（实测 4096 最坏约 3.3 s，在预算内，不换缩图代理）；8192 加 1 MB 的降级路径只有单测覆盖，没有 e2e（软件渲染下一次 8192 合成要几分钟）。这两条是取舍不是待办，别当技术债重开。
- 评审型 workflow 的规模与「零问题」判据见全局记忆 `feedback_review_workflow_agent_budget.md` 与 `reference_workflow_agent_limit_false_negative.md`。

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
- 视觉类改动收工前跑一遍真实浏览器。起 `npm run dev`，用 `#c=<base64url(配置差异)>` 喂配置，
  `page.reload()` 之后截图（只改 hash 是同文档导航，应用只在模块初始化时读一次 hash）。
