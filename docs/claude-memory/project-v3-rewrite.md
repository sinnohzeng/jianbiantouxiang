---
name: project-v3-rewrite
description: 2026-08-29 启动的 v3 重构（React + WebGL shader 引擎 + Google Fonts），阶段划分、验收条件与分工约定
metadata:
  type: project
---

2026-08-29 启动 v3 重构，规约在 `specs/v3-gradient-avatar/spec.md`，实施计划在同目录 `plan.md`，四份 ADR 在 `docs/adr/`，调研沉淀在 `docs/research/2026-08-29-ai-gradient-technique-survey.md`。

**Why:** 用户要求对标 OpenAI 风格柔和渐变、文字排版可配、Google Fonts 动态加载、导出体积可控、手机端好用，并明确不留历史包袱、技术决策由我拍板、机械实现交给 Opus 5 子智能体。

**How to apply:** 阶段顺序为脚手架 → 核心库（engine / text / palettes / fonts / export / state 六个目录并行）→ 界面（shell 与 panels 两个智能体）→ 集成与设备模拟截图核查 → 审查 → 文档与发布；每阶段由主会话验证后单独提交。验收条件见 spec §6。付费 registry 密钥在 `.env.local` 与 `~/.zshenv`，任何文件与输出不得出现明文。相关：[[reference-paid-registries]]。
