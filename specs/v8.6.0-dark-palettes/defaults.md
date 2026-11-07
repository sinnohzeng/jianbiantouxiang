# 统一默认头像内容

状态：已封存。日期：2026-11-07。

首次进入及恢复默认时，共享配置使用“工作新习惯\n你说豆包干”和原色豆包工作图标（brand / doubao-work / mono=false）。默认主行 Noto Serif SC 700、副行 Noto Sans SC 700，适配明确的中文文案；界面语言不改写画布内容或字体。

本地已有存档优先，显式旧文字、字体、无图标及其他 Logo 都保持。存档键不升级。Web、重置与 CLI/MCP 读取同一 DEFAULT_CONFIG；缺字段按当前默认补齐，非法图标来源不被误当作有效品牌。

验证包括五种界面语言下首次默认、切换语言保持内容、重置、存档恢复、显式旧默认与无图标保留、共享配置及纯文字布局夹具回归。

## 验证记录

- `npm test -- tests/state tests/app/locale-defaults.test.tsx tests/text`：13 个文件、249 项测试通过。
- `npm run typecheck`：通过。
- 发布前的整站回归与默认头像截图纳入本轮总体验收。

## 实到范围

Web、重置和 normalizeConfig 共享新默认。CLI/MCP 继续显式传入 line1/line2/logo，保持空输入拒绝和调用方内容优先的既有契约。真实默认512px出图已查看并记录于本轮审计。
