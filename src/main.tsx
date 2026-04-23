import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { bootstrapPwaUpdates } from './utils/pwaUpdate'

// 启动 SW 注册 + 新版本监听；UI 端通过 usePwaUpdate 读取状态。
bootstrapPwaUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
