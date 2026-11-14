# 发布静态站

主站为 <https://jianbiantouxiang.com>，使用阿里云 ESA Pages，生产分支 main。推送会触发构建，完成后仍需检查线上产物。旧域名 `jianbian.zixuan.net` 在 Cloudflare Pages 上处理跳转。

## 构建

本地先运行 `npm run ci`。静态构建由根目录 [esa.jsonc](../esa.jsonc) 定义：

| 字段 | 配置 |
| --- | --- |
| name | jianbiantouxiang |
| installCommand | npm ci |
| buildCommand | npm run build |
| assets.directory | ./dist |
| assets.notFoundStrategy | singlePageApplication |

使用 Node 24。产物含 `/` 与 `/about` 两个入口。ESA 的配置文件优先级和路由规则见[官方构建指南](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/build-pages)。

## 现有站点接入要点

维护前先核实控制台实际配置。以下为本项目接入方式，不是所有 ESA 站点的通用模板：

- 站点采用 NS 接入，Pages 项目连接本仓库 main。
- `www.jianbiantouxiang.com` 通过域名绑定接入；根域名由 `jianbiantouxiang.com/*` 路由交给 Pages。
- 根域名 A 记录 `192.0.2.1` 是路由占位；流量须命中 Pages 路由，不能实际回源到该地址。
- 证书须覆盖根域名与所用子域名，启用 HTTPS；www 重定向至根域名并保留路径。
- `/about` 由静态文件解析，避免额外重写形成重定向环。

新建站点或更换账户时，按[站点接入](https://help.aliyun.com/zh/edge-security-acceleration/esa/getting-started/add-your-website-to-esa)、[域名路由](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/trigger)和[证书指南](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/configure-edge-certificates/)核实当前条件。历史控制台步骤保留在[v8.9 部署记录](archive/v8.9/deploy.md)。

## 缓存与响应头

`public/_headers`、`public/_redirects` 是 Cloudflare 约定，ESA 使用其控制台规则。带内容哈希或版本化文件名的资源可长缓存；HTML、service worker 和 manifest 应及时重新验证。稳定品牌 ID 不等于不可变资源 URL，替换素材时更新 asset 文件名。

建议配置 nosniff、DENY 与 strict-origin-when-cross-origin 等安全响应头，并实测实际返回值。配置文件中的建议不代表线上已经生效。

## 发布核验

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/main
curl -sS -I https://jianbiantouxiang.com/
curl -sS -I https://jianbiantouxiang.com/about
curl -sS -I https://jianbiantouxiang.com/sw.js
curl -sS https://jianbiantouxiang.com/ -o /tmp/avatar-live.html
```

核对远端 SHA 与本地一致；将线上 HTML 引用的 JS 文件名与 `dist/index.html` 对比，再检查本轮改动资源的内容和 MIME。SPA 回退页也可能返回 200，所以 HTTP 状态本身不足以证明素材存在。

在新浏览器会话检查默认头像、导出和 `/about`；已有 PWA 会话接受更新后再检查存档恢复。若仍是旧版本，记录响应头、Age、产物标识和部署状态，先区分构建与缓存，避免反复推空提交。

仓库当前使用本地门禁。若精确提交没有 GitHub workflow 运行，报告这一事实，不能称 GitHub CI 已通过。ESA 日志不可访问时，以公开产物验证上线，并注明日志未查阅。

## 其他运行目标

Cloudflare Pages 使用 `npm run build` 和 `dist/`；旧域名跳转由其规则配置。路径、查询参数和 HTTPS 应分别验证。

MCP 是独立 Node + Chromium 服务，静态 Pages 构建不能运行它。部署要求见[自动化指南](automation.md#运行-http-服务)；当前不提供公共 MCP 地址。
