# AGENTS.md

本仓库是纯前端的渐变头像生成器，线上地址 <https://jianbian.zixuan.net>。约定的唯一真源是 `docs/contributing.md`，这份文件只列智能体动手前必须知道的边界，不复制那里的正文。

## 动手前

- 先读 `docs/contributing.md`（约定）与 `docs/architecture.md`（模块与数据流）。多文件改动先看 `specs/` 里有没有对应规约，有就照规约做。
- Node 24 以上。`npm ci` 装依赖，构建与测试不需要任何密钥。

## 验证闸门

提交前必须全绿：

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

改了界面另跑 `npm run e2e`。任何一步红了就不提交，先修。

## 边界

- main 分支 push 即上线（Cloudflare Pages）。在沙箱或流水线里执行的任务只推功能分支并开 PR，不直接 push main，合并交给验收步骤。本地交互式开发按 `docs/contributing.md` 的“定版与标签”收尾。
- 不手改 `src/components/ui/`，那是 shadcn 生成件。`docs/`、`specs/` 与根目录长文档在 `.prettierignore` 里，不对它们跑格式化。
- 密钥只在 `.env.local`，不写进任何文件、命令行历史或提交。
- 界面文案一律走 i18n key，五份字典同步改；配色名与家族名例外，它们在 `src/palettes/palettes.ts` 里自带五语。
- 提交信息用 Conventional Commits，类型英文、描述中文，不带署名或协作者尾注。

## 智能体规模

- 这是轻量级项目。核查、对抗检验、评审、验收类子智能体每轮合计不超过 5 个；一遍单人评审只报闸门（lint、typecheck、单测、e2e）抓不到的问题，不做多轮反驳投票。
- 实现切片与机械改动交给 Opus 5 子智能体；主会话的用量留给设计与取舍。
- 子智能体不做 git 操作，不读 `.env.local`。

## 改默认值

同步更新 `DEFAULT_CONFIG`、对应 spec、README、architecture、CHANGELOG 与测试，并补一条显式旧值的用例。配置不进 URL；存档缺字段时由 `normalizeConfig` 补当前默认值。

## 收尾

版本号、CHANGELOG 条目与标签按 `docs/contributing.md`“定版与标签”执行。收尾汇报写清跑了哪些命令、结果如何、哪些没做。
