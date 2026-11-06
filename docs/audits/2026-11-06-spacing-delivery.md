# v8.2.1 间距复核与交付

用户否定旧 HARMAY 样张后，先写 `specs/v8.2.1-spacing/` 再修改共享间距、网页圆裁求解和自动化排版。旧版虽然无裁切，却把三层信息挤在一起；上一轮的视觉验收不足。本轮不以像素质心或无溢出代替美观判断。

## 证据与判断

- 用户截图原件 `libfile_d74c7debd6188191aa0bd4e3d519b089` 与真实客户原稿对照；MCP 实际生成 16 张原图。网页另上传真实 HARMAY 白色 PNG 比较宋体 600/700。
- HARMAY 双行 512 px 的可见间距从 20/19 变为 40/27 px；组高 243→263 px，上下留白 124/125 px，主字号只减少约 3.1%。新选宋体默认 600，已有手动字重保留。
- 逐张比较 HARMAY 一/两行、东黎图形/完整/横版及纯文字，检查 32/48/64 px 圆裁。新的层级与间距比旧版清楚，不能据此宣称所有头像审美合格。极宽英文品牌在 32 px 无法逐字读清；东黎完整组合仍细密，品牌自带留白使墨迹中心不必等于画布中心。
- 可复核方法与数值见 `docs/research/avatar-optical/brand-spacing.md`、`references/spacing-comparison.json` 和 `scripts/measure-spacing.mjs`。白字阈值测量不适用于任意配色，也不是美观评分。

## 验证

lint、format:check、typecheck、836 单元测试、构建与 service build 通过；7 真实渲染/MCP 集成组与 3 HTTP 边界组通过。50 项网页 E2E 中，49 项首轮通过；新增字体测试因选项实际可访问名称为“粗体 700”，测试误用“粗体”而超时，修正定位后该项独立通过。产品实现没有借此放松断言。

默认四张样张重新生成，网页桌面与两种 iPhone 模拟器的深浅主题截图复核。OKF 独立目录按固定 v0.2 规范检查 frontmatter、type、sources resource、脚注对应、index 版本、倒序 log 和带时区生成时间；没有伪造人工 verified。

## 文档与记忆

同步文件：README、CHANGELOG、docs/architecture.md、docs/automation.md、docs/engineering-lessons.md、本审计、specs/v8.2.1-spacing/spec.md 与 plan.md；研究 bundle 的 index.md、log.md、新增 brand-spacing.md 与测量 JSON。清理 automation 文档中已过时的“仅黑体、无品牌预设”限制，历史研究快照保留其当时事实并用新研究说明修正。

长期记忆本轮新增或修改 **0 条**：用户偏好与授权已在上一轮落盘；本次实现可由代码和变更记录推出，踩坑进入 engineering-lessons，按仓库准入规则不重复写记忆。后续 commit 的已知文档债务 **0**。真实飞书客户端上传和用户主观确认尚未发生，远程 MCP 托管也不在本轮发布范围。

## 持久交付

- 前后对照图：`libfile_21801d4e672881919d19a43731e179a0`。
- 原图、对照网页及元数据：`libfile_eb3455c5f064819182d397b254bfbc8f`。
- GitHub CI、最终提交与线上版本以交付回复中的实际链接报告，不把本地验证写成云端发布成功。
