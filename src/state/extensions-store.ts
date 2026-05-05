import { create } from 'zustand'
import type { SkillRecord, RuntimeRecord } from '../services/skills/types'
import type { JsonObjectValue, ModelHealth } from './types'

interface ExtensionsStore {
  // ── Skills ──
  skillRecords: SkillRecord[]
  isLoadingExtensions: boolean
  isInstallingSkillArchive: boolean

  // ── Skill config editor ──
  skillConfigTargetId: string | null
  skillConfigDraft: string
  skillConfigValue: JsonObjectValue
  skillConfigRawError: string | null
  isLoadingSkillConfig: boolean
  isSavingSkillConfig: boolean

  // ── Runtimes ──
  runtimeRecords: RuntimeRecord[]
  isInstallingRuntimeArchive: boolean

  // ── Model health ──
  modelHealth: Record<string, ModelHealth>

  // ── Actions ──
  setSkillRecords: (records: SkillRecord[] | ((prev: SkillRecord[]) => SkillRecord[])) => void
  setIsLoadingExtensions: (loading: boolean) => void
  setIsInstallingSkillArchive: (installing: boolean) => void
  setSkillConfigTargetId: (id: string | null) => void
  setSkillConfigDraft: (draft: string) => void
  setSkillConfigValue: (value: JsonObjectValue) => void
  setSkillConfigRawError: (error: string | null) => void
  setIsLoadingSkillConfig: (loading: boolean) => void
  setIsSavingSkillConfig: (saving: boolean) => void
  setRuntimeRecords: (records: RuntimeRecord[] | ((prev: RuntimeRecord[]) => RuntimeRecord[])) => void
  setIsInstallingRuntimeArchive: (installing: boolean) => void
  setModelHealth: (key: string | ((prev: Record<string, ModelHealth>) => Record<string, ModelHealth>), health?: ModelHealth) => void
  resetModelHealth: () => void
}

export const useExtensionsStore = create<ExtensionsStore>((set) => ({
  // ── Skills ──
  skillRecords: [],
  isLoadingExtensions: true,
  isInstallingSkillArchive: false,

  // ── Skill config editor ──
  skillConfigTargetId: null,
  skillConfigDraft: '',
  skillConfigValue: {},
  skillConfigRawError: null,
  isLoadingSkillConfig: false,
  isSavingSkillConfig: false,

  // ── Runtimes ──
  runtimeRecords: [],
  isInstallingRuntimeArchive: false,

  // ── Model health ──
  modelHealth: {},

  // ── Actions ──
  setSkillRecords: (records) =>
    set((state) => ({
      skillRecords: typeof records === 'function' ? records(state.skillRecords) : records,
    })),
  setIsLoadingExtensions: (loading) => set({ isLoadingExtensions: loading }),
  setIsInstallingSkillArchive: (installing) => set({ isInstallingSkillArchive: installing }),

  setSkillConfigTargetId: (id) => set({ skillConfigTargetId: id }),
  setSkillConfigDraft: (draft) => set({ skillConfigDraft: draft }),
  setSkillConfigValue: (value) => set({ skillConfigValue: value }),
  setSkillConfigRawError: (error) => set({ skillConfigRawError: error }),
  setIsLoadingSkillConfig: (loading) => set({ isLoadingSkillConfig: loading }),
  setIsSavingSkillConfig: (saving) => set({ isSavingSkillConfig: saving }),

  setRuntimeRecords: (records) =>
    set((state) => ({
      runtimeRecords: typeof records === 'function' ? records(state.runtimeRecords) : records,
    })),
  setIsInstallingRuntimeArchive: (installing) => set({ isInstallingRuntimeArchive: installing }),

  setModelHealth: (key, health?: ModelHealth) =>
    set((state) => ({
      modelHealth: typeof key === 'function' ? key(state.modelHealth) : { ...state.modelHealth, [key]: health as ModelHealth },
    })),
  resetModelHealth: () => set({ modelHealth: {} }),
}))
