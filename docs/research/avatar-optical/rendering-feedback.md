---
type: EngineeringResearch
sources:
  - id: base-animation
    resource: https://base-ui.com/react/handbook/animation
  - id: base-drawer
    resource: https://base-ui.com/react/components/drawer
  - id: draw-image
    resource: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
---

# 抽屉首次反馈与 SVG 固有坐标

查阅日期：2026-11-07。资料为对应组件官方文档和 Web API 参考；项目故障原因由真实浏览器复现确认，不把文档当作故障证明。

Base UI 用 data-starting-style / data-ending-style 表示过渡的起止状态，建议以 transition 支持中途反向关闭。[^base-animation] Drawer 由 Root、Portal、Popup 和内容组成。[^base-drawer] 本项目据此将控制打开状态的轻量外壳与懒加载内容分离；慢网先有标题与加载反馈，避免整个根节点以已打开状态首次出现。资源成本是 Drawer 基础依赖进入首屏，不能宣称零成本或所有设备帧率均改善。

MDN 指出 drawImage 的裁切与缩放使用源图固有尺寸，调用者应使用 naturalWidth/naturalHeight 计算源坐标。[^draw-image] 本项目的 HARMAY SVG 缺少固有宽高，viewBox 只表达内部坐标与比例；实际高分辨率裁切输出为空。补充等比且有界的固有视口后恢复。该浏览器异常由本轮实测支持，不外推全部实现；原始路径、比例和颜色保留。

验证方法、实际像素及冷启动前后记录见 [本轮审计](../../audits/2026-11-07-dark-palettes.md)。减少动态效果、慢内容加载、首次及再次打开均独立测试；黑字深底低对比与零墨迹必须分别判断。

[^base-animation]: [Base UI Animation](https://base-ui.com/react/handbook/animation)。
[^base-drawer]: [Base UI Drawer](https://base-ui.com/react/components/drawer)。
[^draw-image]: [MDN drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)。
