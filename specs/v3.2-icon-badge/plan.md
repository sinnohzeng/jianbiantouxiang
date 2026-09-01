# 图标徽章 v3.2 计划（怎么造）

对应 `spec.md`。四个阶段已按顺序落地，提交前统一跑完整验收。

## 阶段一：契约与排版内核（已落地）

- `AvatarConfig` 增加 `logo`、`graphic`、`icon`，`normalizeConfig` 补默认、夹值与枚举校验。
- URL 编码把 `upload` 降级成 `none`，解码兼容 v3.1。
- `layoutText` 接收可选图形尺寸，新增图标徽章求解；单测覆盖上下排布、比例边界、空文字、空图形与旧链接回退。

## 阶段二：图形来源与索引（已落地）

- 生成 lucide 精选与全库索引、emoji 五语索引，产物入库，不在日常 build 现算。
- 实现 `loadGraphic`：内置图标转 `Path2D`，emoji 取 Noto SVG，上传走会话注册表。
- SVG 白名单消毒、emoji 文件名推导、索引结构各有单测。
- 生成脚本支持 `npm run gen:icons` 与 `npm run gen:emoji`，脚本只读公开数据，不读 `.env.local`。

## 阶段三：界面与渲染（已落地）

- `TextPanel` 增加图标徽章、图形选择区与比例滑杆。
- 新增懒加载 `IconPicker`，桌面对话框、手机底部抽屉，内置图标与 emoji 分栏，底部提供上传。
- `PreviewStage` 与 `composeWith` 先加载图形，再排版、取色、绘制；失败只影响图形位。
- 五语字典与 `keys.md` 同步；e2e 覆盖内置图标、emoji、上传与旧链接兼容。

## 阶段四：收尾（已落地）

- 首屏 chunk 实测 200.22 KB gzip，低于 250 KB 上限；图标、emoji 与选择器索引均为懒加载 chunk。
- `npm run screenshots` 已覆盖桌面、iPhone 15、iPhone SE 的深浅主题，另生成图标徽章桌面与 iPhone SE 核查截图。
- README、architecture、CHANGELOG、engineering-lessons 与项目记忆同轮更新。
- 按“契约与排版”“图形来源”“界面与渲染”“文档”分批提交并推送。

## 风险与对策

- 全库图标索引可能把懒加载 chunk 撑大：精选常驻选择器，全库只在搜索需要时加载；构建后核对体积。
- emoji 依赖 jsDelivr：加载失败保留空图形；索引已入库，搜索不依赖网络。
- SVG 消毒遗漏比过度保留更危险：只用白名单，未知元素整支丢弃，未知属性删除，外部引用拒绝。
- 预览与导出容易在图形加载时序上分叉：两边都调用同一个 `loadGraphic` 与 `layoutText`，单测盯依赖顺序。
- 与 v3.1.3 的并写冲突：v3.1.3 切片四改 `TextPanel` 的状态徽章滑杆、切片六改名 `docs/memory`，
  本计划阶段三与阶段四都碰同一批文件。约定 v3.1.3 先合，本计划合前 rebase，冲突以 v3.1.3 为准。
- 消费端断言：阶段三必须有一条“删掉图形落笔调用就有测试变红”的用例，
  盯 `drawGraphic` 一类消费端的可观测行为，不盯排版产物字段，判据见 engineering-lessons 的契约教训。
- 阶段四文档清单里的 claude-memory 以改名后的 `docs/memory` 为准。
