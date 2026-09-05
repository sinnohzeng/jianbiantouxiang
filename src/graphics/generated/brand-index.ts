/**
 * 由 npm run gen:brand 生成，不要手改。
 * 远端条目来自 homarr-labs/dashboard-icons，Apache-2.0；商标归各品牌所有。
 * 带 file 的条目来自 assets/brand，是 owner 提供的官方素材。
 */

export type BrandCategory = "office" | "ai" | "dev" | "social" | "cloud" | "brand"

export interface BrandEntry {
  readonly id: string
  readonly zh: string
  readonly en: string
  readonly aliases: readonly string[]
  readonly category: BrandCategory
  readonly ext: 'svg' | 'png'
  /** 纯白单色变体的文件名。渐变底上默认用它，没有就退回原色。 */
  readonly white?: string
}

export const BRAND_CATEGORIES: readonly BrandCategory[] = [
  "office",
  "ai",
  "dev",
  "social",
  "cloud",
  "brand",
]

export const BRAND_INDEX: readonly BrandEntry[] = [
  { id: "lark", zh: "飞书", en: "Lark", aliases: ["feishu", "字节跳动", "bytedance"], category: "office", ext: "svg" },
  { id: "notion", zh: "Notion", en: "Notion", aliases: [], category: "office", ext: "svg" },
  { id: "figma", zh: "Figma", en: "Figma", aliases: [], category: "office", ext: "svg" },
  { id: "slack", zh: "Slack", en: "Slack", aliases: [], category: "office", ext: "svg" },
  { id: "miro", zh: "Miro", en: "Miro", aliases: ["白板"], category: "office", ext: "svg" },
  { id: "linear", zh: "Linear", en: "Linear", aliases: [], category: "office", ext: "svg", white: "linear-dark" },
  { id: "jira", zh: "Jira", en: "Jira", aliases: ["atlassian"], category: "office", ext: "svg" },
  { id: "confluence", zh: "Confluence", en: "Confluence", aliases: ["atlassian", "wiki"], category: "office", ext: "svg" },
  { id: "obsidian", zh: "Obsidian", en: "Obsidian", aliases: ["黑曜石", "笔记"], category: "office", ext: "svg" },
  { id: "framer", zh: "Framer", en: "Framer", aliases: [], category: "office", ext: "svg" },
  { id: "doubao-work", zh: "豆包工作", en: "Doubao Work", aliases: ["豆包", "doubao", "字节跳动"], category: "ai", ext: "png" },
  { id: "qoder", zh: "Qoder", en: "Qoder", aliases: ["阿里", "alibaba"], category: "ai", ext: "svg", white: "qoder-white" },
  { id: "workbuddy", zh: "WorkBuddy", en: "WorkBuddy", aliases: ["buddy"], category: "ai", ext: "svg" },
  { id: "openai", zh: "OpenAI", en: "OpenAI", aliases: [], category: "ai", ext: "svg", white: "openai-light" },
  { id: "chatgpt", zh: "ChatGPT", en: "ChatGPT", aliases: ["gpt"], category: "ai", ext: "svg" },
  { id: "anthropic", zh: "Anthropic", en: "Anthropic", aliases: [], category: "ai", ext: "svg", white: "anthropic-dark" },
  { id: "claude-ai", zh: "Claude", en: "Claude", aliases: ["anthropic"], category: "ai", ext: "svg", white: "claude-ai-light" },
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
  { id: "tiktok", zh: "抖音", en: "TikTok", aliases: ["douyin", "字节跳动"], category: "social", ext: "svg", white: "tiktok-light" },
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
]
