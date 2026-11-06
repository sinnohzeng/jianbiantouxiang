# 圆形头像整体放大与默认字体

## 用户证据与范围

已读取 613.jpg（libfile_dba74aaefde0819185a97c8e95896e10）、612.jpg（libfile_7f6046901a208191afccad33b465af61）、614.jpg（libfile_c53e223927ac8191988dbe80dcf3f07c）。前两张是原始导出，第三张是飞书圆裁界面；原图白色主体宽约 65.9%、高约 51.5%–51.8%。截图无法恢复精确存档配置，不声称知道是哪一次手调。

v8.2.3 默认主行黑体、副行跟随，因此用户图中的宋体主行与黑体副行不是当时全局默认。本轮将简体中文新默认设为 Noto Serif SC 700 / Noto Sans SC 700；保留明确旧字体、字重、null 跟随和安全边距。

## 实到实现

内部布局、主副比例与间距沿用基准；在最终阶段统一放大，最多 16%，以实际字号量测和完整品牌边界限制到 3% 默认径向安全留白。显式更大留白继续生效，手动字号、位移与装饰效果保持原行为。网页、CLI、MCP 共用放大函数。CLI/MCP 可选 secondaryFont，故按新增契约定 minor v8.3.0。

同条件网页 8 组已实际出图并目检完整图和 32/48/64 px 圆裁：东黎主体放大约 6.8%，纯文字示例约 9.4%。大讲堂内部主行量测宽 66.7%→71.1%；像素阈值诊断见研究 references。16% 是上限而非每例结果。MCP 16 张实际出图，含真实 HARMAY SVG 与东黎三种结构；HARMAY 与东黎两行图已目检。新图未重新上传飞书客户端，不能保证 32 px 长标题逐字可读。

## 验证记录

最终 843 单测通过；新增旧字体/null 兼容与整体等比放大、手动退出测试。真实渲染回归首轮发现测试仍写死旧 6% 安全半径，以及短主行/长副行不能要求恰好 62%；改为新默认半径并比较前后实际比例，未放宽圆裁容差。最终完整回归、CI 和线上结果在交付回复记录。

## 同步文档与长期记忆

README、CHANGELOG、architecture、automation、engineering-lessons；specs/v8.3.0-circle-fill/spec.md 与 plan.md；OKF bundle 的 circle-fill.md、references/circle-fill-measurements.json、index.md、log.md；本审计。

长期记忆修改 1 条：owner-preferences.md 新增“已认可视觉基线”，记录用户不希望重设计布局、偏好主衬线副无衬线、仅整体放大的偏好。新增记忆文件 0。已知后续文档债务 0；真实飞书复验及用户放大量认可列为明确验收边界。

发布前验证：lint、format、typecheck、build、3 项 HTTP 边界、7 组真实渲染均通过；网页 51 项最终覆盖通过，其中完整运行 49 项及两条旧 UI 测试修正后的定向通过。四张 README 样张由同一已验证构建重生成。

[同条件圆裁放大对照](../assets/reviews/v8.3.0-circle-comparison.png) 随 Git 保存，仅使用仓库已有东黎预设；HARMAY 独立输入与完整私有样张包不进入公开仓库。
