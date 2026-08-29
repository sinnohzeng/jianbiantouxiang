---
name: project-v3-rewrite
description: 2026-08-29 完成的 v3 重构（React + WebGL shader 引擎 + Google Fonts）的分工方式、验收口径与后续维护约定
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
