# ADR-0001 前端栈：Vite + React 19 + Tailwind v4 + shadcn/ui 与付费 registry

- 状态：已采纳
- 日期：2026-08-29

## 背景

v2 是无框架的 Vite + 原生 DOM 实现，界面靠 993 行手写 CSS 和大量 `getElementById`，手机端布局靠媒体查询硬拼，预览区在小屏上会被面板挤到看不见。项目已购 shadcnblocks 与 React Bits Pro 两套 registry，但原生 DOM 无法使用它们。

## 决策

- 单包根目录的 Vite 8 + React 19 + TypeScript strict 应用，不用 Next.js（目标是 Cloudflare Pages 静态站，没有服务端）。
- 样式用 Tailwind CSS v4 与 shadcn/ui（CLI 4 默认的 Base UI 底层，CSS 变量主题）；`components.json` 启用 `@shadcnblocks`、`@reactbits-starter`、`@reactbits-pro` 三个 registry，密钥只在 `.env.local`。
- 状态用 zustand；界面语言用自研 JSON 字典与 React context，不引入 i18next。
- 移动端抽屉用 shadcn Drawer 的 Base UI 实现（Base UI 1.3 起自带 snap points），不装 vaul（2024-12 后无发布）。

## 后果

- 首屏 JS 体积从约 40 KB 涨到 200 KB 级别，用按需加载控制在规约上限内。
- 付费件装入即本地源码，CI 与 Cloudflare 构建不需要任何 registry 密钥。
- 原生 DOM 版本整体删除，不做兼容层。

## 否决的备选

- 继续原生 DOM：无法使用已购组件，移动端布局维护成本高。
- Next.js：静态站不需要 RSC 与服务端，Cloudflare Pages 上还要多一层适配。
- Paraglide JS 做 i18n：切语言要整页刷新，会打断编辑；自研字典几十行就够。
- 顺手迁到 Cloudflare Workers Static Assets：Pages 仍在维护且当前部署正常，本次不动托管。
