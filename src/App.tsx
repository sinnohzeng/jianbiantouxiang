import { Button } from '@/components/ui/button'
import { DEFAULT_CONFIG, configHash } from '@/state/config'

export default function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">渐变头像生成器</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        输入几个字，秒出一张柔光质感的渐变头像。界面正在搭建中，当前只验证脚手架链路。
      </p>
      <Button type="button">默认配置指纹 {configHash(DEFAULT_CONFIG)}</Button>
    </main>
  )
}
