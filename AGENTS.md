# AGENTS.md

本仓库是纯前端的渐变头像生成器，线上地址 <https://jianbiantouxiang.com>。约定的唯一事实来源是 `docs/contributing.md`，这份文件只列智能体动手前必须知道的边界，不复制那里的正文。

根目录的 `CLAUDE.md` 是指向本文件的软链。Claude Code 只认 `CLAUDE.md` 这个名字，其余工具认 `AGENTS.md`，两边指同一份内容，要改就改这一份。

## 动手前

- 先读 `docs/contributing.md`（约定）与 `docs/architecture.md`（模块与数据流）。多文件改动先看 `specs/` 里有没有对应规范，有就照规范做。
- Node 24 以上。`npm ci` 装依赖，构建与测试不需要任何密钥。
- 常驻文档、冻结快照、项目记忆三层怎么分工，一条事实该不该进 `docs/memory/`，规范何时封存：见 `docs/contributing.md`“分层与记忆准入”一节，这里不复述。

## 验证门禁

仓库不在 GitHub 上跑 CI，门禁全在本地。提交前必须全绿：

```bash
npm run check
```

改了界面或定版前跑 `npm run ci`，它在 check 之后再跑服务集成测试与 e2e。任何一步红了就不提交，先修。两个脚本各含哪些步骤见 `docs/contributing.md`。

## 边界

- main 分支 push 即上线：阿里云 ESA Pages 与 Cloudflare Pages 都接着 main，接入与核对步骤见 `docs/deploy.md`。本单人项目按用户要求直接在 main 工作，门禁全绿后提交并推送 main，不开 PR。定版与标签按 `docs/contributing.md` 的“定版与标签”收尾。
- 不手改 `src/components/ui/`，那是 shadcn 生成件。`docs/`、`specs/` 与根目录长文档在 `.prettierignore` 里，不对它们跑格式化。
- 密钥只在 `.env.local`，不写进任何文件、命令行历史或提交。
- 界面文案一律走 i18n key，五份字典同步改；配色名例外，它在 `src/palettes/palettes.ts` 里自带五语。
- 提交信息用 Conventional Commits，类型英文、描述中文，不带署名或协作者尾注。

## 智能体规模

- 核查、对抗检验、评审、验收类子智能体每轮合计不超过 5 个，一遍单人评审只报门禁（lint、format:check、typecheck、单测、build、e2e）抓不到的问题；分工细则见 `docs/contributing.md`“智能体协作”一节，这里不复述。
- 子智能体不做 git 操作，不读 `.env.local`。

## 改默认值

同步更新哪些文件、旧值用例与 `normalizeConfig` 兜底，见 `docs/contributing.md`“测试”一节，这里不复述。

## 收尾

版本号、CHANGELOG 条目与标签按 `docs/contributing.md`“定版与标签”执行。收尾汇报写清跑了哪些命令、结果如何、哪些没做。
