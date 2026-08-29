import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
// 主题在首帧前由 index.html 的内联脚本定好，这里再导入一次是为了接上系统主题的监听
import '@/app/theme'
import '@/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('missing #root container')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
