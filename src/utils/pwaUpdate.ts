import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// 模块级 state：vite-plugin-pwa 的 registerSW 不应重复调用，
// 用一个闭包持有更新函数 + 一组订阅者，让 React 组件安全读取。
let needRefresh = false
let applyUpdate: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()
let registered = false

function notify() {
  listeners.forEach(l => l())
}

/** 在 app 启动时调用一次，注册 SW。 */
export function bootstrapPwaUpdates() {
  if (registered) return
  registered = true
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true
      notify()
    },
  })
  applyUpdate = () => updateSW(true)
}

/** React hook：返回是否有待应用的新版本 + 触发刷新的函数 */
export function usePwaUpdate() {
  const [state, setState] = useState(needRefresh)

  useEffect(() => {
    const listener = () => setState(needRefresh)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  return {
    needRefresh: state,
    apply: () => applyUpdate?.(),
  }
}
