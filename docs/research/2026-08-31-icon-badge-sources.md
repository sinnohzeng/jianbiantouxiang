# 图标徽章来源调研

调研时间：2026-08-31。结论用于 `specs/v3.2-icon-badge/`。

## 事实快照

- **lucide-react 1.37.0**：本仓 `node_modules/lucide-react/dist/esm/icons/*.mjs` 里有 2048 个 `.mjs` 文件，其中 1790 个是主图标模块，其余是别名转发。主模块导出 `__iconNode`，节点为 `["path", { d, key }]` 这类数组，默认画布是 24×24、`stroke-width: 2`。来源：本仓锁定依赖实测。
- **emojibase-data 15.0.0**：`zh`、`zh-hant`、`en`、`ja`、`ko` 各自都有 `data.json`。zh 数据 1905 条，其中 1879 条有 `group` 与 `order`；`1F334` 的标签是“棕榈树”，emoji 是 🌴。来源：jsDelivr npm 包实测，MIT。
- **Noto Emoji v2.047**：`https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u1f334.svg` 返回 128×128 SVG；ZWJ 序列 `emoji_u1f469_200d_1f4bb.svg` 也返回 200。来源：官方 jsDelivr 资源实测，Apache-2.0。
- **SVG 消毒基线**：OWASP XSS 预防指南要求 HTML/SVG 场景使用 sanitizer；针对 SVG 的常见指引是移除 `script`、`foreignObject`、事件属性、外部引用与未知命名空间。本项目采用更严格白名单。来源：OWASP Cheat Sheet Series 与 SVG 安全实践文章，社区资料仅作旁证。

## 对实现的影响

- 图标索引不能按文件数报 1791，应按主模块数报 1790；别名不进索引，避免同一个图形重复出现。
- emoji 只收录有 `group` 的 1879 条，保证选择器能分栏；索引按语言对齐生成，不把五份标签都打进同一份 chunk。
- emoji SVG 的文件名由 hexcode 推导，`FE0F` 去掉，ZWJ 保留为下划线连接。
- 上传 SVG 不做黑名单修补，直接重建白名单元素与属性；任何外部引用都拒绝。
