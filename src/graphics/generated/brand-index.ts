/**
 * 由 npm run gen:brand 生成，不要手改。
 * 远端条目来自 homarr-labs/dashboard-icons，Apache-2.0；商标归各品牌所有。
 * 带 file 的条目来自 assets/brand，是 owner 提供的素材。
 */

export type BrandCategory = "bytedance" | "office" | "ai" | "dev" | "social" | "cloud" | "brand"

export interface BrandEntry {
  readonly id: string
  /** 版本化资源名；未指定时与稳定存档ID相同。 */
  readonly asset?: string
  readonly zh: string
  readonly en: string
  readonly aliases: readonly string[]
  readonly category: BrandCategory
  readonly ext: 'svg' | 'png'
  /** 白色源文件变体。第三方来源不等于品牌官方授权。 */
  readonly white?: string
}

export const BRAND_CATEGORIES: readonly BrandCategory[] = [
  "bytedance",
  "office",
  "ai",
  "dev",
  "social",
  "cloud",
  "brand",
]

export const BRAND_INDEX: readonly BrandEntry[] = [
  { id: "doubao-work", zh: "豆包工作", en: "Doubao Work", aliases: ["豆包", "doubao", "字节跳动"], category: "bytedance", ext: "png", asset: "doubao-work-202611" },
  { id: "bd-doubao-work-black", zh: "豆包工作 · 黑色组合", en: "Doubao Work · black lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-doubao-work-white", zh: "豆包工作 · 白色组合", en: "Doubao Work · white lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "lark", zh: "飞书", en: "Lark", aliases: ["feishu", "字节跳动", "bytedance"], category: "bytedance", ext: "svg", asset: "feishu-symbol-202611" },
  { id: "bd-feishu-color", zh: "飞书 · 原色组合", en: "Feishu · color lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-feishu-black", zh: "飞书 · 纯黑组合", en: "Feishu · black lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-feishu-white", zh: "飞书 · 纯白组合", en: "Feishu · white lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-doubao-color", zh: "豆包 · 原色组合", en: "Doubao · Color lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-volcengine-color", zh: "火山引擎 · 原色组合", en: "Volcengine · Color lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-oceanengine-black", zh: "巨量引擎 · 纯黑", en: "Ocean Engine · black", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-oceanengine-white", zh: "巨量引擎 · 纯白", en: "Ocean Engine · white", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-bytedance-color", zh: "字节跳动 · 原色", en: "ByteDance · Color", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-bytedance-white", zh: "字节跳动 · 纯白", en: "ByteDance · White", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-douyin-group-color", zh: "抖音集团 · 原色", en: "Douyin Group · Color", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-douyin-color", zh: "抖音 · 原色组合", en: "Douyin · Color lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-douyin-white", zh: "抖音 · 纯白组合", en: "Douyin · White lockup", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-toutiao-color", zh: "今日头条 · 原色", en: "Toutiao · color", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-toutiao-black", zh: "今日头条 · 纯黑", en: "Toutiao · black", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-toutiao-white", zh: "今日头条 · 纯白", en: "Toutiao · white", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "png" },
  { id: "bd-xigua-color", zh: "西瓜视频 · 原色", en: "Xigua Video · color", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-xigua-white", zh: "西瓜视频 · 纯白", en: "Xigua Video · white", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-capcut-black", zh: "CapCut · 纯黑", en: "CapCut · black", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-capcut-white", zh: "CapCut · 纯白", en: "CapCut · white", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-tiktok-black", zh: "TikTok · 纯黑音符", en: "TikTok · black symbol", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "bd-tiktok-white", zh: "TikTok · 纯白音符", en: "TikTok · white symbol", aliases: ["字节跳动", "bytedance"], category: "bytedance", ext: "svg" },
  { id: "tiktok", zh: "抖音", en: "TikTok", aliases: ["douyin", "字节跳动"], category: "bytedance", ext: "svg" },
  { id: "notion", zh: "Notion", en: "Notion", aliases: [], category: "office", ext: "svg" },
  { id: "figma", zh: "Figma", en: "Figma", aliases: [], category: "office", ext: "svg" },
  { id: "slack", zh: "Slack", en: "Slack", aliases: [], category: "office", ext: "svg" },
  { id: "miro", zh: "Miro", en: "Miro", aliases: ["白板"], category: "office", ext: "svg" },
  { id: "linear", zh: "Linear", en: "Linear", aliases: [], category: "office", ext: "svg", white: "linear-dark" },
  { id: "jira", zh: "Jira", en: "Jira", aliases: ["atlassian"], category: "office", ext: "svg" },
  { id: "confluence", zh: "Confluence", en: "Confluence", aliases: ["atlassian", "wiki"], category: "office", ext: "svg" },
  { id: "obsidian", zh: "Obsidian", en: "Obsidian", aliases: ["黑曜石", "笔记"], category: "office", ext: "svg" },
  { id: "framer", zh: "Framer", en: "Framer", aliases: [], category: "office", ext: "svg" },
  { id: "qoder", zh: "Qoder", en: "Qoder", aliases: ["阿里", "alibaba"], category: "ai", ext: "svg", white: "qoder-white" },
  { id: "workbuddy", zh: "WorkBuddy", en: "WorkBuddy", aliases: ["buddy"], category: "ai", ext: "svg" },
  { id: "openai", zh: "OpenAI", en: "OpenAI", aliases: [], category: "ai", ext: "svg", white: "openai-light" },
  { id: "chatgpt", zh: "ChatGPT", en: "ChatGPT", aliases: ["gpt"], category: "ai", ext: "svg" },
  { id: "anthropic", zh: "Anthropic", en: "Anthropic", aliases: [], category: "ai", ext: "svg" },
  { id: "claude-ai", zh: "Claude", en: "Claude", aliases: ["anthropic"], category: "ai", ext: "svg" },
  { id: "google-gemini", zh: "Gemini", en: "Google Gemini", aliases: ["谷歌"], category: "ai", ext: "svg" },
  { id: "deepseek", zh: "DeepSeek", en: "DeepSeek", aliases: ["深度求索"], category: "ai", ext: "svg" },
  { id: "qwen", zh: "通义千问", en: "Qwen", aliases: ["千问", "阿里", "tongyi"], category: "ai", ext: "svg" },
  { id: "kimi-ai", zh: "Kimi", en: "Kimi", aliases: ["月之暗面", "moonshot"], category: "ai", ext: "svg" },
  { id: "hugging-face", zh: "Hugging Face", en: "Hugging Face", aliases: ["抱抱脸", "huggingface"], category: "ai", ext: "svg" },
  { id: "github-copilot", zh: "GitHub Copilot", en: "GitHub Copilot", aliases: ["copilot"], category: "ai", ext: "svg", white: "github-copilot-dark" },
  { id: "github", zh: "GitHub", en: "GitHub", aliases: ["gh"], category: "dev", ext: "svg", white: "github-light" },
  { id: "gitlab", zh: "GitLab", en: "GitLab", aliases: [], category: "dev", ext: "svg" },
  { id: "gitee", zh: "Gitee", en: "Gitee", aliases: ["码云"], category: "dev", ext: "svg" },
  { id: "vscode", zh: "VS Code", en: "Visual Studio Code", aliases: ["vscode"], category: "dev", ext: "svg" },
  { id: "docker", zh: "Docker", en: "Docker", aliases: ["容器"], category: "dev", ext: "svg" },
  { id: "kubernetes", zh: "Kubernetes", en: "Kubernetes", aliases: ["k8s"], category: "dev", ext: "svg" },
  { id: "reactjs", zh: "React", en: "React", aliases: [], category: "dev", ext: "svg" },
  { id: "typescript", zh: "TypeScript", en: "TypeScript", aliases: ["ts"], category: "dev", ext: "svg" },
  { id: "python", zh: "Python", en: "Python", aliases: [], category: "dev", ext: "svg" },
  { id: "ubuntu-linux", zh: "Ubuntu", en: "Ubuntu", aliases: ["linux"], category: "dev", ext: "svg" },
  { id: "arch-linux", zh: "Arch Linux", en: "Arch Linux", aliases: ["linux", "arch"], category: "dev", ext: "svg" },
  { id: "android", zh: "Android", en: "Android", aliases: ["安卓"], category: "dev", ext: "svg" },
  { id: "chrome", zh: "Chrome", en: "Google Chrome", aliases: ["浏览器", "谷歌"], category: "dev", ext: "svg" },
  { id: "wechat", zh: "微信", en: "WeChat", aliases: ["weixin", "腾讯"], category: "social", ext: "svg", white: "wechat-dark" },
  { id: "qq", zh: "QQ", en: "QQ", aliases: ["腾讯"], category: "social", ext: "svg" },
  { id: "bilibili", zh: "哔哩哔哩", en: "Bilibili", aliases: ["B站", "b站"], category: "social", ext: "svg" },
  { id: "weibo", zh: "微博", en: "Weibo", aliases: ["新浪"], category: "social", ext: "svg" },
  { id: "telegram", zh: "Telegram", en: "Telegram", aliases: ["电报", "tg"], category: "social", ext: "svg" },
  { id: "discord", zh: "Discord", en: "Discord", aliases: [], category: "social", ext: "svg" },
  { id: "twitter", zh: "Twitter", en: "Twitter", aliases: ["推特", "x"], category: "social", ext: "svg" },
  { id: "linkedin", zh: "领英", en: "LinkedIn", aliases: [], category: "social", ext: "svg" },
  { id: "youtube", zh: "YouTube", en: "YouTube", aliases: ["油管"], category: "social", ext: "svg" },
  { id: "spotify", zh: "Spotify", en: "Spotify", aliases: [], category: "social", ext: "svg", white: "spotify-light" },
  { id: "cloudflare", zh: "Cloudflare", en: "Cloudflare", aliases: ["cf"], category: "cloud", ext: "svg" },
  { id: "vercel", zh: "Vercel", en: "Vercel", aliases: [], category: "cloud", ext: "svg", white: "vercel-light" },
  { id: "stripe", zh: "Stripe", en: "Stripe", aliases: ["支付"], category: "cloud", ext: "svg", white: "stripe-dark" },
  { id: "paypal", zh: "PayPal", en: "PayPal", aliases: ["贝宝", "支付"], category: "cloud", ext: "svg" },
  { id: "baidu", zh: "百度", en: "Baidu", aliases: [], category: "cloud", ext: "svg", white: "baidu-dark" },
  { id: "apple", zh: "苹果", en: "Apple", aliases: ["iphone", "mac"], category: "brand", ext: "svg", white: "apple-light" },
  { id: "microsoft", zh: "微软", en: "Microsoft", aliases: ["windows"], category: "brand", ext: "svg" },
  { id: "google", zh: "谷歌", en: "Google", aliases: [], category: "brand", ext: "svg" },
  { id: "huawei", zh: "华为", en: "Huawei", aliases: [], category: "brand", ext: "svg" },
  { id: "xiaomi-global", zh: "小米", en: "Xiaomi", aliases: ["mi"], category: "brand", ext: "svg" },
  { id: "nvidia", zh: "英伟达", en: "NVIDIA", aliases: [], category: "brand", ext: "svg" },
  { id: "dongli-symbol-white", zh: "东黎羊绒 · 图形标", en: "DONGLI · symbol", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-lockup-full-white", zh: "东黎羊绒 · 完整组合", en: "DONGLI · lockup-full", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-wordmark-bilingual-inline-white", zh: "东黎羊绒 · 横版字标", en: "DONGLI · wordmark-bilingual-inline", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-symbol-primary", zh: "东黎羊绒 · 图形标", en: "DONGLI · symbol", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-symbol-black", zh: "东黎羊绒 · 图形标", en: "DONGLI · symbol", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-lockup-full-primary", zh: "东黎羊绒 · 完整组合", en: "DONGLI · lockup-full", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-lockup-full-black", zh: "东黎羊绒 · 完整组合", en: "DONGLI · lockup-full", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-wordmark-bilingual-inline-primary", zh: "东黎羊绒 · 横版字标", en: "DONGLI · wordmark-bilingual-inline", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "dongli-wordmark-bilingual-inline-black", zh: "东黎羊绒 · 横版字标", en: "DONGLI · wordmark-bilingual-inline", aliases: ["东黎", "羊绒", "dongli"], category: "brand", ext: "svg" },
  { id: "harmay-wordmark-black", zh: "话梅 HARMAY 黑色", en: "HARMAY Black", aliases: ["harmay", "话梅"], category: "brand", ext: "svg" },
  { id: "harmay-wordmark-white", zh: "话梅 HARMAY 白色", en: "HARMAY White", aliases: ["harmay", "话梅"], category: "brand", ext: "png" },
]
