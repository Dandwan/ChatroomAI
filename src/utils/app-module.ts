// Auto-extracted from App.tsx module-level code
// See docs/development-status/handoff-updates/070-app-modular-refactor-completion-plan.md

import {
  createConversationFromTranscript,
  normalizeConversationResponseMode,
  withConversationResponseMode,
  withConversationTranscript,
} from '../services/chat-transcript'
import {
  DEFAULT_EDIT_SYSTEM_PROMPT,
  DEFAULT_GENERAL_TAG_SYSTEM_PROMPT,
  DEFAULT_READ_SYSTEM_PROMPT,
  DEFAULT_RUN_SYSTEM_PROMPT,
  DEFAULT_TOP_LEVEL_TAG_SYSTEM_PROMPT,
  migrateLegacyTagSystemPrompts,
  migratePromptVersions,
} from '../services/skills/default-system-prompts'
import {
  DEFAULT_INFO_PROMPT_SETTINGS,
  INFO_PROMPT_DEFINITIONS,
  normalizeInfoPromptOverride,
  type InfoPromptDefinition,
  type InfoPromptSettingKey,
} from '../services/skills/info-system-prompts'
import {
  DEFAULT_DAILY_COVER_SETTINGS,
  type DailyCoverSettings,
} from '../services/daily-cover'
import {
  buildConversationSummary,
  loadChatIndex,
  type ChatStoragePersistState,
} from '../services/chat-storage'
import { createProviderModelKey, modelHealthLabel } from '../utils/model-utils'
import { formatMs } from '../utils/time-utils'
import { createId, toFiniteNumber, clamp, isRecord, isJsonObjectRecord, formatJsonObject, numberFormatter } from '../utils/app-formatting'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import type {
  ActiveProviderRequestSettings,
  AppSettings,
  ChatStorageConversationSummary,
  ChatSummarySnapshot,
  CompletionResult,
  Conversation,
  ConversationDrafts,
  ConversationData,
  ConversationGroup,
  ConversationResponseMode,
  EnabledModelOption,
  GlobalPromptSettingKey,
  ImageAttachment,
  LoadedChatState,
  ModelHealth,
  NumericSettingDrafts,
  NumericSettingKey,
  ProviderBooleanSettingKey,
  ProviderConfig,
  ProviderModel,
  ProviderNumericSettingDrafts,
  ProviderNumericSettingKey,
  ProviderPromptSettingKey,
  PromptEditorKey,
  SettingsView,
  TagPromptEditorKey,
  TagPromptSettingKey,
  ThemeMode,
  TitleTransitionState,
  TurnExecutionJob,
  PendingTitleTransition,
  DeleteDialogState,
  MessageListScrollMetrics,
  Notice,
  RectSnapshot,
  PermissionToggles,
} from '../state/types'

export const MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS = 9999
export const TITLE_EDIT_TRANSITION_MS = 220
export const TITLE_EDIT_TRANSITION_TRAVEL_FACTOR = 0.18
export const TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX = 12
export const TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX = 26
export const MESSAGE_LIST_BOTTOM_THRESHOLD_PX = 28
export const MESSAGE_LIST_INTERACTION_IDLE_MS = 140
export const MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR = 1
export const MESSAGE_LIST_AUTO_SCROLL_MAX_MS = 96
export const MESSAGE_LIST_SMOOTH_SCROLL_MAX_SPEED_PX_PER_MS = 13.2
export const MESSAGE_LIST_SMOOTH_SCROLL_EASE_DISTANCE_FACTOR = 2.1
export const MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START = 0.44
export const MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_FACTOR = 0.4
export const MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX = 10


export const hasConversationStarted = (
  conversation: Pick<Conversation, 'transcript'>,
): boolean => conversation.transcript.some((event) => event.kind === 'user_message')

export const resolveConversationResponseMode = (
  conversation: Pick<Conversation, 'preferences'> | null,
  defaultResponseMode: ConversationResponseMode,
): ConversationResponseMode =>
  normalizeConversationResponseMode(conversation?.preferences?.responseMode) ?? defaultResponseMode

export const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3

export const applyMessageListSmoothScrollAccelerationBoost = (normalizedDistance: number): number => {
  if (normalizedDistance <= MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START) {
    return normalizedDistance
  }

  export const boostProgress =
    (normalizedDistance - MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START) /
    (1 - MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START)

  return Math.min(
    1,
    normalizedDistance +
      (1 - normalizedDistance) *
        boostProgress *
        MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_FACTOR,
  )
}

export const resolveMessageListSmoothScrollStep = ({
  remainingDistance,
  deltaMs,
  viewportHeight,
}: {
  remainingDistance: number
  deltaMs: number
  viewportHeight: number
}): number => {
  export const maxStep = MESSAGE_LIST_SMOOTH_SCROLL_MAX_SPEED_PX_PER_MS * deltaMs
  export const easeDistance = Math.max(
    viewportHeight * MESSAGE_LIST_SMOOTH_SCROLL_EASE_DISTANCE_FACTOR,
    MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX,
  )
  export const normalizedDistance = Math.min(1, remainingDistance / easeDistance)
  export const acceleratedDistance = applyMessageListSmoothScrollAccelerationBoost(normalizedDistance)
  export const easedStep = maxStep * easeOutCubic(acceleratedDistance)

  return Math.min(
    remainingDistance,
    Math.max(MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX, easedStep),
  )
}


export const DEFAULT_PERMISSION_TOGGLES: PermissionToggles = {
  location: false,
  camera: false,
  microphone: false,
  notifications: false,
}

export const DEFAULT_SETTINGS: AppSettings = {
  systemPrompt: `
1. 使用 LaTeX 输出数学公式。
2. 以真实可靠的信息回答问题：
   - 对于需要最新信息或超出训练数据的问题，主动搜索验证，不依赖可能过时的训练数据作答。
   - 搜索到的信息来源不够可靠时，反复搜索验证（最多 2-3 次），仍不可靠则放弃寻找并如实说明情况。
   - 通过猜测和推测得到的信息，需明确标注为「推测」或「猜测」。
  `.trim(),
  topLevelTagSystemPrompt: DEFAULT_TOP_LEVEL_TAG_SYSTEM_PROMPT,
  generalTagSystemPrompt: DEFAULT_GENERAL_TAG_SYSTEM_PROMPT,
  readSystemPrompt: DEFAULT_READ_SYSTEM_PROMPT,
  skillCallSystemPrompt: DEFAULT_RUN_SYSTEM_PROMPT,
  editSystemPrompt: DEFAULT_EDIT_SYSTEM_PROMPT,
  ...DEFAULT_INFO_PROMPT_SETTINGS,
  deprecatedTagPrompts: '',
  promptVersions: {},
  themeMode: 'system',
  defaultResponseMode: DEFAULT_RESPONSE_MODE,
  temperature: 0.7,
  topP: 1,
  maxTokens: 8192,
  presencePenalty: 0,
  frequencyPenalty: 0,
  showReasoning: true,
  deleteModeHapticsEnabled: true,
  firstTokenHapticsEnabled: true,
  providers: [],
  currentProviderId: '',
  currentModel: '',
  deleteConfirmGraceSeconds: DEFAULT_DELETE_CONFIRM_GRACE_SECONDS,
  conversationGroupGapMinutes: DEFAULT_CONVERSATION_GROUP_GAP_MINUTES,
  chatBlurPx: DEFAULT_CHAT_BLUR_PX,
  autoCollapseConversations: DEFAULT_AUTO_COLLAPSE_CONVERSATIONS,
  emptyStateStatsMinConversations: DEFAULT_EMPTY_STATE_STATS_MIN_CONVERSATIONS,
  maxModelRetryCount: 3,
  permissionToggles: DEFAULT_PERMISSION_TOGGLES,
  dailyCover: DEFAULT_DAILY_COVER_SETTINGS,
  actiNetModels: [],
  otherProvidersEnabled: false,
  actiNetAdvancedModelsEnabled: false,
}

export const PROMPT_DEFAULTS: Record<GlobalPromptSettingKey, string> = {
  systemPrompt: DEFAULT_SETTINGS.systemPrompt,
  topLevelTagSystemPrompt: DEFAULT_SETTINGS.topLevelTagSystemPrompt,
  generalTagSystemPrompt: DEFAULT_SETTINGS.generalTagSystemPrompt,
  readSystemPrompt: DEFAULT_SETTINGS.readSystemPrompt,
  skillCallSystemPrompt: DEFAULT_SETTINGS.skillCallSystemPrompt,
  editSystemPrompt: DEFAULT_SETTINGS.editSystemPrompt,
}

export const createDefaultSettings = (): AppSettings => ({
  ...DEFAULT_SETTINGS,
  providers: [],
  permissionToggles: { ...DEFAULT_PERMISSION_TOGGLES },
  dailyCover: { ...DEFAULT_DAILY_COVER_SETTINGS },
})

export interface DeprecatedPromptBlock {
  id: string
  title: string
  content: string
}

export const LEGACY_GLOBAL_TAG_PROMPT_BLOCK_ID = 'legacy-global-tag-system-prompt'
export const LEGACY_GLOBAL_TAG_PROMPT_BLOCK_TITLE = '旧版全局标签提示词'

export const buildDeprecatedPromptBlockText = ({ id, title, content }: DeprecatedPromptBlock): string =>
  [
    `===== ${title} | ${id} =====`,
    content.trim(),
    `===== END ${id} =====`,
  ].join('\n')

export const upsertDeprecatedPromptBlock = (raw: string, block: DeprecatedPromptBlock): string => {
  export const normalizedContent = block.content.trim()
  if (!normalizedContent) {
    return raw
  }

  export const normalizedRaw = raw.trim()
  export const startMarker = `===== ${block.title} | ${block.id} =====`
  export const endMarker = `===== END ${block.id} =====`
  if (normalizedRaw.includes(startMarker) || normalizedRaw.includes(endMarker)) {
    return raw
  }

  export const nextBlock = buildDeprecatedPromptBlockText({
    ...block,
    content: normalizedContent,
  })
  return normalizedRaw ? `${normalizedRaw}\n\n${nextBlock}` : nextBlock
}

export const NUMERIC_SETTING_DEFAULTS: Record<NumericSettingKey, number> = {
  temperature: DEFAULT_SETTINGS.temperature,
  topP: DEFAULT_SETTINGS.topP,
  maxTokens: DEFAULT_SETTINGS.maxTokens,
  presencePenalty: DEFAULT_SETTINGS.presencePenalty,
  frequencyPenalty: DEFAULT_SETTINGS.frequencyPenalty,
  deleteConfirmGraceSeconds: DEFAULT_SETTINGS.deleteConfirmGraceSeconds,
  conversationGroupGapMinutes: DEFAULT_SETTINGS.conversationGroupGapMinutes,
  chatBlurPx: DEFAULT_SETTINGS.chatBlurPx,
  emptyStateStatsMinConversations: DEFAULT_SETTINGS.emptyStateStatsMinConversations,
  maxModelRetryCount: DEFAULT_SETTINGS.maxModelRetryCount,
}

export const PROVIDER_NUMERIC_LIMITS: Record<
  ProviderNumericSettingKey,
  { minimum: number; maximum: number; integer?: boolean }
> = {
  temperature: { minimum: 0, maximum: 2 },
  topP: { minimum: 0, maximum: 1 },
  maxTokens: { minimum: 1, maximum: 8192, integer: true },
  presencePenalty: { minimum: -2, maximum: 2 },
  frequencyPenalty: { minimum: -2, maximum: 2 },
  maxModelRetryCount: { minimum: 0, maximum: 10, integer: true },
}

export const normalizeNumericSettingDraft = (key: NumericSettingKey, value: number): string =>
  value === NUMERIC_SETTING_DEFAULTS[key] ? '' : String(value)

export const createNumericSettingDrafts = (settings: AppSettings): NumericSettingDrafts => ({
  temperature: normalizeNumericSettingDraft('temperature', settings.temperature),
  topP: normalizeNumericSettingDraft('topP', settings.topP),
  maxTokens: normalizeNumericSettingDraft('maxTokens', settings.maxTokens),
  presencePenalty: normalizeNumericSettingDraft('presencePenalty', settings.presencePenalty),
  frequencyPenalty: normalizeNumericSettingDraft('frequencyPenalty', settings.frequencyPenalty),
  deleteConfirmGraceSeconds: normalizeNumericSettingDraft(
    'deleteConfirmGraceSeconds',
    settings.deleteConfirmGraceSeconds,
  ),
  conversationGroupGapMinutes: normalizeNumericSettingDraft(
    'conversationGroupGapMinutes',
    settings.conversationGroupGapMinutes,
  ),
  chatBlurPx: normalizeNumericSettingDraft('chatBlurPx', settings.chatBlurPx),
  emptyStateStatsMinConversations: normalizeNumericSettingDraft(
    'emptyStateStatsMinConversations',
    settings.emptyStateStatsMinConversations,
  ),
  maxModelRetryCount: normalizeNumericSettingDraft(
    'maxModelRetryCount',
    settings.maxModelRetryCount,
  ),
})

export const createProviderNumericSettingDrafts = (
  provider?: ProviderConfig | null,
): ProviderNumericSettingDrafts => ({
  temperature: provider?.temperature === undefined ? '' : String(provider.temperature),
  topP: provider?.topP === undefined ? '' : String(provider.topP),
  maxTokens: provider?.maxTokens === undefined ? '' : String(provider.maxTokens),
  presencePenalty: provider?.presencePenalty === undefined ? '' : String(provider.presencePenalty),
  frequencyPenalty: provider?.frequencyPenalty === undefined ? '' : String(provider.frequencyPenalty),
  maxModelRetryCount:
    provider?.maxModelRetryCount === undefined ? '' : String(provider.maxModelRetryCount),
})


export const createProviderNameCandidate = (providers: ProviderConfig[]): string => {
  export const usedNames = new Set(providers.map((provider) => provider.name.trim()).filter(Boolean))
  export let index = 1
  while (true) {
    export const candidate = `服务商 ${index}`
    if (!usedNames.has(candidate)) {
      return candidate
    }
    index += 1
  }
}

export const createProviderConfig = (name = '服务商'): ProviderConfig => ({
  id: createId(),
  name,
  apiBaseUrl: '',
  apiKey: '',
  models: [],
})

export const normalizeProviderPromptOverride = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  return value.trim().length > 0 ? value : undefined
}

export const normalizeProviderNumericOverride = (
  key: ProviderNumericSettingKey,
  value: unknown,
): number | undefined => {
  export const parsed = toFiniteNumber(value)
  if (parsed === undefined) {
    return undefined
  }

  export const limits = PROVIDER_NUMERIC_LIMITS[key]
  export const clamped = clamp(parsed, limits.minimum, limits.maximum)
  return limits.integer ? Math.round(clamped) : clamped
}

export const normalizeProviderModel = (value: unknown): ProviderModel | undefined => {
  if (typeof value === 'string') {
    export const id = value.trim()
    return id ? { id, enabled: false } : undefined
  }

  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined
  }

  export const id = value.id.trim()
  if (!id) {
    return undefined
  }

  return {
    id,
    enabled: value.enabled === true,
  }
}

export const normalizeThemeMode = (value: unknown): ThemeMode => {
  if (value === 'dark' || value === 'system' || value === 'light') {
    return value
  }
  return DEFAULT_SETTINGS.themeMode
}

// ThemeToggle extracted to src/components/ThemeToggle.tsx

export const normalizeProviderModels = (value: unknown): ProviderModel[] => {
  if (!Array.isArray(value)) {
    return []
  }

  export const models: ProviderModel[] = []
  export const seen = new Set<string>()
  for (const item of value) {
    export const normalized = normalizeProviderModel(item)
    if (!normalized || seen.has(normalized.id)) {
      continue
    }
    seen.add(normalized.id)
    models.push(normalized)
  }
  return models
}

export const normalizeDailyCoverSettings = (value: unknown): DailyCoverSettings => {
  if (!isRecord(value)) {
    return { ...DEFAULT_DAILY_COVER_SETTINGS }
  }

  return {
    enabled:
      typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_DAILY_COVER_SETTINGS.enabled,
    useApi:
      typeof value.useApi === 'boolean' ? value.useApi : DEFAULT_DAILY_COVER_SETTINGS.useApi,
    apiEndpoint:
      typeof value.apiEndpoint === 'string'
        ? value.apiEndpoint
        : DEFAULT_DAILY_COVER_SETTINGS.apiEndpoint,
    apiMethod:
      value.apiMethod === 'POST' ? 'POST' : DEFAULT_DAILY_COVER_SETTINGS.apiMethod,
    apiAuthHeader:
      typeof value.apiAuthHeader === 'string'
        ? value.apiAuthHeader
        : DEFAULT_DAILY_COVER_SETTINGS.apiAuthHeader,
    apiImagePath:
      typeof value.apiImagePath === 'string'
        ? value.apiImagePath
        : DEFAULT_DAILY_COVER_SETTINGS.apiImagePath,
    apiTitlePath:
      typeof value.apiTitlePath === 'string'
        ? value.apiTitlePath
        : DEFAULT_DAILY_COVER_SETTINGS.apiTitlePath,
    apiCreditPath:
      typeof value.apiCreditPath === 'string'
        ? value.apiCreditPath
        : DEFAULT_DAILY_COVER_SETTINGS.apiCreditPath,
    apiLinkPath:
      typeof value.apiLinkPath === 'string'
        ? value.apiLinkPath
        : DEFAULT_DAILY_COVER_SETTINGS.apiLinkPath,
  }
}

export const resolveProviderTagPromptOverrides = (
  value: Record<string, unknown>,
  migrateLegacyPrompts: boolean,
): Pick<ProviderConfig, TagPromptSettingKey> => {
  export const hasAnyTagPromptOverride =
    typeof value.topLevelTagSystemPrompt === 'string' ||
    typeof value.generalTagSystemPrompt === 'string' ||
    typeof value.readSystemPrompt === 'string' ||
    typeof value.skillCallSystemPrompt === 'string' ||
    typeof value.editSystemPrompt === 'string'

  if (!hasAnyTagPromptOverride) {
    return {
      topLevelTagSystemPrompt: undefined,
      generalTagSystemPrompt: undefined,
      readSystemPrompt: undefined,
      skillCallSystemPrompt: undefined,
      editSystemPrompt: undefined,
    }
  }

  if (!migrateLegacyPrompts) {
    return {
      topLevelTagSystemPrompt: normalizeProviderPromptOverride(value.topLevelTagSystemPrompt),
      generalTagSystemPrompt: normalizeProviderPromptOverride(value.generalTagSystemPrompt),
      readSystemPrompt: normalizeProviderPromptOverride(value.readSystemPrompt),
      skillCallSystemPrompt: normalizeProviderPromptOverride(value.skillCallSystemPrompt),
      editSystemPrompt: normalizeProviderPromptOverride(value.editSystemPrompt),
    }
  }

  export const migrated = migrateLegacyTagSystemPrompts(value)
  return {
    topLevelTagSystemPrompt: normalizeProviderPromptOverride(value.topLevelTagSystemPrompt),
    generalTagSystemPrompt: normalizeProviderPromptOverride(migrated.generalTagSystemPrompt),
    readSystemPrompt: normalizeProviderPromptOverride(migrated.readSystemPrompt),
    skillCallSystemPrompt: normalizeProviderPromptOverride(migrated.skillCallSystemPrompt),
    editSystemPrompt: normalizeProviderPromptOverride(migrated.editSystemPrompt),
  }
}

export const resolveProviderInfoPromptOverrides = (
  value: Record<string, unknown>,
): Pick<ProviderConfig, InfoPromptSettingKey> => ({
  deviceInfoPromptEnabled: normalizeInfoPromptOverride(value.deviceInfoPromptEnabled),
  workspaceInfoPromptEnabled: normalizeInfoPromptOverride(value.workspaceInfoPromptEnabled),
})

export const normalizeProviderConfig = (
  value: unknown,
  migrateLegacyPrompts = false,
): ProviderConfig | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  export const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : createId()
  export const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : '未命名服务商'
  export const tagPromptOverrides = resolveProviderTagPromptOverrides(value, migrateLegacyPrompts)
  export const infoPromptOverrides = resolveProviderInfoPromptOverrides(value)

  return {
    id,
    name,
    apiBaseUrl: typeof value.apiBaseUrl === 'string' ? value.apiBaseUrl : '',
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    models: normalizeProviderModels(value.models),
    systemPrompt: normalizeProviderPromptOverride(value.systemPrompt),
    topLevelTagSystemPrompt: tagPromptOverrides.topLevelTagSystemPrompt,
    generalTagSystemPrompt: tagPromptOverrides.generalTagSystemPrompt,
    readSystemPrompt: tagPromptOverrides.readSystemPrompt,
    skillCallSystemPrompt: tagPromptOverrides.skillCallSystemPrompt,
    editSystemPrompt: tagPromptOverrides.editSystemPrompt,
    deviceInfoPromptEnabled: infoPromptOverrides.deviceInfoPromptEnabled,
    workspaceInfoPromptEnabled: infoPromptOverrides.workspaceInfoPromptEnabled,
    temperature: normalizeProviderNumericOverride('temperature', value.temperature),
    topP: normalizeProviderNumericOverride('topP', value.topP),
    maxTokens: normalizeProviderNumericOverride('maxTokens', value.maxTokens),
    presencePenalty: normalizeProviderNumericOverride('presencePenalty', value.presencePenalty),
    frequencyPenalty: normalizeProviderNumericOverride('frequencyPenalty', value.frequencyPenalty),
    maxModelRetryCount: normalizeProviderNumericOverride(
      'maxModelRetryCount',
      value.maxModelRetryCount,
    ),
  }
}

export const ACTINET_PROVIDER_ID = '__actinet__'
export const ACTINET_PROVIDER_NAME = 'ActiNet'

export const getEnabledModelOptions = (
  providers: ProviderConfig[],
  isActiNetLoggedIn: boolean,
  otherProvidersEnabled: boolean,
): EnabledModelOption[] => {
  export const providerOptions = otherProvidersEnabled
    ? providers.flatMap((provider) =>
        provider.models
          .filter((model) => model.enabled)
          .map((model) => ({
            providerId: provider.id,
            providerName: provider.name,
            modelId: model.id,
          })),
      )
    : []

  if (isActiNetLoggedIn) {
    export const activeModels = getEffectiveActiNetModels()
    export const actiNetOptions = activeModels
      .filter((model) => model.enabled)
      .map((model) => ({
        providerId: ACTINET_PROVIDER_ID,
        providerName: ACTINET_PROVIDER_NAME,
        modelId: model.id,
      }))
    return [...providerOptions, ...actiNetOptions]
  }

  return providerOptions
}

export const ensureValidCurrentModelSelection = (settings: AppSettings): AppSettings => {
  // Check ActiNet selection first
  if (settings.currentProviderId === ACTINET_PROVIDER_ID) {
    export const effective = getEffectiveActiNetModels()
    export const hasActiNetSelection = effective.some(
      (model) => model.id === settings.currentModel && model.enabled,
    )
    if (hasActiNetSelection) return settings
  } else if (settings.otherProvidersEnabled) {
    export const hasCurrentSelection = settings.providers.some(
      (provider) =>
        provider.id === settings.currentProviderId &&
        provider.models.some((model) => model.id === settings.currentModel && model.enabled),
    )
    if (hasCurrentSelection) return settings
  }

  export const fallback = getEnabledModelOptions(settings.providers, isCloudLoggedIn(), settings.otherProvidersEnabled)[0]
  return {
    ...settings,
    currentProviderId: fallback?.providerId ?? '',
    currentModel: fallback?.modelId ?? '',
  }
}

export const resolveProviderRequestSettings = (settings: AppSettings): ActiveProviderRequestSettings | null => {
  // Handle ActiNet virtual provider
  if (settings.currentProviderId === ACTINET_PROVIDER_ID) {
    export const cloudAuth = getStoredCloudAuth()
    if (!cloudAuth || !cloudAuth.apiKey) return null

    export const effective = getEffectiveActiNetModels()
    export const model = effective.find((m) => m.id === settings.currentModel && m.enabled)
    if (!model) return null

    return {
      providerId: ACTINET_PROVIDER_ID,
      providerName: ACTINET_PROVIDER_NAME,
      apiBaseUrl: getCloudServerUrl(),
      apiKey: cloudAuth.apiKey,
      currentModel: model.id,
      systemPrompt: settings.systemPrompt,
      topLevelTagSystemPrompt: settings.topLevelTagSystemPrompt,
      generalTagSystemPrompt: settings.generalTagSystemPrompt,
      readSystemPrompt: settings.readSystemPrompt,
      skillCallSystemPrompt: settings.skillCallSystemPrompt,
      editSystemPrompt: settings.editSystemPrompt,
      deviceInfoPromptEnabled: settings.deviceInfoPromptEnabled,
      workspaceInfoPromptEnabled: settings.workspaceInfoPromptEnabled,
      temperature: settings.temperature,
      topP: settings.topP,
      maxTokens: settings.maxTokens,
      presencePenalty: settings.presencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      maxModelRetryCount: settings.maxModelRetryCount,
    }
  }

  export const provider = settings.providers.find((item) => item.id === settings.currentProviderId)
  if (!provider) {
    return null
  }

  export const model = provider.models.find((item) => item.id === settings.currentModel && item.enabled)
  if (!model) {
    return null
  }

  return {
    providerId: provider.id,
    providerName: provider.name,
    apiBaseUrl: provider.apiBaseUrl,
    apiKey: provider.apiKey,
    currentModel: model.id,
    systemPrompt: provider.systemPrompt ?? settings.systemPrompt,
    topLevelTagSystemPrompt: provider.topLevelTagSystemPrompt ?? settings.topLevelTagSystemPrompt,
    generalTagSystemPrompt: provider.generalTagSystemPrompt ?? settings.generalTagSystemPrompt,
    readSystemPrompt: provider.readSystemPrompt ?? settings.readSystemPrompt,
    skillCallSystemPrompt: provider.skillCallSystemPrompt ?? settings.skillCallSystemPrompt,
    editSystemPrompt: provider.editSystemPrompt ?? settings.editSystemPrompt,
    deviceInfoPromptEnabled: provider.deviceInfoPromptEnabled ?? settings.deviceInfoPromptEnabled,
    workspaceInfoPromptEnabled:
      provider.workspaceInfoPromptEnabled ?? settings.workspaceInfoPromptEnabled,
    temperature: provider.temperature ?? settings.temperature,
    topP: provider.topP ?? settings.topP,
    maxTokens: provider.maxTokens ?? settings.maxTokens,
    presencePenalty: provider.presencePenalty ?? settings.presencePenalty,
    frequencyPenalty: provider.frequencyPenalty ?? settings.frequencyPenalty,
    maxModelRetryCount: provider.maxModelRetryCount ?? settings.maxModelRetryCount,
  }
}


export const snapshotRect = (element: Element | null): RectSnapshot | null => {
  if (!element) {
    return null
  }

  export const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}

export const shiftRect = (rect: RectSnapshot, x: number, y: number): RectSnapshot => ({
  left: rect.left + x,
  top: rect.top + y,
  width: rect.width,
  height: rect.height,
})

export const getTravelOffset = (
  fromRect: RectSnapshot,
  toRect: RectSnapshot,
): { x: number; y: number } => {
  export const fromCenterX = fromRect.left + fromRect.width / 2
  export const fromCenterY = fromRect.top + fromRect.height / 2
  export const toCenterX = toRect.left + toRect.width / 2
  export const toCenterY = toRect.top + toRect.height / 2
  export const deltaX = toCenterX - fromCenterX
  export const deltaY = toCenterY - fromCenterY
  export const distance = Math.hypot(deltaX, deltaY)

  if (distance < 0.001) {
    return { x: 0, y: 0 }
  }

  export const travel = clamp(
    distance * TITLE_EDIT_TRANSITION_TRAVEL_FACTOR,
    TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX,
    TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX,
  )

  return {
    x: (deltaX / distance) * travel,
    y: (deltaY / distance) * travel,
  }
}

export const extractThinkBlocks = (text: string): { cleanedText: string; reasoning: string } => {
  export const reasoningChunks: string[] = []
  export const cleaned = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, captured: string) => {
    export const value = captured.trim()
    if (value.length > 0) {
      reasoningChunks.push(value)
    }
    return ''
  })
  return {
    cleanedText: cleaned.trim(),
    reasoning: reasoningChunks.join('\n\n').trim(),
  }
}


export const vibrateInteraction = (): void => {
  void Haptics.vibrate({ duration: 10 }).catch(() => {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10)
      }
    })
  })
}




export const toHydratedConversation = (
  conversation: ConversationData,
  draftText = '',
): Conversation => ({
  ...conversation,
  storageLoadState: 'hydrated',
  storedSummary: buildConversationSummary(conversation, draftText),
  storageLoadError: undefined,
})

export const createSummaryConversation = (
  summary: ChatStorageConversationSummary,
): Conversation => ({
  id: summary.id,
  title: summary.title,
  titleManuallyEdited: summary.titleManuallyEdited,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
  preferences: summary.preferences,
  transcript: [],
  storageLoadState: 'summary',
  storedSummary: summary,
})

export const createConversation = (
  transcript: TranscriptEvent[] = [],
  responseMode: ConversationResponseMode = DEFAULT_RESPONSE_MODE,
): Conversation =>
  toHydratedConversation(
    createConversationFromTranscript(createId(), transcript, {
      preferences: {
        responseMode,
      },
    }),
  )

export const toConversationSummary = (
  conversation: Conversation,
  draftText: string,
): ChatStorageConversationSummary =>
  conversation.storageLoadState === 'hydrated'
    ? buildConversationSummary(conversation, draftText)
    : {
        ...conversation.storedSummary,
        title: conversation.title,
        titleManuallyEdited: conversation.titleManuallyEdited,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        preferences: conversation.preferences,
      }

export const isPersistedConversationSummary = (
  summary: ChatStorageConversationSummary,
): boolean =>
  summary.messageCount > 0 ||
  summary.titleManuallyEdited ||
  summary.draftTextLength > 0 ||
  summary.draftAttachmentCount > 0

export const withConversationRecordTranscript = (
  conversation: Conversation,
  transcript: TranscriptEvent[],
  draftText: string,
  options?: {
    keepUpdatedAt?: boolean
  },
): Conversation =>
  toHydratedConversation(
    withConversationTranscript(conversation, transcript, options),
    draftText,
  )

export const withConversationRecordResponseMode = (
  conversation: Conversation,
  responseMode: ConversationResponseMode,
  draftText: string,
  options?: {
    keepUpdatedAt?: boolean
  },
): Conversation =>
  toHydratedConversation(
    withConversationResponseMode(conversation, responseMode, options),
    draftText,
  )


export const normalizePermissionToggles = (value: unknown): PermissionToggles => {
  if (!isRecord(value)) {
    return DEFAULT_PERMISSION_TOGGLES
  }
  return {
    location:
      typeof value.location === 'boolean' ? value.location : DEFAULT_PERMISSION_TOGGLES.location,
    camera: typeof value.camera === 'boolean' ? value.camera : DEFAULT_PERMISSION_TOGGLES.camera,
    microphone:
      typeof value.microphone === 'boolean'
        ? value.microphone
        : DEFAULT_PERMISSION_TOGGLES.microphone,
    notifications:
      typeof value.notifications === 'boolean'
        ? value.notifications
        : DEFAULT_PERMISSION_TOGGLES.notifications,
  }
}

export const queryPermissionState = async (name: string): Promise<PermissionState | null> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return null
  }
  try {
    export const status = await navigator.permissions.query({
      name: name as PermissionName,
    })
    return status.state
  } catch {
    return null
  }
}

export const requestLocationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      export const status = await Geolocation.checkPermissions()
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return true
      }
      export const requested = await Geolocation.requestPermissions()
      return requested.location !== 'denied' || requested.coarseLocation !== 'denied'
    } catch {
      return false
    }
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return false
  }
  export const stateBefore = await queryPermissionState('geolocation')
  if (stateBefore === 'granted') {
    return true
  }
  export const requestResult = await new Promise<'granted' | 'denied' | 'unknown'>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) => resolve(error.code === 1 ? 'denied' : 'unknown'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    )
  })
  if (requestResult === 'granted') {
    return true
  }
  if (requestResult === 'denied') {
    return false
  }
  return true
}

export const requestMediaPermission = async (kind: 'camera' | 'microphone'): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false
  }
  export const stateBefore = await queryPermissionState(kind)
  if (stateBefore === 'granted') {
    return true
  }
  try {
    export const constraints: MediaStreamConstraints = kind === 'camera' ? { video: true } : { audio: true }
    export const stream = await navigator.mediaDevices.getUserMedia(constraints)
    for (const track of stream.getTracks()) {
      track.stop()
    }
    return true
  } catch {
    export const stateAfter = await queryPermissionState(kind)
    return stateAfter === 'granted'
  }
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') {
    return false
  }
  if (Notification.permission === 'granted') {
    return true
  }
  if (Notification.permission === 'denied') {
    return false
  }
  try {
    export const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}


export const loadSettings = (): AppSettings => {
  try {
    if (typeof localStorage === 'undefined') {
      return createDefaultSettings()
    }

    export const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return createDefaultSettings()
    }

    export const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return createDefaultSettings()
    }

    export const shouldMigrateLegacyTagPrompts = typeof parsed.generalTagSystemPrompt !== 'string'
    export const parsedProviders = Array.isArray(parsed.providers)
      ? parsed.providers
          .map((item) => normalizeProviderConfig(item, shouldMigrateLegacyTagPrompts))
          .filter((item): item is ProviderConfig => Boolean(item))
      : []
    export const providers = parsedProviders

    export const rawTemperature = toFiniteNumber(parsed.temperature)
    export const rawTopP = toFiniteNumber(parsed.topP)
    export const rawMaxTokens = toFiniteNumber(parsed.maxTokens)
    export const rawPresencePenalty = toFiniteNumber(parsed.presencePenalty)
    export const rawFrequencyPenalty = toFiniteNumber(parsed.frequencyPenalty)
    export const rawDeleteConfirmGraceSeconds = toFiniteNumber(parsed.deleteConfirmGraceSeconds)
    export const rawConversationGroupGapMinutes = toFiniteNumber(parsed.conversationGroupGapMinutes)
    export const rawChatBlurPx = toFiniteNumber(parsed.chatBlurPx)
    export const rawEmptyStateStatsMinConversations = toFiniteNumber(parsed.emptyStateStatsMinConversations)
    export const rawMaxModelRetryCount = toFiniteNumber(parsed.maxModelRetryCount)
    export const defaultResponseMode =
      normalizeConversationResponseMode(parsed.defaultResponseMode) ??
      (typeof parsed.skillModeEnabled === 'boolean'
        ? parsed.skillModeEnabled
          ? 'tool'
          : 'text'
        : DEFAULT_SETTINGS.defaultResponseMode)
    export const currentProviderId =
      typeof parsed.currentProviderId === 'string' && parsed.currentProviderId.trim()
        ? parsed.currentProviderId
        : DEFAULT_SETTINGS.currentProviderId
    export const currentModel =
      typeof parsed.currentModel === 'string' && parsed.currentModel.trim()
        ? parsed.currentModel
        : DEFAULT_SETTINGS.currentModel
    export const storedTagSystemPrompts = migrateLegacyTagSystemPrompts(parsed, {
      legacyGlobalHandling: 'collect-deprecated',
    })
    export const deprecatedTagPrompts =
      typeof parsed.deprecatedTagPrompts === 'string' ? parsed.deprecatedTagPrompts : ''
    export const legacyGlobalTagSystemPrompt =
      storedTagSystemPrompts.legacyGlobalTagSystemPrompt ??
      (typeof parsed.generalTagSystemPrompt === 'string' &&
      parsed.generalTagSystemPrompt.trim() === DEFAULT_RUN_SYSTEM_PROMPT
        ? parsed.generalTagSystemPrompt
        : undefined)
    export const nextDeprecatedTagPrompts = legacyGlobalTagSystemPrompt
      ? upsertDeprecatedPromptBlock(deprecatedTagPrompts, {
          id: LEGACY_GLOBAL_TAG_PROMPT_BLOCK_ID,
          title: LEGACY_GLOBAL_TAG_PROMPT_BLOCK_TITLE,
          content: legacyGlobalTagSystemPrompt,
        })
      : deprecatedTagPrompts

    export const assembled = ensureValidCurrentModelSelection({
      systemPrompt:
        typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : DEFAULT_SETTINGS.systemPrompt,
      topLevelTagSystemPrompt:
        typeof parsed.topLevelTagSystemPrompt === 'string'
          ? parsed.topLevelTagSystemPrompt
          : storedTagSystemPrompts.topLevelTagSystemPrompt,
      generalTagSystemPrompt: storedTagSystemPrompts.generalTagSystemPrompt,
      readSystemPrompt: storedTagSystemPrompts.readSystemPrompt,
      skillCallSystemPrompt: storedTagSystemPrompts.skillCallSystemPrompt,
      editSystemPrompt: storedTagSystemPrompts.editSystemPrompt,
      deviceInfoPromptEnabled:
        typeof parsed.deviceInfoPromptEnabled === 'boolean'
          ? parsed.deviceInfoPromptEnabled
          : DEFAULT_SETTINGS.deviceInfoPromptEnabled,
      workspaceInfoPromptEnabled:
        typeof parsed.workspaceInfoPromptEnabled === 'boolean'
          ? parsed.workspaceInfoPromptEnabled
          : DEFAULT_SETTINGS.workspaceInfoPromptEnabled,
      deprecatedTagPrompts: nextDeprecatedTagPrompts,
      promptVersions: (
        isRecord(parsed.promptVersions)
          ? Object.fromEntries(
              Object.entries(parsed.promptVersions).filter(
                ([, v]) => typeof v === 'number',
              ),
            )
          : {}
      ) as Record<string, number>,
      themeMode: normalizeThemeMode(parsed.themeMode),
      defaultResponseMode,
      temperature:
        rawTemperature !== undefined ? clamp(rawTemperature, 0, 2) : DEFAULT_SETTINGS.temperature,
      topP: rawTopP !== undefined ? clamp(rawTopP, 0, 1) : DEFAULT_SETTINGS.topP,
      maxTokens:
        rawMaxTokens !== undefined
          ? Math.round(clamp(rawMaxTokens, 1, 8192))
          : DEFAULT_SETTINGS.maxTokens,
      presencePenalty:
        rawPresencePenalty !== undefined
          ? clamp(rawPresencePenalty, -2, 2)
          : DEFAULT_SETTINGS.presencePenalty,
      frequencyPenalty:
        rawFrequencyPenalty !== undefined
          ? clamp(rawFrequencyPenalty, -2, 2)
          : DEFAULT_SETTINGS.frequencyPenalty,
      showReasoning:
        typeof parsed.showReasoning === 'boolean'
          ? parsed.showReasoning
          : DEFAULT_SETTINGS.showReasoning,
      deleteModeHapticsEnabled:
        typeof parsed.deleteModeHapticsEnabled === 'boolean'
          ? parsed.deleteModeHapticsEnabled
          : DEFAULT_SETTINGS.deleteModeHapticsEnabled,
      firstTokenHapticsEnabled:
        typeof parsed.firstTokenHapticsEnabled === 'boolean'
          ? parsed.firstTokenHapticsEnabled
          : DEFAULT_SETTINGS.firstTokenHapticsEnabled,
      providers,
      currentProviderId,
      currentModel,
      deleteConfirmGraceSeconds:
        rawDeleteConfirmGraceSeconds !== undefined
          ? Math.round(clamp(rawDeleteConfirmGraceSeconds, 0, 600))
          : DEFAULT_SETTINGS.deleteConfirmGraceSeconds,
      conversationGroupGapMinutes:
        rawConversationGroupGapMinutes !== undefined
          ? Math.round(clamp(rawConversationGroupGapMinutes, 0, 120))
          : DEFAULT_SETTINGS.conversationGroupGapMinutes,
      chatBlurPx:
        rawChatBlurPx !== undefined
          ? Math.round(clamp(rawChatBlurPx, 0, 40))
          : DEFAULT_SETTINGS.chatBlurPx,
      autoCollapseConversations:
        typeof parsed.autoCollapseConversations === 'boolean'
          ? parsed.autoCollapseConversations
          : DEFAULT_SETTINGS.autoCollapseConversations,
      emptyStateStatsMinConversations:
        rawEmptyStateStatsMinConversations !== undefined
          ? Math.round(
              clamp(rawEmptyStateStatsMinConversations, 0, MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS),
            )
          : DEFAULT_SETTINGS.emptyStateStatsMinConversations,
      maxModelRetryCount:
        rawMaxModelRetryCount !== undefined
          ? Math.round(clamp(rawMaxModelRetryCount, 0, 10))
          : DEFAULT_SETTINGS.maxModelRetryCount,
      permissionToggles: normalizePermissionToggles(parsed.permissionToggles),
      dailyCover: normalizeDailyCoverSettings(parsed.dailyCover),
      actiNetModels: Array.isArray(parsed.actiNetModels) ? parsed.actiNetModels as ProviderModel[] : DEFAULT_SETTINGS.actiNetModels,
      otherProvidersEnabled:
        typeof parsed.otherProvidersEnabled === 'boolean'
          ? parsed.otherProvidersEnabled
          : false,
      actiNetAdvancedModelsEnabled:
        typeof parsed.actiNetAdvancedModelsEnabled === 'boolean'
          ? parsed.actiNetAdvancedModelsEnabled
          : false,
    })
    export const migrated = migratePromptVersions(
      assembled as unknown as Record<string, unknown>,
      PROMPT_DEFAULTS,
    )
    return migrated.settings as unknown as AppSettings
  } catch {
    return createDefaultSettings()
  }
}

export const createInitialChatState = (defaultResponseMode: ConversationResponseMode): LoadedChatState => {
  export const fallbackConversation = createConversation([], defaultResponseMode)
  return {
    conversations: [fallbackConversation],
    activeConversationId: fallbackConversation.id,
    draftsByConversation: {},
    historyStats: EMPTY_HISTORY_STATS,
  }
}

export const buildPersistChatState = (
  conversations: Conversation[],
  draftsByConversation: Record<string, string>,
  activeConversationId: string,
): ChatStoragePersistState => ({
  conversations: conversations.map((conversation) =>
    conversation.storageLoadState === 'hydrated'
      ? {
          kind: 'hydrated',
          conversation,
          draftText: draftsByConversation[conversation.id] ?? '',
        }
      : {
          kind: 'summary',
          summary: toConversationSummary(conversation, draftsByConversation[conversation.id] ?? ''),
        },
  ),
  activeConversationId,
})