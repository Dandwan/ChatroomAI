/**
 * 设置管理 hook — 提取自 App.tsx（D3 阶段）
 *
 * 管理设置更新、provider 配置和模型选择。
 * 使用 Zustand stores 直接访问状态，导航通过 UI store。
 */
import { useCallback, useMemo } from 'react'
import type { AppSettings, GlobalPromptSettingKey, NumericSettingKey, ProviderNumericSettingKey } from '../state/types'
import { useSettingsStore } from '../state/settings-store'
import { useExtensionsStore } from '../state/extensions-store'
import { useUIStore } from '../state/ui-store'
import { clamp, isRecord } from '../utils/app-formatting'
import { createProviderModelKey } from '../utils/model-utils'
import { buildApiUrl, authHeaders, readErrorMessage } from '../services/chat-api'
import {
  ensureValidCurrentModelSelection,
  createProviderConfig,
  createProviderNameCandidate,
  createProviderNumericSettingDrafts,
  resolveProviderRequestSettings,
  PROMPT_DEFAULTS,
  ACTINET_PROVIDER_ID,
} from '../utils/app-module'
import { getEffectiveActiNetModels } from '../services/actinet-models'

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
  resetProviderDetailState: () => void

  // Model management
  selectCurrentModel: (providerId: string, modelId: string) => void
  setProviderModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void
  addManualProviderModel: () => void

  // Provider model operations
  fetchProviderModels: (providerId: string) => Promise<void>
  testProviderModel: (providerId: string, modelId: string) => Promise<void>

  // Prompt operations
  resetPromptToDefault: (key: GlobalPromptSettingKey) => void

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
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void,
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
  const setIsFetchingModelsByProviderId = useUIStore((s) => s.setIsFetchingModelsByProviderId)

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
      // Clean up modelHealth entries for deleted provider
      const setModelHealth = useExtensionsStore.getState().setModelHealth
      setModelHealth((previous) => {
        const next: Record<string, any> = {}
        const prefix = `${providerId}::`
        for (const key of Object.keys(previous)) {
          if (!key.startsWith(prefix)) next[key] = previous[key]
        }
        return next
      })
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
        if (providerId === ACTINET_PROVIDER_ID) {
          const effective = getEffectiveActiNetModels()
          const model = effective.find((m) => m.id === modelId && m.enabled)
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

  const resetProviderDetailState = useCallback((): void => {
    setProviderDetailTargetId(null)
    setManualModelDraft('')
    setProviderModelSearch('')
    setIsFetchingModelsByProviderId({})
  }, [setProviderDetailTargetId, setManualModelDraft, setProviderModelSearch, setIsFetchingModelsByProviderId])

  // ── Prompt operations ──
  const resetPromptToDefault = useCallback((key: GlobalPromptSettingKey): void => {
    updateSetting(key, PROMPT_DEFAULTS[key] as AppSettings[typeof key])
    pushNotice('已重置为默认提示词。', 'success')
  }, [updateSetting, pushNotice])

  // ── Provider model operations ──
  const fetchProviderModels = useCallback(async (providerId: string): Promise<void> => {
    const provider = useSettingsStore.getState().settings.providers.find((item) => item.id === providerId)
    if (!provider) return
    if (!provider.apiBaseUrl.trim() || !provider.apiKey.trim()) {
      pushNotice('请先填写该服务商的 URL 和 API Key。', 'error')
      return
    }

    setIsFetchingModelsByProviderId((previous) => ({ ...previous, [providerId]: true }))
    try {
      const response = await fetch(buildApiUrl(provider.apiBaseUrl, '/models'), {
        headers: authHeaders(provider.apiKey),
      })
      if (!response.ok) throw new Error(await readErrorMessage(response))
      const payload = (await response.json()) as unknown
      const modelData = isRecord(payload) && Array.isArray(payload.data) ? payload.data : []
      const incoming = modelData
        .map((item) => (isRecord(item) && typeof item.id === 'string' ? item.id.trim() : ''))
        .filter((id) => id.length > 0)

      if (incoming.length === 0) {
        pushNotice('接口返回了空模型列表。', 'info')
        return
      }

      updateProviderById(providerId, (currentProvider) => {
        const existing = new Map(currentProvider.models.map((model: any) => [model.id, model]))
        for (const modelId of incoming) {
          if (!existing.has(modelId)) existing.set(modelId, { id: modelId, enabled: false })
        }
        return { ...currentProvider, models: Array.from(existing.values()) }
      })

      const setModelHealth = useExtensionsStore.getState().setModelHealth
      setModelHealth((previous) => {
        const updated = { ...previous }
        for (const modelId of incoming) {
          const key = createProviderModelKey(providerId, modelId)
          if (!updated[key]) updated[key] = 'untested'
        }
        return updated
      })

      pushNotice(`已为 ${provider.name || '当前服务商'} 加载 ${incoming.length} 个模型。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '模型加载失败'
      pushNotice(`模型加载失败：${message}`, 'error')
    } finally {
      setIsFetchingModelsByProviderId((previous) => ({ ...previous, [providerId]: false }))
    }
  }, [pushNotice, setIsFetchingModelsByProviderId, updateProviderById])

  const testProviderModel = useCallback(async (providerId: string, modelId: string): Promise<void> => {
    const provider = useSettingsStore.getState().settings.providers.find((item) => item.id === providerId)
    if (!provider) return
    if (!provider.apiBaseUrl.trim() || !provider.apiKey.trim()) {
      pushNotice('请先填写该服务商的 URL 和 API Key。', 'error')
      return
    }

    const healthKey = createProviderModelKey(providerId, modelId)
    const setModelHealth = useExtensionsStore.getState().setModelHealth
    setModelHealth((previous) => ({ ...previous, [healthKey]: 'testing' as const }))
    try {
      const response = await fetch(buildApiUrl(provider.apiBaseUrl, '/chat/completions'), {
        method: 'POST',
        headers: authHeaders(provider.apiKey),
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 4,
          temperature: 0,
          stream: false,
        }),
      })
      if (!response.ok) throw new Error(await readErrorMessage(response))
      setModelHealth((previous) => ({ ...previous, [healthKey]: 'ok' as const }))
      pushNotice(`模型 ${modelId} 检测成功。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '检测失败'
      setModelHealth((previous) => ({ ...previous, [healthKey]: 'error' as const }))
      pushNotice(`模型 ${modelId} 检测失败：${message}`, 'error')
    }
  }, [pushNotice])

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
    resetProviderDetailState,
    requestDeleteProvider,
    selectCurrentModel,
    setProviderModelEnabled,
    addManualProviderModel,
    fetchProviderModels,
    testProviderModel,
    resetPromptToDefault,
    activeProviderRequestSettings,
    providerDetailTarget,
    settingsView,
    providerDetailTargetId,
    manualModelDraft,
    providerModelSearch,
    filteredProviderModels,
  }
}
