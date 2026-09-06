# AGENTS.md

本仓库是纯前端的渐变头像生成器，线上地址 <https://jianbian.zixuan.net>。约定的唯一真源是 `docs/contributing.md`，这份文件只列智能体动手前必须知道的边界，不复制那里的正文。

## 动手前

- 先读 `docs/contributing.md`（约定）与 `docs/architecture.md`（模块与数据流）。多文件改动先看 `specs/` 里有没有对应规约，有就照规约做。
- Node 24 以上。`npm ci` 装依赖，构建与测试不需要任何密钥。
- 常驻文档、冻结快照、项目记忆三层怎么分工，一条事实该不该进 `docs/memory/`，规约何时封存：见 `docs/contributing.md`“分层与记忆准入”一节，这里不复述。

## 验证闸门

提交前必须全绿：

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

改了界面另跑 `npm run e2e`。任何一步红了就不提交，先修。命令与 CI 各 job 的对应关系见 `docs/contributing.md`。

## 边界

- main 分支 push 即上线（Cloudflare Pages）。在沙箱或流水线里执行的任务只推功能分支并开 PR，不直接 push main，合并交给验收步骤。本地交互式开发按 `docs/contributing.md` 的“定版与标签”收尾。
- 不手改 `src/components/ui/`，那是 shadcn 生成件。`docs/`、`specs/` 与根目录长文档在 `.prettierignore` 里，不对它们跑格式化。
- 密钥只在 `.env.local`，不写进任何文件、命令行历史或提交。
- 界面文案一律走 i18n key，五份字典同步改；配色名例外，它在 `src/palettes/palettes.ts` 里自带五语。
- 提交信息用 Conventional Commits，类型英文、描述中文，不带署名或协作者尾注。

## 智能体规模

- 核查、对抗检验、评审、验收类子智能体每轮合计不超过 5 个，一遍单人评审只报闸门（lint、format:check、typecheck、单测、build、e2e）抓不到的问题；分工细则见 `docs/contributing.md`“智能体协作”一节，这里不复述。
- 子智能体不做 git 操作，不读 `.env.local`。

## 改默认值

同步更新哪些文件、旧值用例与 `normalizeConfig` 兜底，见 `docs/contributing.md`“测试”一节，这里不复述。

## 收尾

版本号、CHANGELOG 条目与标签按 `docs/contributing.md`“定版与标签”执行。收尾汇报写清跑了哪些命令、结果如何、哪些没做。
