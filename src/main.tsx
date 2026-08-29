import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
// 主题在首帧前由 index.html 的内联脚本定好，这里再导入一次是为了接上系统主题的监听
import '@/app/theme'
import '@/index.css'

// 端到端测试的探针。生产链路不引用它，只有开发模式或显式 ?probe=1 才把那份 chunk 拉下来
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('probe')) {
  void import('@/app/probe').then((module) => module.installProbe())
}

const container = document.getElementById('root')
if (!container) throw new Error('missing #root container')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
