import { create } from 'zustand'
import { StorageService } from './storage'
import { fetchUsdCny, isFresh } from '../utils/exchangeRate'
import { formatDateKey } from '../utils/formatters'
import type { Snapshot, SnapshotItem, ExchangeRate } from '../types/models'
import { v4 as uuidv4 } from '../utils/uuid'

interface AssetState {
  snapshots: Snapshot[]
  annualTarget: number
  customPlatforms: string[]
  customClasses: string[]
  hiddenPlatforms: string[]
  hiddenClasses: string[]
  exchangeRate: ExchangeRate | null
  isFetchingRate: boolean
  rateStatus: string

  // actions
  loadAll: () => void
  saveSnapshot: (snap: Snapshot) => void
  deleteSnapshot: (dateKey: string) => void
  setAnnualTarget: (v: number) => void
  addCustomPlatform: (name: string) => void
  removeCustomPlatform: (name: string) => void
  addCustomClass: (name: string) => void
  removeCustomClass: (name: string) => void
  hideBuiltinPlatform: (key: string) => void
  restoreBuiltinPlatform: (key: string) => void
  hideBuiltinClass: (key: string) => void
  restoreBuiltinClass: (key: string) => void
  refreshExchangeRate: (silent?: boolean) => Promise<void>

  // computed helpers (called inline, not reactive)
  computeItemValueCNY: (item: SnapshotItem) => number
  draftSnapshot: (dateKey?: string) => Snapshot
}

export const useAssetStore = create<AssetState>((set, get) => ({
  snapshots: [],
  annualTarget: 0,
  customPlatforms: [],
  customClasses: [],
  hiddenPlatforms: [],
  hiddenClasses: [],
  exchangeRate: null,
  isFetchingRate: false,
  rateStatus: '',

  loadAll() {
    const snapshots = StorageService.getSnapshots().sort(
      (a, b) => b.dateKey.localeCompare(a.dateKey)
    )
    set({
      snapshots,
      annualTarget: StorageService.getAnnualTarget(),
      customPlatforms: StorageService.getCustomPlatforms(),
      customClasses: StorageService.getCustomClasses(),
      hiddenPlatforms: StorageService.getHiddenPlatforms(),
      hiddenClasses: StorageService.getHiddenClasses(),
      exchangeRate: StorageService.getExchangeRate(),
    })
  },

  saveSnapshot(snap) {
    const { snapshots, computeItemValueCNY } = get()
    // recompute item valueCNY before saving
    const repriced: Snapshot = {
      ...snap,
      items: snap.items.map(item => ({ ...item, valueCNY: computeItemValueCNY(item) })),
    }
    repriced.totalValueCNY = repriced.items.reduce((s, i) => s + i.valueCNY, 0)
    const existing = snapshots.findIndex(s => s.dateKey === snap.dateKey)
    const next = existing >= 0
      ? snapshots.map((s, i) => (i === existing ? repriced : s))
      : [repriced, ...snapshots]
    next.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    StorageService.saveSnapshots(next)
    set({ snapshots: next })
  },

  deleteSnapshot(dateKey) {
    const next = get().snapshots.filter(s => s.dateKey !== dateKey)
    StorageService.saveSnapshots(next)
    set({ snapshots: next })
  },

  setAnnualTarget(v) {
    StorageService.saveAnnualTarget(v)
    set({ annualTarget: v })
  },

  addCustomPlatform(name) {
    const next = [...new Set([...get().customPlatforms, name.trim()])]
    StorageService.saveCustomPlatforms(next)
    set({ customPlatforms: next })
  },

  removeCustomPlatform(name) {
    const next = get().customPlatforms.filter(p => p !== name)
    StorageService.saveCustomPlatforms(next)
    set({ customPlatforms: next })
  },

  addCustomClass(name) {
    const next = [...new Set([...get().customClasses, name.trim()])]
    StorageService.saveCustomClasses(next)
    set({ customClasses: next })
  },

  removeCustomClass(name) {
    const next = get().customClasses.filter(c => c !== name)
    StorageService.saveCustomClasses(next)
    set({ customClasses: next })
  },

  hideBuiltinPlatform(key) {
    const next = [...new Set([...get().hiddenPlatforms, key])]
    StorageService.saveHiddenPlatforms(next)
    set({ hiddenPlatforms: next })
  },

  restoreBuiltinPlatform(key) {
    const next = get().hiddenPlatforms.filter(k => k !== key)
    StorageService.saveHiddenPlatforms(next)
    set({ hiddenPlatforms: next })
  },

  hideBuiltinClass(key) {
    const next = [...new Set([...get().hiddenClasses, key])]
    StorageService.saveHiddenClasses(next)
    set({ hiddenClasses: next })
  },

  restoreBuiltinClass(key) {
    const next = get().hiddenClasses.filter(k => k !== key)
    StorageService.saveHiddenClasses(next)
    set({ hiddenClasses: next })
  },

  async refreshExchangeRate(silent = false) {
    if (!silent) set({ isFetchingRate: true, rateStatus: '获取汇率中…' })
    try {
      const rate = await fetchUsdCny()
      const er: ExchangeRate = { rate, updatedAt: new Date().toISOString() }
      StorageService.saveExchangeRate(er)
      set({ exchangeRate: er, rateStatus: `USD/CNY ${rate.toFixed(4)} · 已更新` })
    } catch {
      set({ rateStatus: '汇率获取失败，使用缓存' })
    } finally {
      set({ isFetchingRate: false })
    }
  },

  computeItemValueCNY(item) {
    const { exchangeRate } = get()
    if (item.currency === 'CNY') return item.amount > 0 ? item.amount : item.valueCNY
    if (item.currency === 'USD') {
      if (item.amount > 0 && exchangeRate) return item.amount * exchangeRate.rate
      return item.valueCNY
    }
    return item.valueCNY > 0 ? item.valueCNY : item.amount
  },

  draftSnapshot(dateKey) {
    const key = dateKey ?? formatDateKey(new Date())
    const existing = get().snapshots.find(s => s.dateKey === key)
    if (existing) return structuredClone(existing)
    const latest = get().snapshots[0]
    const items: SnapshotItem[] = latest
      ? latest.items.map(i => ({ ...i, id: uuidv4(), amount: 0, valueCNY: 0 }))
      : []
    return {
      id: uuidv4(),
      dateKey: key,
      snapshotDate: new Date().toISOString(),
      items,
      note: '',
      totalValueCNY: 0,
    }
  },
}))

// Bootstrap: load data + refresh exchange rate if stale
export async function bootstrapStore() {
  const store = useAssetStore.getState()
  store.loadAll()
  const { exchangeRate } = useAssetStore.getState()
  if (!isFresh(exchangeRate)) {
    await store.refreshExchangeRate(true)
  }
}
