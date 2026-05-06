import { create } from 'zustand'
import { StorageService } from './storage'
import type { PushPrefs, ReminderFrequency } from '../types/push'

interface PushState extends PushPrefs {
  permissionState: NotificationPermission | 'unsupported'
  isLoading: boolean
  error: string | null
  load: () => void
  subscribe: (frequency: ReminderFrequency) => Promise<void>
  unsubscribe: () => Promise<void>
  setFrequency: (f: ReminderFrequency) => Promise<void>
}

export const usePushStore = create<PushState>()((set, get) => ({
  subscribed: false,
  frequency: 'daily',
  endpoint: null,
  permissionState: 'unsupported',
  isLoading: false,
  error: null,

  load() {
    const prefs = StorageService.getPushPrefs()
    const permission = 'Notification' in window ? Notification.permission : 'unsupported'
    set({ ...prefs, permissionState: permission as NotificationPermission | 'unsupported' })
  },

  async subscribe(frequency) {
    set({ isLoading: true, error: null })
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      })
      const subJson = sub.toJSON() as { endpoint: string; keys: { auth: string; p256dh: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subJson, frequency }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const prefs: PushPrefs = { subscribed: true, frequency, endpoint: subJson.endpoint }
      StorageService.savePushPrefs(prefs)
      set({ ...prefs, isLoading: false, permissionState: Notification.permission })
    } catch (err: unknown) {
      set({ isLoading: false, error: String(err) })
    }
  },

  async unsubscribe() {
    set({ isLoading: true, error: null })
    try {
      const { endpoint } = get()
      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      const prefs: PushPrefs = { subscribed: false, frequency: get().frequency, endpoint: null }
      StorageService.savePushPrefs(prefs)
      set({ ...prefs, isLoading: false })
    } catch (err: unknown) {
      set({ isLoading: false, error: String(err) })
    }
  },

  async setFrequency(frequency) {
    const { subscribed } = get()
    if (!subscribed) {
      StorageService.savePushPrefs({ ...StorageService.getPushPrefs(), frequency })
      set({ frequency })
      return
    }
    await get().subscribe(frequency)
  },
}))
