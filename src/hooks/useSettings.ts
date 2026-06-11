/**
 * 设置管理 hook — 提取自 App.tsx（D3 阶段）
 *
 * 管理设置更新、provider 配置和模型选择。
 * 使用 Zustand stores 直接访问状态，导航通过 UI store。
 */
import { useCallback, useMemo } from 'react'
import type { AppSettings, NumericSettingKey, ProviderNumericSettingKey } from '../state/types'
import { useSettingsStore } from '../state/settings-store'
import { useUIStore } from '../state/ui-store'
import { clamp } from '../utils/app-formatting'
import {
  ensureValidCurrentModelSelection,
  createProviderConfig,
  createProviderNameCandidate,
  createProviderNumericSettingDrafts,
  resolveProviderRequestSettings,
} from '../utils/app-module'

export interface UseSettingsReturn {
  // Settings state
  settings: AppSettings
  numericSettingDrafts: Record<string, string>
  providerNumericSettingDrafts: Record<string, string>

  // Core operations
  applySettingsUpdate: (updater: (previous: AppSettings) => AppSettings) => void
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  updateDailyCoverSetting: <K extends keyof AppSettings['dailyCover']>(key: K, value: AppSettings['dailyCover'][K]) => void

  // Numeric handlers
  handleNumericSettingChange: (key: NumericSettingKey, rawValue: string, min: number, max: number, integer?: boolean) => void
  finalizeNumericSettingDraft: (key: NumericSettingKey) => void
  handleProviderNumericSettingChange: (key: ProviderNumericSettingKey, rawValue: string) => void
  finalizeProviderNumericSettingDraft: (key: ProviderNumericSettingKey) => void

  // Provider management
  updateProviderById: (providerId: string, updater: (prev: any) => any) => void
  updateProviderField: (providerId: string, field: 'name' | 'apiBaseUrl' | 'apiKey', value: string) => void
  updateProviderPromptOverride: (providerId: string, key: string, value: string) => void
  clearProviderPromptOverride: (providerId: string, key: string) => void
  updateProviderInfoPromptOverride: (providerId: string, key: string, enabled: boolean) => void
  clearProviderInfoPromptOverride: (providerId: string, key: string) => void
  addProvider: () => void
  deleteProvider: (providerId: string) => void
  requestDeleteProvider: (providerId: string) => void

  // Model management
  selectCurrentModel: (providerId: string, modelId: string) => void
  setProviderModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void
  addManualProviderModel: () => void

  // Computed values
  activeProviderRequestSettings: ReturnType<typeof resolveProviderRequestSettings>
  providerDetailTarget: any

  // Navigation state
  settingsView: string
  providerDetailTargetId: string | null
  manualModelDraft: string
  providerModelSearch: string
  filteredProviderModels: any[]
}

export function useSettings(
  pushNotice: (text: string, type?: string) => void,
  openDeleteDialog: (dialog: any) => void,
): UseSettingsReturn {
  // Settings store
  const settings = useSettingsStore((s) => s.settings)
  const numericSettingDrafts = useSettingsStore((s) => s.numericSettingDrafts)
  const setNumericSettingDrafts = useSettingsStore((s) => s.setNumericSettingDrafts)
  const providerNumericSettingDrafts = useSettingsStore((s) => s.providerNumericSettingDrafts)
  const setProviderNumericSettingDrafts = useSettingsStore((s) => s.setProviderNumericSettingDrafts)

  // UI store — navigation
  const settingsView = useUIStore((s) => s.settingsView)
  const providerDetailTargetId = useUIStore((s) => s.providerDetailTargetId)
  const setProviderDetailTargetId = useUIStore((s) => s.setProviderDetailTargetId)
  const manualModelDraft = useUIStore((s) => s.manualModelDraft)
  const setManualModelDraft = useUIStore((s) => s.setManualModelDraft)
  const providerModelSearch = useUIStore((s) => s.providerModelSearch)
  const setProviderModelSearch = useUIStore((s) => s.setProviderModelSearch)

  // Computed
  const activeProviderRequestSettings = useMemo(
    () => resolveProviderRequestSettings(settings),
    [settings],
  )
  const providerDetailTarget = useMemo(
    () => settings.providers.find((p: any) => p.id === providerDetailTargetId) ?? null,
    [providerDetailTargetId, settings.providers],
  )
  const filteredProviderModels = useMemo(() => {
    const provider = providerDetailTarget as any
    if (!provider) return []
    const keyword = providerModelSearch.trim().toLowerCase()
    if (!keyword) return provider.models
    return provider.models.filter((m: any) => m.id.toLowerCase().includes(keyword))
  }, [providerDetailTarget, providerModelSearch])

  // Core operations
  const applySettingsUpdate = useCallback((updater: (prev: AppSettings) => AppSettings): void => {
    useSettingsStore.setState((prev) => ({
      settings: ensureValidCurrentModelSelection(updater(prev.settings)),
    }))
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    applySettingsUpdate((prev) => ({ ...prev, [key]: value }))
  }, [applySettingsUpdate])

  const updateDailyCoverSetting = useCallback(
    <K extends keyof AppSettings['dailyCover']>(key: K, value: AppSettings['dailyCover'][K]): void => {
      applySettingsUpdate((prev) => ({
        ...prev,
        dailyCover: { ...prev.dailyCover, [key]: value },
      }))
    },
    [applySettingsUpdate],
  )

  // Numeric handlers
  const handleNumericSettingChange = useCallback((
    key: NumericSettingKey, rawValue: string, min: number, max: number, integer?: boolean,
  ): void => {
    const draft = rawValue.trim()
    setNumericSettingDrafts((prev) => ({ ...prev, [key]: draft }))
    if (draft.length > 0 && draft !== '-') {
      const parsed = integer ? parseInt(draft, 10) : parseFloat(draft)
      if (!Number.isNaN(parsed)) {
        applySettingsUpdate((prev) => ({ ...prev, [key]: clamp(parsed, min, max) }))
      }
    }
  }, [applySettingsUpdate])

  const finalizeNumericSettingDraft = useCallback((key: NumericSettingKey): void => {
    setNumericSettingDrafts((prev) => ({ ...prev, [key]: undefined as any }))
  }, [])

  const handleProviderNumericSettingChange = useCallback((
    key: ProviderNumericSettingKey, rawValue: string,
  ): void => {
    setProviderNumericSettingDrafts((prev) => ({ ...prev, [key]: rawValue }))
  }, [])

  const finalizeProviderNumericSettingDraft = useCallback((key: ProviderNumericSettingKey): void => {
    setProviderNumericSettingDrafts((prev) => ({ ...prev, [key]: undefined as any }))
  }, [])

  // Provider management
  const updateProviderById = useCallback(
    (providerId: string, updater: (prev: any) => any): void => {
      applySettingsUpdate((prev) => ({
        ...prev,
        providers: prev.providers.map((p) =>
          p.id === providerId ? ensureValidCurrentModelSelection(updater(p) as any) as any : p,
        ),
      }))
    },
    [applySettingsUpdate],
  )

  const updateProviderField = useCallback(
    (providerId: string, field: 'name' | 'apiBaseUrl' | 'apiKey', value: string): void => {
      updateProviderById(providerId, (p: any) => ({ ...p, [field]: value }))
    },
    [updateProviderById],
  )

  const updateProviderPromptOverride = useCallback(
    (providerId: string, key: string, value: string): void => {
      updateProviderById(providerId, (p: any) => ({
        ...p,
        promptOverrides: { ...p.promptOverrides, [key]: value || undefined },
      }))
    },
    [updateProviderById],
  )

  const clearProviderPromptOverride = useCallback(
    (providerId: string, key: string): void => {
      updateProviderById(providerId, (p: any) => {
        const overrides = { ...p.promptOverrides }
        delete overrides[key]
        return { ...p, promptOverrides: overrides }
      })
    },
    [updateProviderById],
  )

  const updateProviderInfoPromptOverride = useCallback(
    (providerId: string, key: string, enabled: boolean): void => {
      updateProviderById(providerId, (p: any) => ({
        ...p,
        infoPromptOverrides: { ...p.infoPromptOverrides, [key]: enabled || undefined },
      }))
    },
    [updateProviderById],
  )

  const clearProviderInfoPromptOverride = useCallback(
    (providerId: string, key: string): void => {
      updateProviderById(providerId, (p: any) => {
        const overrides = { ...p.infoPromptOverrides }
        delete overrides[key]
        return { ...p, infoPromptOverrides: overrides }
      })
    },
    [updateProviderById],
  )

  const addProvider = useCallback((): void => {
    const provider = createProviderConfig(createProviderNameCandidate(useSettingsStore.getState().settings.providers as any))
    setManualModelDraft('')
    setProviderModelSearch('')
    setProviderNumericSettingDrafts(createProviderNumericSettingDrafts(provider as any) as any)
    useUIStore.getState().setOpenProviderPromptEditors({
      systemPrompt: false, topLevelTagSystemPrompt: false, generalTagSystemPrompt: false,
      readSystemPrompt: false, skillCallSystemPrompt: false, editSystemPrompt: false,
    } as any)
    applySettingsUpdate((prev) => ({
      ...prev,
      providers: [...prev.providers, provider as any],
      currentProviderId: (provider as any).id,
    }))
  }, [applySettingsUpdate])

  const deleteProvider = useCallback(
    (providerId: string): void => {
      const label = settings.providers.find((p) => p.id === providerId)?.name ?? providerId
      applySettingsUpdate((prev) => ({
        ...prev,
        providers: prev.providers.filter((p) => p.id !== providerId),
      }))
      if (providerDetailTargetId === providerId) {
        setProviderDetailTargetId(null)
        useUIStore.getState().navigateSettingsView('providers')
      }
      pushNotice(`已删除服务商：${label}`, 'success')
    },
    [applySettingsUpdate, providerDetailTargetId, pushNotice, settings.providers],
  )

  const requestDeleteProvider = useCallback(
    (providerId: string): void => {
      openDeleteDialog({ type: 'provider', targetId: providerId })
    },
    [openDeleteDialog],
  )

  // Model management
  const selectCurrentModel = useCallback(
    (providerId: string, modelId: string): void => {
      applySettingsUpdate((prev) => {
        // ActiNet virtual provider handling
        if (providerId === 'actinet') {
          const model = (prev as any).actiNetModels?.find((m: any) => m.id === modelId)
          if (!model) return prev
          return { ...prev, currentProviderId: providerId, currentModel: modelId }
        }
        const provider = prev.providers.find((p) => p.id === providerId)
        if (!provider || !provider.models.some((m) => m.id === modelId && m.enabled)) return prev
        return { ...prev, currentProviderId: providerId, currentModel: modelId }
      })
    },
    [applySettingsUpdate],
  )

  const setProviderModelEnabled = useCallback(
    (providerId: string, modelId: string, enabled: boolean): void => {
      updateProviderById(providerId, (p: any) => ({
        ...p,
        models: p.models.map((m: any) => (m.id === modelId ? { ...m, enabled } : m)),
      }))
    },
    [updateProviderById],
  )

  const addManualProviderModel = useCallback((): void => {
    const trimmed = manualModelDraft.trim()
    if (!trimmed || !providerDetailTargetId) return
    updateProviderById(providerDetailTargetId, (prev: any) => ({
      ...prev,
      models: prev.models.some((m: any) => m.id === trimmed)
        ? prev.models
        : [...prev.models, { id: trimmed, enabled: true }],
    }))
    setManualModelDraft('')
  }, [manualModelDraft, providerDetailTargetId, updateProviderById])

  return {
    settings,
    numericSettingDrafts,
    providerNumericSettingDrafts,
    applySettingsUpdate,
    updateSetting,
    updateDailyCoverSetting,
    handleNumericSettingChange,
    finalizeNumericSettingDraft,
    handleProviderNumericSettingChange,
    finalizeProviderNumericSettingDraft,
    updateProviderById,
    updateProviderField,
    updateProviderPromptOverride,
    clearProviderPromptOverride,
    updateProviderInfoPromptOverride,
    clearProviderInfoPromptOverride,
    addProvider,
    deleteProvider,
    requestDeleteProvider,
    selectCurrentModel,
    setProviderModelEnabled,
    addManualProviderModel,
    activeProviderRequestSettings,
    providerDetailTarget,
    settingsView,
    providerDetailTargetId,
    manualModelDraft,
    providerModelSearch,
    filteredProviderModels,
  }
}
