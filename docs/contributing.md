# 开发与发布

需要 Node.js 24+。克隆仓库后运行 `npm ci`，再用 `npm run dev` 启动开发页。模块和数据流见[架构](architecture.md)。

## 修改顺序

多文件改动先在 `specs/<版本或功能>/` 写简短规约与计划：读者或用户、目标、边界、验收方法。实施前检查体验、工程、数据与安全约束，只处理适用问题。实现开始后保留原意图，变动写入追加说明；收尾补“实到范围”，链接 CHANGELOG 并标记已封存。

新文件按职责放入现有目录。纯逻辑放库模块，页面与面板放 `src/app/`，复用组件放 `src/components/blocks/`。`src/components/ui/` 由 shadcn CLI 生成，不手改。跨目录使用 `@/` 别名，避免桶文件扩大依赖图。

TypeScript 使用 strict 与 noUncheckedIndexedAccess。格式交给 Prettier；docs、specs、根目录长文档和 UI 生成件在忽略清单中。界面文案用 i18n key，五份字典同步；配色名随清单记录五语。

触控目标至少 44 px，输入字号至少 16 px。装饰动画遵循减少动效偏好。需要组件时先查看现有原语，再按项目需要参考已授权 registry。

## 验证

首次运行浏览器测试前安装 Chromium：

```bash
npx playwright install --with-deps chromium
```

```bash
npm run check
npm run ci
```

`check` 依次运行 lint、format:check、typecheck、单测、网页构建、服务单测及服务构建。`ci` 在此基础上追加服务集成测试和 E2E。门禁在本地运行；改界面或定版前跑完整 ci，失败先修复再提交。

界面修改还需查看实际截图：

```bash
npm run preview
# 在另一个终端运行
npm run screenshots
```

截图写入 `.screenshots/`，覆盖桌面和两种手机尺寸的深浅主题。确保 4173 上的 preview 服务来自本次构建；不能把旧产物的截图当作验证。运行测试后保持源码不变，改动后重跑受影响检查。

- 纯逻辑测试放 `tests/` 的对应模块；浏览器流程放 `e2e/`。
- 通过 `?probe=1` 的 `window.__gradientAvatarProbe` 读取配置、同步存档和编码结果。测试刷新前调用 flush；预置存档在页面初始化前写入。
- 改默认值同步规约、使用说明、架构、CHANGELOG 和测试，覆盖显式旧值。运行 `npm run samples` 重建样张并查看。
- 视觉修改比较原始参照、新旧完整图和 32/48/64 px 圆裁。工程无溢出与审美认可分别报告。
- 字体加载、合成和编码测试应检查实际结果；单元测试可注入替身，避免依赖网络与 GPU。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| npm run dev / build / preview | 开发、构建 dist、预览 |
| npm test / test:watch | 单元测试与监听 |
| npm run e2e | 桌面与手机浏览器流程 |
| npm run samples | 重建配色与文字效果样张 |
| npm run gen:brand | 生成品牌文件与索引，需网络的来源按清单读取 |
| npm run gen:icons / gen:emoji | 生成图标、emoji 索引 |
| npm run gen:app-icons | 用 Chromium 生成应用图标 |
| npm run budget | 报告首屏 JS 体积 |
| npm run build:service | 构建 CLI/MCP 渲染资源 |

生成器、源清单和产物同批提交。新增字体镜像固定具体版本。品牌来源与许可见[素材说明](assets.md)。

## 提交与定版

单人项目直接在 main 工作，测试后提交并推送。提交信息用 Conventional Commits：英文类型、中文描述，例如 `fix: 修正圆裁后的文字位置`，不加署名尾注。

每轮同步 package.json、package-lock.json 和 CHANGELOG，最后一个提交打注解标签 `v<版本>`，与 main 一起推送。修复、文档和依赖调整用 patch；新增功能或兼容的契约扩展用 minor；破坏旧存档的契约变化用 major。

推 main 会触发静态站构建。推送后核验远端提交、部署日志（如可访问）和线上文件，不能只凭 push 成功报告上线。具体步骤见[部署](deploy.md)。

清理分支前核对独有提交与补丁等价性，保存可恢复标签或归档，再删除已处理分支；删除前再次比对远程提交，避免遗漏新工作。

## 文档与记忆

现状分别写入使用、接口、架构和部署文档；同一事实只详述一次，其他位置给链接。变更写 CHANGELOG，决策写 ADR，研究写 research，验证证据写 audits，经验写 engineering-lessons。冻结的历史记录按版本保留。

写作先明确立场、读者、目的和提纲，再核对事实、删重，最后修改句词。使用清楚的书面语，不追求刻意口语化。只保留帮助读者操作或判断的信息。

项目记忆只记录代码、现状和提交记录推不出的偏好、授权与外部约束；已有工程经验不重复存为记忆。每轮交付列明更新文档、记忆变化、文档债务及未验证项。

## 工具与协作

registry 密钥放在 `.env.local`，不写入命令或提交。安装已授权组件使用项目 CLI：`./node_modules/.bin/shadcn add <组件>`，避免 npx 转发本机 npm 选项导致安装失败。

子智能体核查、评审和验收每轮合计最多 5 个；不做 Git 操作、不读取 `.env.local`。临时文件放会话草稿目录，不覆盖别人的截图或关闭共享浏览器。评审聚焦常规门禁无法发现的问题，具体限制以用户当前授权为准。
