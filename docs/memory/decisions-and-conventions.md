---
name: decisions-and-conventions
description: 工程口径与协作约定，常驻文档与 CHANGELOG 都推不出来、但跨会话用得上的具体做法
metadata:
  type: convention
---

## 品牌图形素材来源

品牌图标从 `dashboard-icons` MCP（homarr-labs，Apache-2.0，商标归各品牌）检索。上游未覆盖的品牌，
由 owner 在 `inbox/`（已 gitignore）投放素材，人工合并进 `assets/brand/` 与 `scripts/brand-list.json`
后跑 `npm run gen:brand` 重建索引。

## 新增精选字体要固定镜像版本

镜像 CSS 用具体版本号，不用 `@latest`。新增精选字体时同轮去 jsDelivr 查该字体的版本号填进
`FontEntry.version`；只有没有对应 npm 包的字体才回落 `@latest`。

## 改默认值要重生成样张

改 `DEFAULT_CONFIG` 后，除 `docs/contributing.md` 已列的同步项外，同轮跑一次 `npm run samples`
并逐张目检；样张文件头会标注当轮默认值。
