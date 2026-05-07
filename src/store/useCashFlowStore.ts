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
    set({ events: StorageService.getCashFlows() })
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
