import { create } from 'zustand'
import type {
  AppSettings,
  NumericSettingDrafts,
  NumericSettingKey,
  ProviderNumericSettingDrafts,
  ProviderNumericSettingKey,
  ThemeMode,
} from './types'

interface SettingsStore {
  // State
  settings: AppSettings
  numericSettingDrafts: NumericSettingDrafts
  providerNumericSettingDrafts: ProviderNumericSettingDrafts

  // Actions
  setSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void
  patchSettings: (patch: Partial<AppSettings>) => void
  setNumericSettingDraft: (key: NumericSettingKey, draft: string) => void
  setNumericSettingDrafts: (drafts: NumericSettingDrafts | ((prev: NumericSettingDrafts) => NumericSettingDrafts)) => void
  setProviderNumericSettingDrafts: (drafts: ProviderNumericSettingDrafts | ((prev: ProviderNumericSettingDrafts) => ProviderNumericSettingDrafts)) => void
  setProviderNumericSettingDraft: (key: ProviderNumericSettingKey, draft: string) => void
  setThemeMode: (mode: ThemeMode) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {} as AppSettings,
  numericSettingDrafts: {} as NumericSettingDrafts,
  providerNumericSettingDrafts: {} as ProviderNumericSettingDrafts,

  setSettings: (settings) =>
    set((state) => ({
      settings: typeof settings === 'function' ? settings(state.settings) : settings,
    })),
  patchSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
    })),
  setNumericSettingDraft: (key, draft) =>
    set((state) => ({
      numericSettingDrafts: {
        ...state.numericSettingDrafts,
        [key]: draft,
      },
    })),
  setNumericSettingDrafts: (drafts) =>
    set((state) => ({
      numericSettingDrafts: typeof drafts === 'function' ? drafts(state.numericSettingDrafts) : drafts,
    })),
  setProviderNumericSettingDrafts: (drafts) =>
    set((state) => ({
      providerNumericSettingDrafts: typeof drafts === 'function' ? drafts(state.providerNumericSettingDrafts) : drafts,
    })),
  setProviderNumericSettingDraft: (key, draft) =>
    set((state) => ({
      providerNumericSettingDrafts: {
        ...state.providerNumericSettingDrafts,
        [key]: draft,
      },
    })),
  setThemeMode: (mode) =>
    set((state) => ({
      settings: { ...state.settings, themeMode: mode },
    })),
}))
