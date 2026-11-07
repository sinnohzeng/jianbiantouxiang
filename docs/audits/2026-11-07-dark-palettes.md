# 导出首次打开、品牌黑稿与默认内容验收

范围：v8.6.0；规约见 ../../specs/v8.6.0-dark-palettes/。运行环境为 Chromium headless / SwiftShader，手机为视口模拟。

## 复现与修复

1. 冷启动导出抽屉首次挂载即 open：基线逐帧记录只有一个最终 transform，无过渡；再次打开有28个不同 transform。外壳常驻、控件异步后，冷启动记录24个不同 transform，重开29个。时间样本仅诊断，不作为跨设备性能承诺。生产回归阻塞控件 chunk，确认抽屉先打开、加载状态可见、内容加载后可操作，并覆盖减少动态效果。
2. HARMAY 黑色 SVG 只有 viewBox，浏览器默认固有尺寸导致裁切坐标与大画布绘制异常。补齐等比固有尺寸（推导最大边2048），同时修复 viewBox 宽度索引。原稿路径、颜色不变。2048²白底仅黑稿实际合成有100083个近黑像素；修复前同类大画布为空。黑白稿×深浅底四种输出已查看；反搭低对比仍存在。
3. “变换底纹”只改变种子，保留文字、图标、配色、质感和排版，测试比较除 seed 外的整份配置。
4. 首次和重置使用「工作新习惯 / 你说豆包干」与原色 doubao-work；用户截图中的蓝色折环与现有素材匹配。UI语言不接管画布。明确旧文字、字体、无图标存档仍保留。CLI/MCP 是调用方显式传内容的接口，保持原契约。

## 配色与可视证据

新增10组低饱和深色配色，现有37组值与顺序保留。120张背景（10组×4质感×3固定种子，256²、光感0.08）无回退，最差白字对比5.196799:1。测量与适用边界见 [研究](../research/avatar-optical/dark-palettes.md)。

- [抽屉逐帧测量摘要](../assets/reviews/v8.6.0/drawer-metrics.json)
- [新默认实际512px输出](../assets/reviews/v8.6.0/default.png)
- [十组完整图及32/48/64px圆裁](../assets/reviews/v8.6.0/palettes.png)
- [逐张对比测量](../assets/reviews/v8.6.0/contrast.json)
- [HARMAY修复前](../assets/reviews/v8.6.0/harmay-before.png) / [修复后](../assets/reviews/v8.6.0/harmay-after.png)

已查看十组拼图：主副层级保持、白字与深底分离，色系间有冷暖变化；32px细字标仍不能保证逐字辨认。没有真人偏好实验、飞书真机或Safari验收，不以智能体视觉判断替代用户认可。

## 同步与边界

本轮同步 SDD、研究 bundle、README、架构、CHANGELOG、i18n keys 与工程经验。长期记忆无新增：默认内容属于产品规约与配置，工程教训已有专门文档。发布结果与最终门禁在交付记录中列出；不遗留未实现的文档承诺。

外壳常驻的取舍：当前首屏 JS（entry + modulepreload，gzip）约293.55 KiB，高于250 KiB参考线；Drawer基础依赖随外壳提前下载，重型控件仍延迟。不把修复描述为首屏性能优化。

实际 CLI 用显式两行文字、原色豆包 PNG 与 smoked-jade 生成256px PNG（[产物](../assets/reviews/v8.6.0/cli.png)），报告 WebGL2、overflow=false、采样最差对比5.27，保留48px小字提示。沙箱受限的云工作区只对这次受控本地测试设置 AVATAR_CHROMIUM_SANDBOX=0；没有部署远程服务或修改生产沙箱配置。CLI options 中已包含十组新配色。

## 本地验证结果

- lint、format:check、typecheck、build 通过；单元76文件、878项通过。
- E2E完整运行66项通过，1项仍假定初始无品牌；改为先检查默认品牌、清除后验证空态，定向重测通过。总计67个场景覆盖通过，包括两种视口的冷启动慢加载、减少动态效果及2048黑稿墨迹。复制图片曾在并行重负载中超时，后续完整运行通过，未放宽预算或改变功能。
- service单元3项通过；service构建、CLI options与真实render通过。完整服务集成7项通过，包含官方 SDK 的 HTTP/stdio、CLI、批量部分失败、超时队列和 SVG 私网请求隔离。CI 暴露旧配色数量断言，已同步为47并重跑通过。

- 截图脚本完成16张桌面1440、iPhone15和iPhone SE深浅主题、编辑及导出视图，全部逐张检查；[小屏编辑](../assets/reviews/v8.6.0/mobile.png)和[小屏导出](../assets/reviews/v8.6.0/export.png)保留为证据。
