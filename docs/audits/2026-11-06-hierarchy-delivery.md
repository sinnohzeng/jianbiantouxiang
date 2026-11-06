# v8.2.2：回到用户手调参照

## 事实与修正

用户否定 v8.2.1 的视觉位置和主次。已核对原始文件的 Library 扩展属性：`604.jpg` 对应 `libfile_96e6a844a7208191aecb1c332bc1a120`，包含 HARMAY 两行与东黎单行；没有东黎两行手调稿。没有以重建稿代替原始参照。

SDD 先写规范和计划，再实现候选。自动副行从 80% 回到 62%，图文/主副行间距收回到较紧凑的不同层级；品牌透明留白保留，但整组位置改用实际墨迹诊断。圆裁钳住位移时最多统一缩小 6%，纵移上限 3.5%；保留纯文字和手动配置。

逐一查看 HARMAY、东黎图形、完整组合、横版的真实 MCP 输出，补充一行与纯文字对照；512 px 原图和 32/48/64 px 圆裁一并交付。网页另用客户原始白色 PNG 实际上传，比较宋体 600/700 和一/两行。无新飞书客户端上传，未获用户认可，不宣称自动审美通过。

具体数值、视觉取舍和完整组合仍较复杂的限制，见 `docs/research/avatar-optical/hierarchy-placement.md`。没有把包围盒等距或质心归零当作充分证据。

## 工程验证

837 单元测试、7 真实渲染/MCP 集成组、3 HTTP 边界组通过；lint、format:check、typecheck、build 与 service build 通过。单测初轮发现一处旧间距坐标期望和一处浮点严格比较，修正测试后全量通过；没有修改产品来迁就旧视觉参数。

50 项网页 E2E 首轮全部通过（6.8 分钟）；四张默认样张重新生成。设备截图按桌面、iPhone 15、iPhone SE 的深浅主题复核。GitHub CI 和生产页面结果以交付回复的实际链接为准。

## 同步文档

- README.md、CHANGELOG.md、docs/architecture.md、docs/automation.md：当前行为、参数与边界。
- docs/contributing.md：用户原图与上一版并列、小尺寸验收、工程结果与审美认可分开报告。
- docs/engineering-lessons.md：副行争夺分量、透明边与可见内容、圆裁钳住校正、旧判断失准。
- specs/v8.2.2-hierarchy/spec.md、plan.md：本轮 SDD。
- docs/research/avatar-optical/hierarchy-placement.md、references/hierarchy-comparison.json、index.md、log.md：OKF v0.2 研究记录与证据。
- 本审计：当轮交付与未验证边界。

长期记忆本轮新增或修改 0 条：授权、偏好已在长期记录，新的规约与教训按仓库准入规则分别维护，不重复复制。后续 commit 的已知文档债务 0；用户审美认可与真实飞书客户端复验是已披露的验收边界。

## 持久样张

- 含用户原始参照的前后拼图：`libfile_a80782073ac4819199e9b76310d1c4ad`。
- 16 张 MCP 原图、网页上传样张、测量和圆裁对照：`libfile_e8bcabfada9481919c0166500638d690`。
