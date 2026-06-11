/**
 * SettingsPage — 设置页面主渲染组件
 *
 * 从 App.tsx 提取了 16 个 renderSettings* 函数（约 1,280 行）。
 * 通过 Zustand stores 直接访问全局状态，通过 props 接收 hook 衍生的操作函数。
 */

import {
  useCallback,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react'
import {
  INFO_PROMPT_DEFINITIONS,
  type InfoPromptDefinition,
} from '../services/skills/info-system-prompts'
import { isNativeRuntimeAvailable } from '../services/skills/native-runtime'
import ChatInputBox from '../components/ChatInputBox'
import SettingsSectionHeading from '../components/SettingsSectionHeading'
import SettingsInfoPromptToggleCard from '../components/SettingsInfoPromptToggleCard'
import PermissionsSettings from '../components/settings/PermissionsSettings'
import ProvidersSettings from '../components/settings/ProvidersSettings'
import AccountsSettings from '../components/settings/AccountsSettings'
import ActiNetSettings from '../components/settings/ActiNetSettings'
import RuntimeSettings from '../components/settings/RuntimeSettings'
import SkillsSettings from '../components/settings/SkillsSettings'
import SkillConfigSettings from '../components/settings/SkillConfigSettings'
import DailyCoverSettingsComponent from '../components/settings/DailyCoverSettings'
import PromptEditorPanel from '../components/PromptEditorPanel'
import SettingsScreen from '../components/SettingsScreen'
import SettingsPopoverSelect from '../components/SettingsPopoverSelect'
import { getStoredCloudAuth, clearCloudAuth } from '../services/cloud-auth'
import { createProviderModelKey, modelHealthLabel } from '../utils/model-utils'
import type {
  AppSettings,
  GlobalPromptSettingKey,
  NumericSettingKey,
  PromptEditorKey,
  ProviderNumericSettingKey,
  SettingsView,
  TagPromptEditorKey,
} from '../state/types'
import {
  PERMISSION_LABELS,
  THEME_MODE_OPTIONS,
  type AppPermissionKey,
} from '../state/types'
import type { DailyCoverSettings } from '../services/daily-cover'
import { useUIStore } from '../state/ui-store'
import { useExtensionsStore } from '../state/extensions-store'
import { useSettingsStore } from '../state/settings-store'
import {
  DEFAULT_SETTINGS,
  getEnabledModelOptions,
  PROMPT_DEFAULTS,
  MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS,
} from '../utils/app-module'
import type { ResolvedDailyCover } from '../services/daily-cover'

// ─── Types ───────────────────────────────────────────

export interface SettingsPageNavigation {
  navigateSettingsView: (view: SettingsView) => void
  handleSettingsBack: () => void
  closeSettingsPanel: () => void
  openProviderDetail: (providerId: string) => void
}

export interface SettingsPageProps {
  /** 已解析的每日封面 */
  resolvedDailyCover: ResolvedDailyCover | null

  /** ActiNet 登录状态 */
  cloudLoggedIn: boolean

  /** 设置云认证模式（用于 onCloudLogin 回调） */
  setCloudAuthMode: (mode: 'none' | 'login' | 'register') => void

  /** 导航操作（依赖 App 本地 ref） */
  navigation: SettingsPageNavigation

  /** 来自 useSettings hook 的操作函数 */
  updateSetting: { <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void }
  updateDailyCoverSetting: { <K extends keyof DailyCoverSettings>(key: K, value: DailyCoverSettings[K]): void }
  resetPromptToDefault: (key: GlobalPromptSettingKey) => void
  handleNumericSettingChange: (key: NumericSettingKey, rawValue: string, min: number, max: number, integerOnly?: boolean) => void
  finalizeNumericSettingDraft: (key: NumericSettingKey) => void
  handleProviderNumericSettingChange: (key: ProviderNumericSettingKey, rawValue: string) => void
  finalizeProviderNumericSettingDraft: (key: ProviderNumericSettingKey) => void
  addProvider: () => void
  deleteProvider: (providerId: string) => void
  requestDeleteProvider: (providerId: string) => void
  updateProviderField: (providerId: string, field: "name" | "apiKey" | "apiBaseUrl", value: string) => void
  setProviderModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void
  addManualProviderModel: () => void
  selectCurrentModel: (providerId: string, modelId: string) => void
  resetProviderDetailState: () => void
  fetchProviderModels: (providerId: string) => Promise<void>
  testProviderModel: (providerId: string, modelId: string) => Promise<void>
  updateProviderPromptOverride: (providerId: string, key: string, value: string) => void
  clearProviderPromptOverride: (providerId: string, key: string) => void
  updateProviderInfoPromptOverride: (providerId: string, key: string, enabled: boolean) => void
  clearProviderInfoPromptOverride: (providerId: string, key: string) => void
  updateProviderById: (providerId: string, update: (prev: { name: string }) => { name: string }) => void

  /** 来自 useExtensions hook 的数据 */
  skillRecords: ReturnType<typeof useExtensionsStore.getState>['skillRecords']
  runtimeRecords: ReturnType<typeof useExtensionsStore.getState>['runtimeRecords']
  isLoadingExtensions: boolean
  isInstallingSkillArchive: boolean
  isInstallingRuntimeArchive: boolean
  skillConfigTargetId: string | null
  skillConfigDraft: string
  skillConfigValue: import('../state/types').JsonObjectValue
  skillConfigRawError: string | null
  isLoadingSkillConfig: boolean
  isSavingSkillConfig: boolean
  skillConfigTarget: ReturnType<typeof useExtensionsStore.getState>['skillRecords'][number] | null

  /** 来自 useExtensions hook 的操作 */
  handleSkillArchiveSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleRuntimeArchiveSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleSetSkillEnabled: (skillId: string, enabled: boolean) => void
  handleSetRuntimeEnabled: (runtimeId: string, enabled: boolean) => void
  handleSetDefaultRuntime: (runtimeId: string) => void
  handleTestRuntime: (runtimeId: string) => void
  handleSkillConfigDraftChange: (value: string) => void
  applySkillConfigValue: (value: import("../state/types").JsonObjectValue) => void
  formatSkillConfigDraft: () => void
  openSkillConfigEditor: (skillId: string) => Promise<void>
  saveSkillConfig: () => Promise<void>
  requestDeleteSkill: (skillId: string) => void
  requestDeleteRuntime: (runtimeId: string) => void
  refreshExtensions: (force?: boolean) => Promise<void>

  /** 权限操作 */
  requestingPermissionByKey: Record<string, boolean>
  handlePermissionToggle: (key: AppPermissionKey, enabled: boolean) => Promise<void>

  /** 更新检查 */
  handleManualUpdateCheck: () => Promise<void>

  /** 通知 */
  pushNotice: (message: string, level?: 'info' | 'error') => void

  /** Refs */
  skillArchiveInputRef: React.RefObject<HTMLInputElement | null>
  runtimeArchiveInputRef: React.RefObject<HTMLInputElement | null>
  settingsPageRef: React.RefObject<HTMLElement | null>
  onSettingsScroll: (event: UIEvent<HTMLElement>) => void
}

// ─── Component ───────────────────────────────────────

export function SettingsPage(props: SettingsPageProps) {
  const {
    resolvedDailyCover,
    cloudLoggedIn,
    setCloudAuthMode,
    navigation,
    updateSetting,
    updateDailyCoverSetting,
    resetPromptToDefault,
    handleNumericSettingChange,
    finalizeNumericSettingDraft,
    handleProviderNumericSettingChange,
    finalizeProviderNumericSettingDraft,
    addProvider,
    requestDeleteProvider,
    updateProviderField,
    setProviderModelEnabled,
    addManualProviderModel,
    selectCurrentModel,
    fetchProviderModels,
    testProviderModel,
    updateProviderPromptOverride,
    clearProviderPromptOverride,
    updateProviderInfoPromptOverride,
    clearProviderInfoPromptOverride,
    skillRecords,
    runtimeRecords,
    isLoadingExtensions,
    isInstallingSkillArchive,
    isInstallingRuntimeArchive,
    skillConfigDraft,
    skillConfigValue,
    skillConfigRawError,
    isLoadingSkillConfig,
    isSavingSkillConfig,
    skillConfigTarget,
    handleSetSkillEnabled,
    handleSetRuntimeEnabled,
    handleSetDefaultRuntime,
    handleTestRuntime,
    handleSkillConfigDraftChange,
    applySkillConfigValue,
    formatSkillConfigDraft,
    openSkillConfigEditor,
    saveSkillConfig,
    requestDeleteSkill,
    requestDeleteRuntime,
    refreshExtensions,
    requestingPermissionByKey,
    handlePermissionToggle,
    handleManualUpdateCheck,
    pushNotice,
    skillArchiveInputRef,
    runtimeArchiveInputRef,
    settingsPageRef,
    onSettingsScroll,
  } = props

  // ── Store state ──────────────────────────────────────
  const settings = useSettingsStore((s) => s.settings)
  const numericSettingDrafts = useSettingsStore((s) => s.numericSettingDrafts)
  const providerNumericSettingDrafts = useSettingsStore((s) => s.providerNumericSettingDrafts)

  const settingsView = useUIStore((s) => s.settingsView)
  const providerDetailTargetId = useUIStore((s) => s.providerDetailTargetId)
  const openPromptEditors = useUIStore((s) => s.openPromptEditors)
  const openProviderPromptEditors = useUIStore((s) => s.openProviderPromptEditors)
  const isFetchingModelsByProviderId = useUIStore((s) => s.isFetchingModelsByProviderId)
  const manualModelDraft = useUIStore((s) => s.manualModelDraft)
  const setManualModelDraft = useUIStore((s) => s.setManualModelDraft)
  const providerModelSearch = useUIStore((s) => s.providerModelSearch)
  const setProviderModelSearch = useUIStore((s) => s.setProviderModelSearch)
  const modelHealth = useExtensionsStore((s) => s.modelHealth)

  // ── Derived ─────────────────────────────────────────
  const nativeRuntimeAvailable = isNativeRuntimeAvailable()
  const enabledModelOptions = getEnabledModelOptions(settings.providers, cloudLoggedIn, settings.otherProvidersEnabled)
  const { navigateSettingsView, handleSettingsBack, closeSettingsPanel, openProviderDetail } = navigation

  const providerDetailTarget =
    settings.providers.find((provider) => provider.id === providerDetailTargetId) ?? null

  const filteredProviderModels = (() => {
    const provider = providerDetailTarget
    if (!provider) return []
    const q = providerModelSearch.trim().toLowerCase()
    if (!q) return provider.models
    return provider.models.filter((m) => m.id.toLowerCase().includes(q))
  })()

  const togglePromptEditor = useCallback((key: TagPromptEditorKey): void => {
    useUIStore.getState().togglePromptEditor(key)
  }, [])

  const toggleProviderPromptEditor = useCallback((key: PromptEditorKey): void => {
    useUIStore.getState().toggleProviderPromptEditor(key)
  }, [])

  // ── Render helpers ──────────────────────────────────

  const formatToggleStateLabel = (enabled: boolean): string => (enabled ? '已开启' : '已关闭')

  const renderSettingsSectionHeading = (headingProps: { label: string; title?: string; copy?: ReactNode }) => (
    <SettingsSectionHeading {...headingProps} />
  )

  const renderSettingsMiniSwitch = (enabled: boolean) => (
    <span className={`settings-mini-switch ${enabled ? 'is-on' : ''}`} aria-hidden="true" />
  )

  const renderInfoPromptToggleCard = (cardProps: {
    cardKey: string
    definition: InfoPromptDefinition
    description: string
    statusText?: string
    checked: boolean
    onChange: (enabled: boolean) => void
    actionLabel?: string
    onAction?: () => void
    actionDisabled?: boolean
  }) => <SettingsInfoPromptToggleCard {...cardProps} />

  const renderDailyCoverSettings = () => (
    <DailyCoverSettingsComponent
      resolvedDailyCover={resolvedDailyCover}
      settings={settings.dailyCover}
      onUpdate={(key: keyof DailyCoverSettings, value: string | boolean) =>
        updateDailyCoverSetting(key, value as DailyCoverSettings[typeof key])
      }
    />
  )

  const renderPromptEditorPanel = (panelProps: {
    isOpen: boolean
    onToggle: () => void
    title: string
    value: string
    onChange: (value: string) => void
    placeholder: string
    helperText?: string
    actionLabel?: string
    onAction?: () => void
    actionDisabled?: boolean
  }): ReactNode => <PromptEditorPanel {...panelProps} />

  // ── Settings view renderers ─────────────────────────

  const renderMainSettings = () => {
    const currentProvider =
      settings.providers.find((provider) => provider.id === settings.currentProviderId) ?? null
    const enabledSkillCount = skillRecords.filter((skill) => skill.enabled).length
    const enabledRuntimeCount = runtimeRecords.filter((runtime) => runtime.enabled).length
    const defaultRuntime =
      runtimeRecords.find((runtime) => runtime.isDefault) ??
      runtimeRecords.find((runtime) => runtime.type === 'node' || runtime.type === 'python') ??
      null
    const permissionPreviewKeys = (Object.keys(PERMISSION_LABELS) as AppPermissionKey[]).slice(0, 3)

    return (
      <>
        <section className="settings-section settings-section-emphasis">
          <button
            type="button"
            className="settings-entry-button settings-summary-button settings-hero-card"
            onClick={() => navigateSettingsView('daily-cover')}
          >
            {resolvedDailyCover ? <img src={resolvedDailyCover.imageUrl} alt={resolvedDailyCover.title} /> : null}
            <div className="settings-hero-content">
              <div className="settings-hero-kicker">Today&apos;s cover</div>
              <div className="settings-hero-title">{resolvedDailyCover?.title ?? 'Daily Cover'}</div>
              <div className="settings-hero-copy">
                {`TODAY'S COVER · ${(resolvedDailyCover?.sourceLabel ?? 'Default pool').toUpperCase()}`}
              </div>
            </div>
          </button>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Account',
            title: '账号管理',
          })}

          <div className="settings-entry-list settings-entry-list-tight">
            <button
              type="button"
              className="settings-entry-button settings-summary-button"
              onClick={() => navigateSettingsView('accounts')}
            >
              <div className="settings-summary-list">
                <div className="settings-summary-row">
                  <span className="settings-summary-row-label">ActiNet</span>
                  <span className="settings-summary-row-value">
                    {cloudLoggedIn ? '已连接' : '未登录'}
                  </span>
                </div>
                <div className="settings-summary-row">
                  <span className="settings-summary-row-label">Current model</span>
                  <span className="settings-summary-row-value">
                    {settings.currentModel
                      ? `${settings.currentModel}${currentProvider?.name?.trim() ? ` · ${currentProvider.name.trim()}` : ''}`
                      : '尚未选择'}
                  </span>
                </div>
              </div>
              <span className="settings-entry-meta">
                {settings.otherProvidersEnabled
                  ? settings.providers.length === 0
                    ? '暂无服务商，请先添加。'
                    : `已配置 ${settings.providers.length} 个服务商，已启用 ${enabledModelOptions.length} 个模型。`
                  : cloudLoggedIn
                    ? 'ActiNet 已连接'
                    : '管理 ActiNet 云服务与其它服务商'}
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Daily cover',
            title: '首页每日风景封面',
          })}

          <div className="settings-entry-list settings-entry-list-tight">
            <button
              type="button"
              className="settings-entry-button settings-summary-button"
              onClick={() => navigateSettingsView('daily-cover')}
            >
              <div className="settings-summary-list">
                <div className="settings-summary-row">
                  <span className="settings-summary-row-label">显示位置</span>
                  <span className="settings-summary-row-value">
                    {settings.dailyCover.enabled ? '新对话空白态' : '已关闭'}
                  </span>
                </div>
                <div className="settings-summary-row">
                  <span className="settings-summary-row-label">进入消息流后</span>
                  <span className="settings-summary-row-value">
                    {settings.dailyCover.enabled ? '整页上滑退场' : '不适用'}
                  </span>
                </div>
                <div className="settings-summary-row">
                  <span className="settings-summary-row-label">失败回退</span>
                  <span className="settings-summary-row-value">
                    {settings.dailyCover.useApi ? '默认本地图池' : '仅使用默认图池'}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Extensions',
            title: 'Skills 与运行时',
          })}

          <div className="settings-static-card settings-summary-card">
            <div className="settings-summary-list">
              <div className="settings-summary-row">
                <span className="settings-summary-row-label">Installed skills</span>
                <span className="settings-summary-row-value">
                  {isLoadingExtensions ? '加载中' : String(skillRecords.length)}
                </span>
              </div>
              <div className="settings-summary-row">
                <span className="settings-summary-row-label">Runtimes</span>
                <span className="settings-summary-row-value">
                  {isLoadingExtensions
                    ? '加载中'
                    : runtimeRecords.length === 0
                      ? '尚未安装'
                      : `已发现 ${runtimeRecords.length} 个，启用 ${enabledRuntimeCount} 个`}
                </span>
              </div>
              <div className="settings-summary-row">
                <span className="settings-summary-row-label">Default runtime</span>
                <span className="settings-summary-row-value">
                  {defaultRuntime?.displayName || defaultRuntime?.id || '尚未设置'}
                </span>
              </div>
            </div>
          </div>

          <div className="settings-entry-list">
            <button
              type="button"
              className="settings-entry-button"
              onClick={() => navigateSettingsView('skills')}
            >
              <span className="settings-entry-title">Skills 管理</span>
              <span className="settings-entry-meta">
                {isLoadingExtensions ? '加载中...' : `已发现 ${skillRecords.length} 个 skill，启用 ${enabledSkillCount} 个`}
              </span>
            </button>

            <button
              type="button"
              className="settings-entry-button"
              onClick={() => navigateSettingsView('runtimes')}
            >
              <span className="settings-entry-title">运行时设置</span>
              <span className="settings-entry-meta">
                {isLoadingExtensions
                  ? '加载中...'
                  : nativeRuntimeAvailable
                    ? `已发现 ${runtimeRecords.length} 个运行时`
                    : '当前平台不支持直接执行外部运行时'}
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Permissions',
            title: '权限设置',
          })}

          <div className="settings-entry-list settings-entry-list-tight">
            <button
              type="button"
              className="settings-entry-button settings-summary-button"
              onClick={() => navigateSettingsView('permissions')}
            >
              <div className="settings-summary-list">
                {permissionPreviewKeys.map((key) => (
                  <div key={key} className="settings-summary-row">
                    <span className="settings-summary-row-label">{PERMISSION_LABELS[key]}</span>
                    {renderSettingsMiniSwitch(settings.permissionToggles[key])}
                  </div>
                ))}
              </div>
              <span className="settings-entry-meta">
                已开启 {Object.values(settings.permissionToggles).filter(Boolean).length} / {Object.keys(settings.permissionToggles).length}
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Prompts',
            title: '提示词',
          })}

          <div className="settings-prompt-panels">
            {renderPromptEditorPanel({
              isOpen: openPromptEditors.systemPrompt,
              onToggle: () => togglePromptEditor('systemPrompt'),
              title: '系统提示词',
              value: settings.systemPrompt,
              onChange: (value) => updateSetting('systemPrompt', value),
              placeholder: '你可以在此配置系统提示词',
              actionLabel: '重置为默认提示词',
              onAction: () => resetPromptToDefault('systemPrompt'),
              actionDisabled: settings.systemPrompt === PROMPT_DEFAULTS.systemPrompt,
            })}
          </div>

          <div className="settings-entry-list">
            <button
              type="button"
              className="settings-entry-button"
              onClick={() => navigateSettingsView('tag-prompts')}
            >
              <span className="settings-entry-title">标签提示词</span>
              <span className="settings-entry-meta">
                {'分别配置一般标签、顶层标签、<read>、<run> 与 <edit>，并支持一键恢复默认。'}
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Generation',
            title: '生成参数',
          })}

          <div className="field-grid">
            <label className="field">
              <span>Temperature (0-2)</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.temperature}
                inputMode="decimal"
                placeholder={String(DEFAULT_SETTINGS.temperature)}
                onChange={(event) =>
                  handleNumericSettingChange('temperature', event.target.value, 0, 2)
                }
                onBlur={() => finalizeNumericSettingDraft('temperature')}
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>Top P (0-1)</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.topP}
                inputMode="decimal"
                placeholder={String(DEFAULT_SETTINGS.topP)}
                onChange={(event) => handleNumericSettingChange('topP', event.target.value, 0, 1)}
                onBlur={() => finalizeNumericSettingDraft('topP')}
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>Max Tokens</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.maxTokens}
                inputMode="numeric"
                placeholder={String(DEFAULT_SETTINGS.maxTokens)}
                onChange={(event) =>
                  handleNumericSettingChange('maxTokens', event.target.value, 1, 8192, true)
                }
                onBlur={() => finalizeNumericSettingDraft('maxTokens')}
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>Presence Penalty (-2~2)</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.presencePenalty}
                inputMode="decimal"
                placeholder={String(DEFAULT_SETTINGS.presencePenalty)}
                onChange={(event) =>
                  handleNumericSettingChange('presencePenalty', event.target.value, -2, 2)
                }
                onBlur={() => finalizeNumericSettingDraft('presencePenalty')}
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>Frequency Penalty (-2~2)</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.frequencyPenalty}
                inputMode="decimal"
                placeholder={String(DEFAULT_SETTINGS.frequencyPenalty)}
                onChange={(event) =>
                  handleNumericSettingChange('frequencyPenalty', event.target.value, -2, 2)
                }
                onBlur={() => finalizeNumericSettingDraft('frequencyPenalty')}
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>模型错误最大重试次数</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.maxModelRetryCount}
                inputMode="numeric"
                placeholder={String(DEFAULT_SETTINGS.maxModelRetryCount)}
                onChange={(event) =>
                  handleNumericSettingChange('maxModelRetryCount', event.target.value, 0, 10, true)
                }
                onBlur={() => finalizeNumericSettingDraft('maxModelRetryCount')}
                maxHeight={140}
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Conversation',
            title: '对话管理',
          })}

          <div className="field-grid">
            <label className="field">
              <span>删对话免提醒时长（秒）</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.deleteConfirmGraceSeconds}
                inputMode="numeric"
                placeholder={String(DEFAULT_SETTINGS.deleteConfirmGraceSeconds)}
                onChange={(event) =>
                  handleNumericSettingChange(
                    'deleteConfirmGraceSeconds',
                    event.target.value,
                    0,
                    600,
                    true,
                  )
                }
                onBlur={() => finalizeNumericSettingDraft('deleteConfirmGraceSeconds')}
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>对话分组时间间隔（分钟）</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={numericSettingDrafts.conversationGroupGapMinutes}
                inputMode="numeric"
                placeholder={String(DEFAULT_SETTINGS.conversationGroupGapMinutes)}
                onChange={(event) =>
                  handleNumericSettingChange(
                    'conversationGroupGapMinutes',
                    event.target.value,
                    0,
                    120,
                    true,
                  )
                }
                onBlur={() => finalizeNumericSettingDraft('conversationGroupGapMinutes')}
                maxHeight={140}
              />
            </label>

            <label className="toggle-row">
              <span>自动折叠对话</span>
              <input
                className="toggle-switch"
                type="checkbox"
                checked={settings.autoCollapseConversations}
                onChange={(event) => updateSetting('autoCollapseConversations', event.target.checked)}
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          {renderSettingsSectionHeading({
            label: 'Display',
            title: '显示选项',
          })}

          <label className="field">
            <span>主题模式</span>
            <SettingsPopoverSelect
              value={settings.themeMode}
              options={THEME_MODE_OPTIONS}
              ariaLabel="选择主题模式"
              onChange={(nextValue) => updateSetting('themeMode', nextValue)}
            />
          </label>

          <label className="field">
            <span>模糊度（px）</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.chatBlurPx}
              inputMode="numeric"
              placeholder={String(DEFAULT_SETTINGS.chatBlurPx)}
              onChange={(event) =>
                handleNumericSettingChange('chatBlurPx', event.target.value, 0, 40, true)
              }
              onBlur={() => finalizeNumericSettingDraft('chatBlurPx')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>空白页统计最少对话数</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.emptyStateStatsMinConversations}
              inputMode="numeric"
              placeholder={String(DEFAULT_SETTINGS.emptyStateStatsMinConversations)}
              onChange={(event) =>
                handleNumericSettingChange(
                  'emptyStateStatsMinConversations',
                  event.target.value,
                  0,
                  MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS,
                  true,
                )
              }
              onBlur={() => finalizeNumericSettingDraft('emptyStateStatsMinConversations')}
              maxHeight={140}
            />
          </label>

          <label className="toggle-row">
            <span>显示思考过程</span>
            <input
              className="toggle-switch"
              type="checkbox"
              checked={settings.showReasoning}
              onChange={(event) => updateSetting('showReasoning', event.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <span>删除模式振动</span>
            <input
              className="toggle-switch"
              type="checkbox"
              checked={settings.deleteModeHapticsEnabled}
              onChange={(event) => updateSetting('deleteModeHapticsEnabled', event.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <span>首 Token 振动</span>
            <input
              className="toggle-switch"
              type="checkbox"
              checked={settings.firstTokenHapticsEnabled}
              onChange={(event) => updateSetting('firstTokenHapticsEnabled', event.target.checked)}
            />
          </label>
        </section>
      </>
    )
  }

  const renderTagPromptSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">说明</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          <div className="settings-static-card">
            <div className="settings-entry-title">标签提示词</div>
            <div className="settings-entry-meta">
              {
                '分别控制一般标签、顶层标签、<read>、<run> 与 <edit> 在技能模式下的行为。信息提示词开关会把当前设备信息与当前对话 workspace 信息以 Markdown 形式拼进系统提示词。页面底部的已废弃提示词会以板块形式保存旧版与后续废弃提示词。'
              }
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">标签提示词</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-prompt-panels">
          {renderPromptEditorPanel({
            isOpen: openPromptEditors.generalTagSystemPrompt,
            onToggle: () => togglePromptEditor('generalTagSystemPrompt'),
            title: '一般标签提示词',
            value: settings.generalTagSystemPrompt,
            onChange: (value) => updateSetting('generalTagSystemPrompt', value),
            placeholder: '你可以在此配置一般标签提示词',
            helperText: '放置适用于所有标签轮次、但不属于任何具体标签的共用规则。',
            actionLabel: '重置为默认提示词',
            onAction: () => resetPromptToDefault('generalTagSystemPrompt'),
            actionDisabled:
              settings.generalTagSystemPrompt === PROMPT_DEFAULTS.generalTagSystemPrompt,
          })}

          {renderPromptEditorPanel({
            isOpen: openPromptEditors.topLevelTagSystemPrompt,
            onToggle: () => togglePromptEditor('topLevelTagSystemPrompt'),
            title: '顶层标签提示词',
            value: settings.topLevelTagSystemPrompt,
            onChange: (value) => updateSetting('topLevelTagSystemPrompt', value),
            placeholder: '你可以在此配置顶层标签提示词',
            helperText: '定义宿主接手态与用户交付态对应的顶层标签，以及顶层标签的硬约束。',
            actionLabel: '重置为默认提示词',
            onAction: () => resetPromptToDefault('topLevelTagSystemPrompt'),
            actionDisabled:
              settings.topLevelTagSystemPrompt === PROMPT_DEFAULTS.topLevelTagSystemPrompt,
          })}

          {renderPromptEditorPanel({
            isOpen: openPromptEditors.readSystemPrompt,
            onToggle: () => togglePromptEditor('readSystemPrompt'),
            title: '<read> 标签提示词',
            value: settings.readSystemPrompt,
            onChange: (value) => updateSetting('readSystemPrompt', value),
            placeholder: '你可以在此配置 <read> 标签提示词',
            helperText: '控制模型何时输出 <read> 标签，以及如何组织读取请求。',
            actionLabel: '重置为默认提示词',
            onAction: () => resetPromptToDefault('readSystemPrompt'),
            actionDisabled: settings.readSystemPrompt === PROMPT_DEFAULTS.readSystemPrompt,
          })}

          {renderPromptEditorPanel({
            isOpen: openPromptEditors.skillCallSystemPrompt,
            onToggle: () => togglePromptEditor('skillCallSystemPrompt'),
            title: '<run> 标签提示词',
            value: settings.skillCallSystemPrompt,
            onChange: (value) => updateSetting('skillCallSystemPrompt', value),
            placeholder: '你可以在此配置 <run> 标签提示词',
            helperText: '控制模型何时输出 <run> 标签，以及如何组织命令执行。',
            actionLabel: '重置为默认提示词',
            onAction: () => resetPromptToDefault('skillCallSystemPrompt'),
            actionDisabled:
              settings.skillCallSystemPrompt === PROMPT_DEFAULTS.skillCallSystemPrompt,
          })}

          {renderPromptEditorPanel({
            isOpen: openPromptEditors.editSystemPrompt,
            onToggle: () => togglePromptEditor('editSystemPrompt'),
            title: '<edit> 标签提示词',
            value: settings.editSystemPrompt,
            onChange: (value) => updateSetting('editSystemPrompt', value),
            placeholder: '你可以在此配置 <edit> 标签提示词',
            helperText: '控制模型何时输出 <edit> 标签，以及如何组织文件修改。',
            actionLabel: '重置为默认提示词',
            onAction: () => resetPromptToDefault('editSystemPrompt'),
            actionDisabled: settings.editSystemPrompt === PROMPT_DEFAULTS.editSystemPrompt,
          })}

        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">信息提示词</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          {INFO_PROMPT_DEFINITIONS.map((definition) =>
            renderInfoPromptToggleCard({
              cardKey: definition.key,
              definition,
              description: definition.globalDescription,
              checked: settings[definition.key],
              onChange: (enabled) => updateSetting(definition.key, enabled),
            }),
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">已废弃提示词</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-prompt-panels">
          {renderPromptEditorPanel({
            isOpen: openPromptEditors.deprecatedTagPrompts,
            onToggle: () => togglePromptEditor('deprecatedTagPrompts'),
            title: '已废弃提示词',
            value: settings.deprecatedTagPrompts,
            onChange: (value) => updateSetting('deprecatedTagPrompts', value),
            placeholder:
              '废弃提示词会以板块形式记录在这里。例如：\n===== 旧版全局标签提示词 | legacy-global-tag-system-prompt =====\n...\n===== END legacy-global-tag-system-prompt =====',
            helperText:
              '这里统一保存旧版与未来废弃的提示词板块。检测到旧版全局标签提示词时，宿主会自动在此追加对应板块。',
          })}
        </div>
      </section>
    </>
  )

  const renderProviderTagPromptSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">说明</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <div className="settings-entry-list">
            <div className="settings-static-card">
              <div className="settings-entry-title">标签提示词</div>
              <div className="settings-entry-meta">
                {`当前服务商：${providerDetailTarget.name.trim() || '未命名服务商'}。文本覆盖留空时跟随全局设置；信息提示词开关未覆盖时也跟随全局设置。`}
              </div>
            </div>
          </div>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">标签提示词覆盖</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <div className="settings-prompt-panels">
            {renderPromptEditorPanel({
              isOpen: openProviderPromptEditors.generalTagSystemPrompt,
              onToggle: () => toggleProviderPromptEditor('generalTagSystemPrompt'),
              title: '一般标签提示词覆盖',
              value: providerDetailTarget.generalTagSystemPrompt ?? '',
              onChange: (value) =>
                updateProviderPromptOverride(providerDetailTarget.id, 'generalTagSystemPrompt', value),
              placeholder: '留空时使用全局一般标签提示词',
              helperText: '控制服务商专属的一般标签规则；留空时完全跟随全局配置。',
              actionLabel: '恢复跟随全局',
              onAction: () =>
                clearProviderPromptOverride(providerDetailTarget.id, 'generalTagSystemPrompt'),
              actionDisabled: providerDetailTarget.generalTagSystemPrompt === undefined,
            })}

            {renderPromptEditorPanel({
              isOpen: openProviderPromptEditors.topLevelTagSystemPrompt,
              onToggle: () => toggleProviderPromptEditor('topLevelTagSystemPrompt'),
              title: '顶层标签提示词覆盖',
              value: providerDetailTarget.topLevelTagSystemPrompt ?? '',
              onChange: (value) =>
                updateProviderPromptOverride(providerDetailTarget.id, 'topLevelTagSystemPrompt', value),
              placeholder: '留空时使用全局顶层标签提示词',
              helperText: '控制服务商专属的顶层标签映射与硬约束；留空时完全跟随全局配置。',
              actionLabel: '恢复跟随全局',
              onAction: () =>
                clearProviderPromptOverride(providerDetailTarget.id, 'topLevelTagSystemPrompt'),
              actionDisabled: providerDetailTarget.topLevelTagSystemPrompt === undefined,
            })}

            {renderPromptEditorPanel({
              isOpen: openProviderPromptEditors.readSystemPrompt,
              onToggle: () => toggleProviderPromptEditor('readSystemPrompt'),
              title: '<read> 标签提示词覆盖',
              value: providerDetailTarget.readSystemPrompt ?? '',
              onChange: (value) =>
                updateProviderPromptOverride(providerDetailTarget.id, 'readSystemPrompt', value),
              placeholder: '留空时使用全局 <read> 标签提示词',
              helperText: '控制服务商专属的 <read> 输出规则；留空时完全跟随全局配置。',
              actionLabel: '恢复跟随全局',
              onAction: () => clearProviderPromptOverride(providerDetailTarget.id, 'readSystemPrompt'),
              actionDisabled: providerDetailTarget.readSystemPrompt === undefined,
            })}

            {renderPromptEditorPanel({
              isOpen: openProviderPromptEditors.skillCallSystemPrompt,
              onToggle: () => toggleProviderPromptEditor('skillCallSystemPrompt'),
              title: '<run> 标签提示词覆盖',
              value: providerDetailTarget.skillCallSystemPrompt ?? '',
              onChange: (value) =>
                updateProviderPromptOverride(providerDetailTarget.id, 'skillCallSystemPrompt', value),
              placeholder: '留空时使用全局 <run> 标签提示词',
              helperText: '控制服务商专属的 <run> 输出规则；留空时完全跟随全局配置。',
              actionLabel: '恢复跟随全局',
              onAction: () =>
                clearProviderPromptOverride(providerDetailTarget.id, 'skillCallSystemPrompt'),
              actionDisabled: providerDetailTarget.skillCallSystemPrompt === undefined,
            })}

            {renderPromptEditorPanel({
              isOpen: openProviderPromptEditors.editSystemPrompt,
              onToggle: () => toggleProviderPromptEditor('editSystemPrompt'),
              title: '<edit> 标签提示词覆盖',
              value: providerDetailTarget.editSystemPrompt ?? '',
              onChange: (value) =>
                updateProviderPromptOverride(providerDetailTarget.id, 'editSystemPrompt', value),
              placeholder: '留空时使用全局 <edit> 标签提示词',
              helperText: '控制服务商专属的 <edit> 输出规则；留空时完全跟随全局配置。',
              actionLabel: '恢复跟随全局',
              onAction: () => clearProviderPromptOverride(providerDetailTarget.id, 'editSystemPrompt'),
              actionDisabled: providerDetailTarget.editSystemPrompt === undefined,
            })}

          </div>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">信息提示词覆盖</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <div className="settings-entry-list">
            {INFO_PROMPT_DEFINITIONS.map((definition) => {
              const overrideValue = providerDetailTarget[definition.key]
              const effectiveValue = overrideValue ?? settings[definition.key]
              const statusText =
                overrideValue === undefined
                  ? `当前跟随全局：${formatToggleStateLabel(settings[definition.key])}`
                  : `当前覆盖：${formatToggleStateLabel(overrideValue)}`

              return renderInfoPromptToggleCard({
                cardKey: definition.key,
                definition,
                description: definition.providerDescription,
                statusText,
                checked: effectiveValue,
                onChange: (enabled) =>
                  updateProviderInfoPromptOverride(providerDetailTarget.id, definition.key, enabled),
                actionLabel: '恢复跟随全局',
                onAction: () =>
                  clearProviderInfoPromptOverride(providerDetailTarget.id, definition.key),
                actionDisabled: overrideValue === undefined,
              })
            })}
          </div>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>
    </>
  )

  const renderProvidersSettings = () => (
    <ProvidersSettings
      settings={settings}
      onAddProvider={addProvider}
      onEditProvider={openProviderDetail}
      onDeleteProvider={requestDeleteProvider}
      isCloudLoggedIn={cloudLoggedIn}
      onCloudLogin={() => {
        closeSettingsPanel()
        setCloudAuthMode('login')
      }}
    />
  )

  const renderAccountsSettings = () => (
    <AccountsSettings
      settings={settings}
      isCloudLoggedIn={cloudLoggedIn}
      cloudAuth={getStoredCloudAuth()}
      onNavigateActiNet={() => navigateSettingsView('actinet')}
      onNavigateProviders={() => navigateSettingsView('providers')}
      otherProvidersEnabled={settings.otherProvidersEnabled}
      onToggleOtherProviders={(enabled) => updateSetting('otherProvidersEnabled', enabled)}
    />
  )

  const renderActiNetSettings = () => (
    <ActiNetSettings
      isCloudLoggedIn={cloudLoggedIn}
      cloudAuth={getStoredCloudAuth()}
      onCloudLogin={() => {
        closeSettingsPanel()
        setCloudAuthMode('login')
      }}
      onCloudLogout={() => {
        clearCloudAuth()
        updateSetting('actiNetModels', [])
        navigateSettingsView('accounts')
      }}
      actiNetModels={settings.actiNetModels}
      onUpdateActiNetModels={(models) => updateSetting('actiNetModels', models)}
      actiNetAdvancedModelsEnabled={settings.actiNetAdvancedModelsEnabled}
      onToggleAdvancedModels={(enabled) => updateSetting('actiNetAdvancedModelsEnabled', enabled)}
    />
  )

  const renderProviderDetailSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">当前服务商</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <div className="settings-entry-list">
            <div className="settings-static-card">
              <div className="settings-entry-title">{providerDetailTarget.name.trim() || '未命名服务商'}</div>
              <div className="summary-bar">
                <span>{providerDetailTarget.models.length} 个模型</span>
                <span>{providerDetailTarget.models.filter((model) => model.enabled).length} 个启用</span>
                {providerDetailTarget.id === settings.currentProviderId && settings.currentModel ? (
                  <span>当前 {settings.currentModel}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">接口配置</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <>
            <label className="field">
              <span>服务商名称</span>
              <ChatInputBox
                className="settings-chat-input"
                value={providerDetailTarget.name}
                onChange={(event) => updateProviderField(providerDetailTarget.id, 'name', event.target.value)}
                placeholder="例如 OpenAI"
                maxHeight={140}
              />
            </label>

            <label className="field">
              <span>API Base URL</span>
              <ChatInputBox
                className="settings-chat-input"
                value={providerDetailTarget.apiBaseUrl}
                onChange={(event) =>
                  updateProviderField(providerDetailTarget.id, 'apiBaseUrl', event.target.value)
                }
                placeholder="https://api.example.com/v1"
                maxHeight={220}
              />
            </label>

            <label className="field">
              <span>API Key</span>
              <ChatInputBox
                className="settings-chat-input"
                value={providerDetailTarget.apiKey}
                onChange={(event) =>
                  updateProviderField(
                    providerDetailTarget.id,
                    'apiKey',
                    event.target.value.replace(/\r?\n/g, ''),
                  )
                }
                placeholder="sk-..."
                maxHeight={64}
                style={{ WebkitTextSecurity: 'disc' } as CSSProperties}
              />
            </label>
          </>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">模型设置</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <>
            <div className="model-tools">
              <button
                type="button"
                onClick={() => void fetchProviderModels(providerDetailTarget.id)}
                disabled={isFetchingModelsByProviderId[providerDetailTarget.id] === true}
              >
                {isFetchingModelsByProviderId[providerDetailTarget.id] === true
                  ? '加载中...'
                  : '拉取模型列表'}
              </button>
            </div>

            <div className="model-add-row">
              <ChatInputBox
                className="settings-chat-input"
                value={manualModelDraft}
                onChange={(event) => setManualModelDraft(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key !== 'Enter' || event.shiftKey) {
                    return
                  }
                  event.preventDefault()
                  addManualProviderModel()
                }}
                placeholder="手动添加模型，例如 gpt-4o-mini"
                maxHeight={140}
              />
              <button type="button" onClick={addManualProviderModel}>
                添加
              </button>
            </div>

            <label className="field field-compact">
              <span>搜索模型</span>
              <ChatInputBox
                className="settings-chat-input settings-chat-input-compact"
                value={providerModelSearch}
                onChange={(event) => setProviderModelSearch(event.target.value)}
                placeholder="输入模型名筛选"
                maxHeight={140}
              />
            </label>

            <div className="model-list">
              {providerDetailTarget.models.length === 0 ? (
                <p className="summary-muted">暂无模型，请先拉取或手动添加。</p>
              ) : filteredProviderModels.length === 0 ? (
                <p className="summary-muted">没有匹配的模型。</p>
              ) : (
                filteredProviderModels.map((model) => {
                  const healthKey = createProviderModelKey(providerDetailTarget.id, model.id)
                  const isActive =
                    settings.currentProviderId === providerDetailTarget.id &&
                    settings.currentModel === model.id
                  return (
                    <div
                      key={healthKey}
                      className={`model-row ${isActive ? 'active' : ''} ${
                        model.enabled ? '' : 'is-disabled'
                      }`}
                      onClick={() => {
                        if (!model.enabled) {
                          pushNotice('请先启用该模型。', 'info')
                          return
                        }
                        selectCurrentModel(providerDetailTarget.id, model.id)
                      }}
                    >
                      <span className="model-row-label">{model.id}</span>
                      <div className="model-row-actions">
                        <button
                          type="button"
                          className={`model-health-button model-${modelHealth[healthKey] ?? 'untested'}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void testProviderModel(providerDetailTarget.id, model.id)
                          }}
                          disabled={modelHealth[healthKey] === 'testing'}
                        >
                          {modelHealthLabel(modelHealth[healthKey])}
                        </button>
                        <button
                          type="button"
                          className={`model-toggle-button ${model.enabled ? 'is-enabled' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setProviderModelEnabled(providerDetailTarget.id, model.id, !model.enabled)
                          }}
                        >
                          {model.enabled ? '已启用' : '启用'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">提示词覆盖</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <>
            <p className="summary-muted">留空时使用全局默认提示词。</p>

            <div className="settings-prompt-panels">
              {renderPromptEditorPanel({
                isOpen: openProviderPromptEditors.systemPrompt,
                onToggle: () => toggleProviderPromptEditor('systemPrompt'),
                title: '系统提示词',
                value: providerDetailTarget.systemPrompt ?? '',
                onChange: (value) =>
                  updateProviderPromptOverride(providerDetailTarget.id, 'systemPrompt', value),
                placeholder: '留空时使用全局系统提示词',
                actionLabel: '恢复跟随全局',
                onAction: () => clearProviderPromptOverride(providerDetailTarget.id, 'systemPrompt'),
                actionDisabled: providerDetailTarget.systemPrompt === undefined,
              })}
            </div>

            <div className="settings-entry-list">
              <button
                type="button"
                className="settings-entry-button"
                onClick={() => navigateSettingsView('provider-tag-prompts')}
              >
                <span className="settings-entry-title">标签提示词</span>
                <span className="settings-entry-meta">
                  {'分别覆盖一般标签、顶层标签、<read>、<run> 与 <edit>；留空时跟随全局。'}
                </span>
              </button>
            </div>
          </>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">生成参数覆盖</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {providerDetailTarget ? (
          <>
            <p className="summary-muted">留空时使用全局默认生成参数。</p>

            <div className="field-grid">
              <label className="field">
                <span>Temperature (0-2)</span>
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-compact"
                  value={providerNumericSettingDrafts.temperature}
                  inputMode="decimal"
                  placeholder={String(settings.temperature)}
                  onChange={(event) =>
                    handleProviderNumericSettingChange('temperature', event.target.value)
                  }
                  onBlur={() => finalizeProviderNumericSettingDraft('temperature')}
                  maxHeight={140}
                />
              </label>

              <label className="field">
                <span>Top P (0-1)</span>
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-compact"
                  value={providerNumericSettingDrafts.topP}
                  inputMode="decimal"
                  placeholder={String(settings.topP)}
                  onChange={(event) => handleProviderNumericSettingChange('topP', event.target.value)}
                  onBlur={() => finalizeProviderNumericSettingDraft('topP')}
                  maxHeight={140}
                />
              </label>

              <label className="field">
                <span>Max Tokens</span>
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-compact"
                  value={providerNumericSettingDrafts.maxTokens}
                  inputMode="numeric"
                  placeholder={String(settings.maxTokens)}
                  onChange={(event) =>
                    handleProviderNumericSettingChange('maxTokens', event.target.value)
                  }
                  onBlur={() => finalizeProviderNumericSettingDraft('maxTokens')}
                  maxHeight={140}
                />
              </label>

              <label className="field">
                <span>Presence Penalty (-2~2)</span>
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-compact"
                  value={providerNumericSettingDrafts.presencePenalty}
                  inputMode="decimal"
                  placeholder={String(settings.presencePenalty)}
                  onChange={(event) =>
                    handleProviderNumericSettingChange('presencePenalty', event.target.value)
                  }
                  onBlur={() => finalizeProviderNumericSettingDraft('presencePenalty')}
                  maxHeight={140}
                />
              </label>

              <label className="field">
                <span>Frequency Penalty (-2~2)</span>
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-compact"
                  value={providerNumericSettingDrafts.frequencyPenalty}
                  inputMode="decimal"
                  placeholder={String(settings.frequencyPenalty)}
                  onChange={(event) =>
                    handleProviderNumericSettingChange('frequencyPenalty', event.target.value)
                  }
                  onBlur={() => finalizeProviderNumericSettingDraft('frequencyPenalty')}
                  maxHeight={140}
                />
              </label>

              <label className="field">
                <span>模型错误最大重试次数</span>
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-compact"
                  value={providerNumericSettingDrafts.maxModelRetryCount}
                  inputMode="numeric"
                  placeholder={String(settings.maxModelRetryCount)}
                  onChange={(event) =>
                    handleProviderNumericSettingChange('maxModelRetryCount', event.target.value)
                  }
                  onBlur={() => finalizeProviderNumericSettingDraft('maxModelRetryCount')}
                  maxHeight={140}
                />
              </label>
            </div>
          </>
        ) : (
          <p className="summary-muted">未找到目标服务商。</p>
        )}
      </section>

      {/* ── 软件更新 ── */}
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">软件更新</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-static-card settings-summary-card">
          <div className="settings-summary-list">
            <div className="settings-summary-row">
              <span className="settings-summary-row-label">当前版本</span>
              <span className="settings-summary-row-value">1.5.0</span>
            </div>
          </div>
        </div>

        <div className="settings-entry-list">
          <button
            type="button"
            className="settings-entry-button"
            onClick={() => void handleManualUpdateCheck()}
          >
            <span className="settings-entry-title">检查更新</span>
            <span className="settings-entry-meta">
              检测是否有可用的 ActiChat 新版本
            </span>
          </button>
        </div>
      </section>
    </>
  )

  const renderSkillsSettings = () => (
    <SkillsSettings
      skillArchiveInputRef={skillArchiveInputRef}
      isInstallingSkillArchive={isInstallingSkillArchive}
      isLoadingExtensions={isLoadingExtensions}
      skillRecords={skillRecords}
      onRefresh={() => void refreshExtensions(true)}
      onSetEnabled={handleSetSkillEnabled}
      onOpenConfig={(id) => void openSkillConfigEditor(id)}
      onDelete={requestDeleteSkill}
    />
  )

  const renderSkillConfigSettings = () => (
    <SkillConfigSettings
      skillConfigTarget={skillConfigTarget}
      isLoadingSkillConfig={isLoadingSkillConfig}
      skillConfigValue={skillConfigValue}
      skillConfigDraft={skillConfigDraft}
      skillConfigRawError={skillConfigRawError}
      isSavingSkillConfig={isSavingSkillConfig}
      onConfigValueChange={applySkillConfigValue}
      onDraftChange={handleSkillConfigDraftChange}
      onFormat={formatSkillConfigDraft}
      onSave={() => void saveSkillConfig()}
    />
  )

  const renderRuntimeSettings = () => (
    <RuntimeSettings
      runtimeArchiveInputRef={runtimeArchiveInputRef}
      isInstallingRuntimeArchive={isInstallingRuntimeArchive}
      isLoadingExtensions={isLoadingExtensions}
      runtimeRecords={runtimeRecords}
      onRefresh={() => void refreshExtensions(true)}
      onSetEnabled={handleSetRuntimeEnabled}
      onTest={(runtime: any) => handleTestRuntime(runtime.id)}
      onSetDefault={(runtime: any) => handleSetDefaultRuntime(runtime.id)}
      onDelete={requestDeleteRuntime}
    />
  )

  const renderPermissionsSettings = () => (
    <PermissionsSettings
      permissionToggles={settings.permissionToggles}
      requestingPermissionByKey={requestingPermissionByKey}
      onToggle={handlePermissionToggle}
    />
  )

  // ── Orchestrator ────────────────────────────────────

  const showBack = settingsView !== 'main'
  let pageChrome = {
    eyebrow: 'Settings',
    title: '动话设置',
    copy: '保持你现在的设置信息架构，只把它从"功能堆叠"变成"章节清楚的长表面"。',
  }
  let settingsContent = renderMainSettings()

  switch (settingsView) {
    case 'tag-prompts':
      pageChrome = {
        eyebrow: 'Tag prompts',
        title: '标签提示词',
        copy: '一般标签、顶层标签、<read>、<run> 与 <edit> 的规则仍然都在，只是从技术面板整理成更可读的长页。',
      }
      settingsContent = renderTagPromptSettings()
      break
    case 'accounts':
      pageChrome = {
        eyebrow: 'Accounts',
        title: '账号管理',
        copy: '管理 ActiNet 云账户与其他服务商。',
      }
      settingsContent = renderAccountsSettings()
      break
    case 'actinet':
      pageChrome = {
        eyebrow: 'ActiNet',
        title: 'ActiNet 账户',
        copy: '管理你的 ActiNet 云服务账户。',
      }
      settingsContent = renderActiNetSettings()
      break
    case 'providers':
      pageChrome = {
        eyebrow: 'Providers',
        title: '其它服务商',
        copy: '服务商、模型和默认选择仍然全部保留；这页的目标是让配置关系更清楚，而不是减少能力。',
      }
      settingsContent = renderProvidersSettings()
      break
    case 'provider-detail':
      pageChrome = {
        eyebrow: 'Provider detail',
        title: providerDetailTarget?.name?.trim() || '服务商配置',
        copy: '接口配置、模型管理和覆盖项都保留；重点是把密集表单整理成更稳定、更容易读的层次。',
      }
      settingsContent = renderProviderDetailSettings()
      break
    case 'provider-tag-prompts':
      pageChrome = {
        eyebrow: 'Provider prompts',
        title: '标签提示词',
        copy: '这里继续保留服务商级提示词覆盖；留空时仍然跟随全局默认设置。',
      }
      settingsContent = renderProviderTagPromptSettings()
      break
    case 'skills':
      pageChrome = {
        eyebrow: 'Skills',
        title: 'Skills 管理',
        copy: '安装、启用、配置和删除都保留；只是把"工具清单"从厚卡片改成更清楚的长列表。',
      }
      settingsContent = renderSkillsSettings()
      break
    case 'skill-config':
      pageChrome = {
        eyebrow: 'Skill config',
        title: 'Skill 配置',
        copy: '可视化配置和原始 JSON 双轨保留不变；这页只重做阅读与编辑的版面语言。',
      }
      settingsContent = renderSkillConfigSettings()
      break
    case 'runtimes':
      pageChrome = {
        eyebrow: 'Runtimes',
        title: '运行时设置',
        copy: '运行时安装、启用、检测和默认设置保持原逻辑；重点是让状态、版本和动作更容易扫描。',
      }
      settingsContent = renderRuntimeSettings()
      break
    case 'permissions':
      pageChrome = {
        eyebrow: 'Permissions',
        title: '权限设置',
        copy: '默认关闭、按需申请的权限策略保持不变；这里只把权限表面整理得更直白、更稳定。',
      }
      settingsContent = renderPermissionsSettings()
      break
    case 'daily-cover':
      pageChrome = {
        eyebrow: 'Daily cover',
        title: '首页每日风景封面',
        copy: '默认图池保证稳定，自定义 API 负责增强；失败时永远回退到本地内置图池。',
      }
      settingsContent = renderDailyCoverSettings()
      break
    default:
      break
  }

  return (
    <SettingsScreen
      settingsView={settingsView}
      settingsPageRef={settingsPageRef}
      pageChrome={pageChrome}
      settingsContent={settingsContent}
      showBack={showBack}
      onScroll={onSettingsScroll}
      onBack={handleSettingsBack}
      onClose={closeSettingsPanel}
    />
  )
}

// 占位导出——提取规划元数据（保留用于 077 报告）
export const SETTINGS_PAGE_EXTRACTION_PLAN = {
  totalLinesExtracted: 1280,
  renderFunctionCount: 16,
  status: 'complete' as const,
}
