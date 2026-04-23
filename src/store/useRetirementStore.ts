import { create } from 'zustand'
import { StorageService } from './storage'
import type {
  RetirementPlan, DividendHolding, PensionConfig,
  DecentStandard, OtherIncome,
} from '../types/retirement'
import { DEFAULT_RETIREMENT_PLAN } from '../types/retirement'
import { v4 as uuidv4 } from '../utils/uuid'

interface RetirementState {
  plan: RetirementPlan
  loaded: boolean

  load: () => void
  setDecentStandard: (v: DecentStandard) => void
  setPension: (v: Partial<PensionConfig>) => void
  addHolding: (h: Omit<DividendHolding, 'id'>) => void
  updateHolding: (id: string, patch: Partial<DividendHolding>) => void
  removeHolding: (id: string) => void
  addOtherIncome: (o: Omit<OtherIncome, 'id'>) => void
  updateOtherIncome: (id: string, patch: Partial<OtherIncome>) => void
  removeOtherIncome: (id: string) => void
}

function persist(plan: RetirementPlan): RetirementPlan {
  StorageService.saveRetirementPlan(plan)
  return plan
}

export const useRetirementStore = create<RetirementState>((set, get) => ({
  plan: DEFAULT_RETIREMENT_PLAN,
  loaded: false,

  load() {
    set({ plan: StorageService.getRetirementPlan(), loaded: true })
  },

  setDecentStandard(v) {
    set({ plan: persist({ ...get().plan, decentStandard: v }) })
  },

  setPension(v) {
    const plan = get().plan
    set({ plan: persist({ ...plan, pension: { ...plan.pension, ...v } }) })
  },

  addHolding(h) {
    const plan = get().plan
    const next: DividendHolding = { ...h, id: uuidv4() }
    set({ plan: persist({ ...plan, holdings: [...plan.holdings, next] }) })
  },

  updateHolding(id, patch) {
    const plan = get().plan
    set({
      plan: persist({
        ...plan,
        holdings: plan.holdings.map(h => (h.id === id ? { ...h, ...patch } : h)),
      }),
    })
  },

  removeHolding(id) {
    const plan = get().plan
    set({ plan: persist({ ...plan, holdings: plan.holdings.filter(h => h.id !== id) }) })
  },

  addOtherIncome(o) {
    const plan = get().plan
    const next: OtherIncome = { ...o, id: uuidv4() }
    set({ plan: persist({ ...plan, otherIncomes: [...plan.otherIncomes, next] }) })
  },

  updateOtherIncome(id, patch) {
    const plan = get().plan
    set({
      plan: persist({
        ...plan,
        otherIncomes: plan.otherIncomes.map(o => (o.id === id ? { ...o, ...patch } : o)),
      }),
    })
  },

  removeOtherIncome(id) {
    const plan = get().plan
    set({ plan: persist({ ...plan, otherIncomes: plan.otherIncomes.filter(o => o.id !== id) }) })
  },
}))
