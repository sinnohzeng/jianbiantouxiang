/**
 * 品牌标：与 public/icon.svg 同一份矢量，顶栏与 favicon 不再各画各的。
 * 渐变色值以 public/icon.svg 为准，改色时两边一起改。
 */

const FONT_STACK = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <defs>
        <linearGradient id="brand-ga" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e86a3d" />
          <stop offset="0.48" stopColor="#8d7cf0" />
          <stop offset="1" stopColor="#3d9ef2" />
        </linearGradient>
        <radialGradient id="brand-gb" cx="0.34" cy="0.2" r="0.62">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" ry="112" fill="url(#brand-ga)" />
      <rect width="512" height="512" rx="112" ry="112" fill="url(#brand-gb)" />
      <text
        x="256"
        y="256"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={FONT_STACK}
        fontWeight="700"
        fontSize="300"
        fill="#ffffff"
      >
        渐
      </text>
    </svg>
  )
}
