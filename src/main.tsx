import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('missing #root container')

// 界面语言在阶段 3 接入 i18n 后按用户选择改写，这里先给默认值
document.documentElement.lang = 'zh-CN'

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
