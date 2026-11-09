# 字节品牌头像素材验收

范围：v8.7.0。新增23个原色/纯黑/纯白SVG或PNG，已有69个入口保留，共92个。原始文件与版本限制见 assets/brand/bytedance/README.md 和 manifest.json。

客户分组保持原顺序，字节组紧随其后，组内豆包工作、飞书、豆包优先。旧doubao-work、lark、tiktok保留ID与原图，其他品牌相对顺序不变。新增原稿不接受程序染色，避免存档残留mono开关改写品牌颜色。

23个版本均通过实际Chromium加载与绘制，使用与预览/导出相同的loadBrandGraphic、drawGraphic及composeAvatar。故意传mono=true及红色目标，黑白稿仍保持原始色；统计完全不透明像素，纯黑/纯白比例均达到99.5%以上。逐张结果见 [测量](../assets/reviews/v8.7.0/render-check.json)。

已人工查看三组浅深底原稿、256px合成及32/48/64px圆裁：[第一组](../assets/reviews/v8.7.0/brands-1.png)、[第二组](../assets/reviews/v8.7.0/brands-2.png)、[第三组](../assets/reviews/v8.7.0/brands-3.png)。深底黑稿低对比是选色限制，不是渲染失败；32px完整组合中的品牌小字不能保证逐字可读。保留既有排版与手动控制，不以自动测试替代审美认可。

新增测试覆盖稳定ID、排序、哈希、精选文件范围、保存配置兼容、精确原稿不被染色，以及桌面/手机选择后刷新保留。浏览器为Chromium模拟视口，未验证飞书真机或Safari。

[手机品牌选择器](../assets/reviews/v8.7.0/picker-mobile.png)和[桌面品牌选择器](../assets/reviews/v8.7.0/picker-desktop.png)已查看：客户分组之后即字节组，精确黑稿缩略图用浅底、白稿用深底，分类列表可滚动。逐字节核对确认旧版69条目录及80个公开素材文件均未改变，仅3个现有品牌改为字节分类。

## 本地门禁

lint、format:check、typecheck、build通过；77个单元文件、881项测试通过。E2E完整运行66项通过，旧飞书模糊匹配两项和并行资源争用下复制超时一项在精确匹配修正后单worker重测全部通过，共69个场景。未放宽预算。截图脚本单独重跑成功，16张桌面1440、iPhone15、iPhoneSE深浅主题编辑/导出/整页图逐张检查，另查看两张品牌选择器截图。早先并行截图字体等待超时，不计入通过结果。

本轮文档同步README、about、architecture、CHANGELOG、i18n keys、素材精选说明及哈希、SDD、验收和工程经验；未新增长期记忆，未留未实现文档承诺。
