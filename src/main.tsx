import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { bootstrapPwaUpdates } from './utils/pwaUpdate'
import { StorageService } from './store/storage'

// 启动 SW 注册 + 新版本监听；UI 端通过 usePwaUpdate 读取状态。
bootstrapPwaUpdates()

const initialThemePreference = StorageService.getThemePreference()
document.documentElement.dataset.theme = initialThemePreference === 'system'
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : initialThemePreference

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
