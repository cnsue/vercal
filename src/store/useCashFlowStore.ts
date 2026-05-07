import { create } from 'zustand'
import { StorageService } from './storage'
import type { CashFlowEvent } from '../types/cashFlow'
import { v4 as uuidv4 } from '../utils/uuid'

interface CashFlowState {
  events: CashFlowEvent[]
  load: () => void
  addEvent: (input: Omit<CashFlowEvent, 'id'>) => void
  updateEvent: (id: string, patch: Partial<Omit<CashFlowEvent, 'id'>>) => void
  removeEvent: (id: string) => void
}

export const useCashFlowStore = create<CashFlowState>((set, get) => ({
  events: [],

  load() {
    const raw = StorageService.getCashFlows()
    // 老事件没有 currency / amountCNY，按 CNY 兜底
    const migrated = raw.map(e => ({
      ...e,
      currency: e.currency ?? 'CNY',
      amountCNY: typeof e.amountCNY === 'number' ? e.amountCNY : e.amount,
    }))
    set({ events: migrated })
    // 把迁移后的写回，省得每次都迁
    if (migrated.some((m, i) => m !== raw[i])) {
      StorageService.saveCashFlows(migrated)
    }
  },

  addEvent(input) {
    const event: CashFlowEvent = { ...input, id: uuidv4() }
    const next = [...get().events, event]
    set({ events: next })
    StorageService.saveCashFlows(next)
  },

  updateEvent(id, patch) {
    const next = get().events.map(e => (e.id === id ? { ...e, ...patch } : e))
    set({ events: next })
    StorageService.saveCashFlows(next)
  },

  removeEvent(id) {
    const next = get().events.filter(e => e.id !== id)
    set({ events: next })
    StorageService.saveCashFlows(next)
  },
}))
