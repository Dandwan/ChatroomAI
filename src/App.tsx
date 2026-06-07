import {
  memo,
  startTransition,
  useCallback,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type UIEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {
  authHeaders,
  buildApiUrl,
  readErrorMessage,
  requestNonStreamCompletion,
  requestStreamCompletion,
  type ApiContentPart,
  type ApiMessage,
  type ApiRole,
} from './services/chat-api'
import {
  buildApiMessagesFromTranscript,
  createConversationFromTranscript,
  createUserMessageTranscriptEvent,
  isTranscriptConversationWorkspacePlaceholder,
  normalizeConversationResponseMode,
  projectConversationMessages,
  withConversationResponseMode,
  withConversationTranscript,
  type AssistantMessageTranscriptEvent,
  type HostMessageTranscriptEvent,
  type TranscriptContentPart,
  type TranscriptEvent,
  type UserMessageTranscriptEvent,
} from './services/chat-transcript'
import {
  executeEditAction,
  executeReadAction,
  executeRunAction,
  executeSkillCall,
  materializeRunAction,
} from './services/skills/executor'
import {
  deleteSkill,
  initializeSkillHost,
  installSkillPackage,
  listSkills,
  readSkillConfig,
  setSkillEnabled,
  writeSkillConfig,
} from './services/skills/host'
import { isNativeRuntimeAvailable } from './services/skills/native-runtime'
import {
  createAgentStreamParser,
  createSkillActionPlaceholder,
  buildPromptBlocksText,
  buildRuntimeCatalogBlock,
  buildSkillsCatalogBlock,
  formatStructuredMarkdown,
  normalizeSkillAgentProtocolResponse,
  type SkillActionStreamEvent,
} from './services/skills/protocol'
import { buildEnvVarPath } from './services/skills/action-location'
import type { InternalActionLocation } from './services/skills/action-location'
import {
  DEFAULT_EDIT_SYSTEM_PROMPT,
  DEFAULT_GENERAL_TAG_SYSTEM_PROMPT,
  DEFAULT_READ_SYSTEM_PROMPT,
  DEFAULT_RUN_SYSTEM_PROMPT,
  DEFAULT_TOP_LEVEL_TAG_SYSTEM_PROMPT,
  migrateLegacyTagSystemPrompts,
  migratePromptVersions,
} from './services/skills/default-system-prompts'
import {
  DEFAULT_INFO_PROMPT_SETTINGS,
  INFO_PROMPT_DEFINITIONS,
  buildDeviceInfoPromptMarkdown,
  buildWorkspaceInfoPromptMarkdown,
  createDeviceInfoPromptSnapshot,
  createWorkspaceInfoPromptSnapshot,
  normalizeInfoPromptOverride,
  resolveWorkspaceInfoPromptPath,
  type InfoPromptDefinition,
  type InfoPromptSettingKey,
} from './services/skills/info-system-prompts'
import {
  deleteRuntime,
  ensureBundledRuntimesInstalled,
  installRuntimePackage,
  listRuntimes,
  setDefaultRuntime,
  setRuntimeEnabled,
  testRuntime,
} from './services/skills/runtime'
import type {
  EditAction,
  EditExecutionResult,
  ReadExecutionResult,
  PromptBlock,
  ReadAction,
  RunAction,
  RuntimeRecord,
  SkillCallAction,
  SkillRecord,
} from './services/skills/types'
import ChatInputBox from './components/ChatInputBox'
import DeleteConfirmDialog from './components/DeleteConfirmDialog'
import NoticeBanner from './components/NoticeBanner'
import ChatSummaryBar from './components/ChatSummaryBar'
import ChatHeader from './components/ChatHeader'
import ImageViewer, { type ImageViewerItem } from './components/ImageViewer'
import NewConversationShowcase from './components/NewConversationShowcase'
import CloudAuthForm from './components/CloudAuthForm'
import { isCloudLoggedIn, getStoredCloudAuth, clearCloudAuth, deactivateCloudAuth, verifyCloudAuth, getCloudServerUrl, tryAutoLogin, hasStoredCredentials } from './services/cloud-auth'
import { checkForUpdate, isUpdateDismissed, type UpdateInfo } from './services/app-update'
import UpdateDialog from './components/UpdateDialog'
import { getEffectiveActiNetModels } from './services/actinet-models'
import SettingsSectionHeading from './components/SettingsSectionHeading'
import SettingsInfoPromptToggleCard from './components/SettingsInfoPromptToggleCard'
import PermissionsSettings from './components/settings/PermissionsSettings'
import ProvidersSettings from './components/settings/ProvidersSettings'
import AccountsSettings from './components/settings/AccountsSettings'
import ActiNetSettings from './components/settings/ActiNetSettings'
import RuntimeSettings from './components/settings/RuntimeSettings'
import SkillsSettings from './components/settings/SkillsSettings'
import SkillConfigSettings from './components/settings/SkillConfigSettings'
import DailyCoverSettingsComponent from './components/settings/DailyCoverSettings'
import HomepageSendTransition from './components/HomepageSendTransition'
import TitleTransition from './components/TitleTransition'
import PromptEditorPanel from './components/PromptEditorPanel'
import SettingsScreen from './components/SettingsScreen'
import SettingsPopoverSelect from './components/SettingsPopoverSelect'
import { type JsonObjectValue } from './components/SkillConfigJsonEditor'
import {
  DEFAULT_DAILY_COVER_SETTINGS,
  getLocalDateKey,
  resolveBundledDailyCover,
  resolveDailyCover,
  type DailyCoverSettings,
  type ResolvedDailyCover,
} from './services/daily-cover'
import {
  selectHomepageHighlights,
  type HomepageHighlightStat,
} from './services/homepage-highlights'
import {
  appendAssistantFlowContent,
  appendAssistantFlowDivider,
  assistantFlowToPlainText,
  clearAssistantFlowRound,
  createAssistantTextFlow,
  formatSkillStepStatus,
  formatSkillStepTarget,
  markAssistantFlowRoundError,
  upsertAssistantFlowSkillNodeByToken,
  type AssistantFlowNode,
  type AssistantFlowSkillNode,
} from './utils/assistant-flow'
import {
  buildConversationSummary,
  buildHistoryStatsFromSummaries,
  deleteConversationStorage,
  getChatStatePersistenceSignature,
  loadChatIndex,
  loadConversationState,
  loadStoredAttachmentDataUrl,
  persistChatState,
  type ChatStoragePersistState,
} from './services/chat-storage'
import { compressImageDataUrl, createImageAttachments } from './utils/images'
import { createProviderModelKey, modelHealthLabel } from './utils/model-utils'
import { stripSkillParsingHintLines } from './utils/text-utils'
import { formatMs } from './utils/time-utils'
import type {
  ActiveProviderRequestSettings,
  AppSettings,
  ChatMessage,
  ChatStorageConversationSummary,
  ChatSummarySnapshot,
  CompletionResult,
  Conversation,
  ConversationDrafts,
  ConversationData,
  ConversationGroup,
  ConversationResponseMode,
  DeleteDialogState,
  EnabledModelOption,
  GlobalPromptSettingKey,
  ImageAttachment,
  LoadedChatState,
  MessageListScrollMetrics,
  ModelHealth,
  Notice,
  NumericSettingDrafts,
  NumericSettingKey,
  PendingImageAttachment,
  PendingTitleTransition,
  PromptEditorKey,
  ProviderBooleanSettingKey,
  ProviderConfig,
  ProviderModel,
  ProviderNumericSettingDrafts,
  ProviderNumericSettingKey,
  ProviderPromptSettingKey,
  RectSnapshot,
  SkillStepKind,
  TagPromptEditorKey,
  TagPromptSettingKey,
  ThemeMode,
  TitleTransitionState,
  TokenUsage,
  TurnExecutionJob,
  TurnExecutionOutcome,
} from './state/types'
import {
  CHAT_STATE_PERSIST_DEBOUNCE_MS,
  DEFAULT_DELETE_CONFIRM_GRACE_SECONDS,
  DEFAULT_CONVERSATION_GROUP_GAP_MINUTES,
  DEFAULT_AUTO_COLLAPSE_CONVERSATIONS,
  DEFAULT_CHAT_BLUR_PX,
  DEFAULT_EMPTY_STATE_STATS_MIN_CONVERSATIONS,
  DEFAULT_RESPONSE_MODE,
  EMPTY_HISTORY_STATS,
  HOMEPAGE_SEND_TRANSITION_DURATION_MS,
  PERMISSION_LABELS,
  SETTINGS_STORAGE_KEY,
  SWIPE_DELETE_TOGGLE_THRESHOLD_PX,
  SWIPE_DELETE_MAX_OFFSET_PX,
  LONG_PRESS_DELETE_MODE_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
  DRAWER_TO_SETTINGS_OPEN_DELAY_MS,
  SETTINGS_PERSIST_DEBOUNCE_MS,
  THEME_MODE_OPTIONS,
  type AppPermissionKey,
  type PermissionToggles,
} from './state/types'
import { useUIStore } from './state/ui-store'
import { useExtensionsStore } from './state/extensions-store'
import { useChatStore } from './state/chat-store'
import { useSettingsStore } from './state/settings-store'
import './App.css'
import './styles/app-editorial-redesign.css'

const buildMessageImageViewerKey = (messageId: string, imageId: string): string =>
  `message:${messageId}:${imageId}`

const buildPendingImageViewerKey = (imageId: string): string => `pending:${imageId}`

const toImageViewerItem = (
  key: string,
  image: Pick<ImageAttachment, 'name' | 'dataUrl'>,
): ImageViewerItem | null => {
  const dataUrl = image.dataUrl.trim()
  if (!dataUrl) {
    return null
  }

  return {
    key,
    name: image.name.trim() || '图片预览',
    dataUrl,
  }
}

const collectConversationImageViewerItems = (
  messages: ChatMessage[],
  pendingImages: PendingImageAttachment[],
): ImageViewerItem[] => {
  const items: ImageViewerItem[] = []

  for (const message of messages) {
    for (const image of message.images ?? []) {
      const item = toImageViewerItem(buildMessageImageViewerKey(message.id, image.id), image)
      if (item) {
        items.push(item)
      }
    }
  }

  for (const image of pendingImages) {
    const item = toImageViewerItem(buildPendingImageViewerKey(image.id), image)
    if (item) {
      items.push(item)
    }
  }

  return items
}

const applyAssignedImageStorageKeys = (
  conversations: Conversation[],
  assignments: Array<{
    conversationId: string
    messageId: string
    imageId: string
    storageKey: string
  }>,
): Conversation[] => {
  if (assignments.length === 0) {
    return conversations
  }

  return conversations.map((conversation) => {
    const conversationAssignments = assignments.filter((item) => item.conversationId === conversation.id)
    if (conversationAssignments.length === 0) {
      return conversation
    }

    let conversationChanged = false
    const nextTranscript = conversation.transcript.map((event) => {
      if (event.kind !== 'user_message') {
        return event
      }

      const messageAssignments = conversationAssignments.filter((item) => item.messageId === event.id)
      if (messageAssignments.length === 0) {
        return event
      }

      let eventChanged = false
      const nextContent = event.content.map((part) => {
        if (part.type !== 'image') {
          return part
        }
        const matched = messageAssignments.find((item) => item.imageId === part.image.id)
        if (!matched || part.image.storageKey === matched.storageKey) {
          return part
        }
        eventChanged = true
        return {
          type: 'image' as const,
          image: {
            ...part.image,
            storageKey: matched.storageKey,
          },
        }
      })

      if (!eventChanged) {
        return event
      }

      conversationChanged = true
      return {
        ...event,
        content: nextContent,
      }
    })

    return conversationChanged ? { ...conversation, transcript: nextTranscript } : conversation
  })
}

type SettingsView =
  | 'main'
  | 'tag-prompts'
  | 'accounts'
  | 'actinet'
  | 'providers'
  | 'provider-detail'
  | 'provider-tag-prompts'
  | 'skills'
  | 'skill-config'
  | 'runtimes'
  | 'permissions'
  | 'daily-cover'

const DEBUG_SKILL_ROUND_LOG_STORAGE_KEY = 'chatroom.debug.skill-round-log.v1'
const DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY = 'chatroom.debug.object-flow-log.v1'
const DEBUG_LOG_ENTRY_LIMIT = 240
const DEBUG_LOG_TEXT_LIMIT = 6000

const MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS = 9999
const TITLE_EDIT_TRANSITION_MS = 220
const TITLE_EDIT_TRANSITION_TRAVEL_FACTOR = 0.18
const TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX = 12
const TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX = 26
const MESSAGE_LIST_BOTTOM_THRESHOLD_PX = 28
const MESSAGE_LIST_INTERACTION_IDLE_MS = 140
const MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR = 1
const MESSAGE_LIST_AUTO_SCROLL_MAX_MS = 96
const MESSAGE_LIST_SMOOTH_SCROLL_MAX_SPEED_PX_PER_MS = 13.2
const MESSAGE_LIST_SMOOTH_SCROLL_EASE_DISTANCE_FACTOR = 2.1
const MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START = 0.44
const MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_FACTOR = 0.4
const MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX = 10

const getResponseModeLabel = (mode: ConversationResponseMode): string =>
  mode === 'tool' ? '技能模式' : '文本模式'

const buildHomepageModelTriggerLabel = (
  modelId: string,
  responseMode: ConversationResponseMode,
): string => {
  const trimmedModelId = modelId.trim()
  const modeLabel = getResponseModeLabel(responseMode)
  return trimmedModelId ? `${trimmedModelId} · ${modeLabel}` : `选择模型 · ${modeLabel}`
}

const createViewportRectSnapshot = (): RectSnapshot => ({
  top: 0,
  left: 0,
  width: window.innerWidth,
  height: window.innerHeight,
})

const rectToSnapshot = (rect: DOMRect): RectSnapshot => ({
  top: rect.top,
  left: rect.left,
  width: rect.width,
  height: rect.height,
})

const hasConversationStarted = (
  conversation: Pick<Conversation, 'transcript'>,
): boolean => conversation.transcript.some((event) => event.kind === 'user_message')

const resolveConversationResponseMode = (
  conversation: Pick<Conversation, 'preferences'> | null,
  defaultResponseMode: ConversationResponseMode,
): ConversationResponseMode =>
  normalizeConversationResponseMode(conversation?.preferences?.responseMode) ?? defaultResponseMode

const truncateDebugLogText = (value: string, limit = DEBUG_LOG_TEXT_LIMIT): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}…(truncated ${value.length - limit})`

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3

const applyMessageListSmoothScrollAccelerationBoost = (normalizedDistance: number): number => {
  if (normalizedDistance <= MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START) {
    return normalizedDistance
  }

  const boostProgress =
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

const resolveMessageListSmoothScrollStep = ({
  remainingDistance,
  deltaMs,
  viewportHeight,
}: {
  remainingDistance: number
  deltaMs: number
  viewportHeight: number
}): number => {
  const maxStep = MESSAGE_LIST_SMOOTH_SCROLL_MAX_SPEED_PX_PER_MS * deltaMs
  const easeDistance = Math.max(
    viewportHeight * MESSAGE_LIST_SMOOTH_SCROLL_EASE_DISTANCE_FACTOR,
    MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX,
  )
  const normalizedDistance = Math.min(1, remainingDistance / easeDistance)
  const acceleratedDistance = applyMessageListSmoothScrollAccelerationBoost(normalizedDistance)
  const easedStep = maxStep * easeOutCubic(acceleratedDistance)

  return Math.min(
    remainingDistance,
    Math.max(MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX, easedStep),
  )
}

const normalizePromptMessagesForDebug = (
  messages: ApiMessage[],
): Array<{ role: ApiRole; content: string | ApiContentPart[] }> =>
  messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string'
        ? truncateDebugLogText(message.content)
        : message.content.map((part) =>
            part.type === 'text'
              ? {
                  type: 'text' as const,
                  text: truncateDebugLogText(part.text, 1200),
                }
              : {
                  type: 'image_url' as const,
                  image_url: {
                    url: part.image_url.url.startsWith('data:')
                      ? '[data-url omitted]'
                      : truncateDebugLogText(part.image_url.url, 300),
                  },
                },
          ),
  }))

const readDebugLogEntries = (storageKey: string): Record<string, unknown>[] => {
  if (typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is Record<string, unknown> => isRecord(item))
  } catch {
    return []
  }
}

const appendDebugLogEntry = (storageKey: string, entry: Record<string, unknown>): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    const next = [...readDebugLogEntries(storageKey), entry].slice(-DEBUG_LOG_ENTRY_LIMIT)
    localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // Ignore debug log persistence errors.
  }
}

const clearDebugLogEntries = (storageKey: string): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore debug log cleanup errors.
  }
}

const buildDebugLogReportText = (
  roundLogs: Record<string, unknown>[],
  objectLogs: Record<string, unknown>[],
): string => {
  const roundTail = roundLogs.slice(-80)
  const objectTail = objectLogs.slice(-160)
  const roundText = JSON.stringify(roundTail, null, 2) ?? '[]'
  const objectText = JSON.stringify(objectTail, null, 2) ?? '[]'

  return [
    `调试日志导出：`,
    `- skill 回合日志总数：${roundLogs.length}（本次导出尾部 ${roundTail.length} 条）`,
    `- 对象流日志总数：${objectLogs.length}（本次导出尾部 ${objectTail.length} 条）`,
    '',
    '## skill 回合日志（输入/回答）',
    '```json',
    roundText,
    '```',
    '',
    '## 界面对象流日志（添加/修改）',
    '```json',
    objectText,
    '```',
  ].join('\n')
}

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

const DEFAULT_PERMISSION_TOGGLES: PermissionToggles = {
  location: false,
  camera: false,
  microphone: false,
  notifications: false,
}

const DEFAULT_SETTINGS: AppSettings = {
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
}

const PROMPT_DEFAULTS: Record<GlobalPromptSettingKey, string> = {
  systemPrompt: DEFAULT_SETTINGS.systemPrompt,
  topLevelTagSystemPrompt: DEFAULT_SETTINGS.topLevelTagSystemPrompt,
  generalTagSystemPrompt: DEFAULT_SETTINGS.generalTagSystemPrompt,
  readSystemPrompt: DEFAULT_SETTINGS.readSystemPrompt,
  skillCallSystemPrompt: DEFAULT_SETTINGS.skillCallSystemPrompt,
  editSystemPrompt: DEFAULT_SETTINGS.editSystemPrompt,
}

const createDefaultSettings = (): AppSettings => ({
  ...DEFAULT_SETTINGS,
  providers: [],
  permissionToggles: { ...DEFAULT_PERMISSION_TOGGLES },
  dailyCover: { ...DEFAULT_DAILY_COVER_SETTINGS },
})

interface DeprecatedPromptBlock {
  id: string
  title: string
  content: string
}

const LEGACY_GLOBAL_TAG_PROMPT_BLOCK_ID = 'legacy-global-tag-system-prompt'
const LEGACY_GLOBAL_TAG_PROMPT_BLOCK_TITLE = '旧版全局标签提示词'

const buildDeprecatedPromptBlockText = ({ id, title, content }: DeprecatedPromptBlock): string =>
  [
    `===== ${title} | ${id} =====`,
    content.trim(),
    `===== END ${id} =====`,
  ].join('\n')

const upsertDeprecatedPromptBlock = (raw: string, block: DeprecatedPromptBlock): string => {
  const normalizedContent = block.content.trim()
  if (!normalizedContent) {
    return raw
  }

  const normalizedRaw = raw.trim()
  const startMarker = `===== ${block.title} | ${block.id} =====`
  const endMarker = `===== END ${block.id} =====`
  if (normalizedRaw.includes(startMarker) || normalizedRaw.includes(endMarker)) {
    return raw
  }

  const nextBlock = buildDeprecatedPromptBlockText({
    ...block,
    content: normalizedContent,
  })
  return normalizedRaw ? `${normalizedRaw}\n\n${nextBlock}` : nextBlock
}

const NUMERIC_SETTING_DEFAULTS: Record<NumericSettingKey, number> = {
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

const PROVIDER_NUMERIC_LIMITS: Record<
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

const normalizeNumericSettingDraft = (key: NumericSettingKey, value: number): string =>
  value === NUMERIC_SETTING_DEFAULTS[key] ? '' : String(value)

const createNumericSettingDrafts = (settings: AppSettings): NumericSettingDrafts => ({
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

const createProviderNumericSettingDrafts = (
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

const numberFormatter = new Intl.NumberFormat('zh-CN')
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const drawerGroupDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
})
const drawerGroupTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isJsonObjectRecord = (value: unknown): value is JsonObjectValue =>
  isRecord(value) && !Array.isArray(value)

const formatJsonObject = (value: JsonObjectValue): string => JSON.stringify(value, null, 2)

const parseSkillConfigDraft = (raw: string): { value?: JsonObjectValue; error?: string } => {
  try {
    const parsed = JSON.parse(raw.trim() ? raw : '{}') as unknown
    if (!isJsonObjectRecord(parsed)) {
      return {
        error: '配置必须是 JSON 对象。',
      }
    }
    return {
      value: parsed,
    }
  } catch {
    return {
      error: '配置必须是合法的 JSON。',
    }
  }
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

const startOfLocalDay = (time: number): number => {
  const next = new Date(time)
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

const formatDrawerGroupLabel = (time: number, referenceTime = Date.now()): string => {
  const currentDay = startOfLocalDay(referenceTime)
  const targetDay = startOfLocalDay(time)

  if (targetDay === currentDay) {
    return `TODAY · ${drawerGroupTimeFormatter.format(time)}`
  }

  if (targetDay === currentDay - 24 * 60 * 60 * 1000) {
    return `YESTERDAY · ${drawerGroupTimeFormatter.format(time)}`
  }

  return `${drawerGroupDateFormatter.format(time)} · ${drawerGroupTimeFormatter.format(time)}`
}

const createProviderNameCandidate = (providers: ProviderConfig[]): string => {
  const usedNames = new Set(providers.map((provider) => provider.name.trim()).filter(Boolean))
  let index = 1
  while (true) {
    const candidate = `服务商 ${index}`
    if (!usedNames.has(candidate)) {
      return candidate
    }
    index += 1
  }
}

const createProviderConfig = (name = '服务商'): ProviderConfig => ({
  id: createId(),
  name,
  apiBaseUrl: '',
  apiKey: '',
  models: [],
})

const normalizeProviderPromptOverride = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  return value.trim().length > 0 ? value : undefined
}

const normalizeProviderNumericOverride = (
  key: ProviderNumericSettingKey,
  value: unknown,
): number | undefined => {
  const parsed = toFiniteNumber(value)
  if (parsed === undefined) {
    return undefined
  }

  const limits = PROVIDER_NUMERIC_LIMITS[key]
  const clamped = clamp(parsed, limits.minimum, limits.maximum)
  return limits.integer ? Math.round(clamped) : clamped
}

const normalizeProviderModel = (value: unknown): ProviderModel | undefined => {
  if (typeof value === 'string') {
    const id = value.trim()
    return id ? { id, enabled: false } : undefined
  }

  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined
  }

  const id = value.id.trim()
  if (!id) {
    return undefined
  }

  return {
    id,
    enabled: value.enabled === true,
  }
}

const normalizeThemeMode = (value: unknown): ThemeMode => {
  if (value === 'dark' || value === 'system' || value === 'light') {
    return value
  }
  return DEFAULT_SETTINGS.themeMode
}

// ThemeToggle extracted to src/components/ThemeToggle.tsx

const normalizeProviderModels = (value: unknown): ProviderModel[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const models: ProviderModel[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const normalized = normalizeProviderModel(item)
    if (!normalized || seen.has(normalized.id)) {
      continue
    }
    seen.add(normalized.id)
    models.push(normalized)
  }
  return models
}

const normalizeDailyCoverSettings = (value: unknown): DailyCoverSettings => {
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

const resolveProviderTagPromptOverrides = (
  value: Record<string, unknown>,
  migrateLegacyPrompts: boolean,
): Pick<ProviderConfig, TagPromptSettingKey> => {
  const hasAnyTagPromptOverride =
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

  const migrated = migrateLegacyTagSystemPrompts(value)
  return {
    topLevelTagSystemPrompt: normalizeProviderPromptOverride(value.topLevelTagSystemPrompt),
    generalTagSystemPrompt: normalizeProviderPromptOverride(migrated.generalTagSystemPrompt),
    readSystemPrompt: normalizeProviderPromptOverride(migrated.readSystemPrompt),
    skillCallSystemPrompt: normalizeProviderPromptOverride(migrated.skillCallSystemPrompt),
    editSystemPrompt: normalizeProviderPromptOverride(migrated.editSystemPrompt),
  }
}

const resolveProviderInfoPromptOverrides = (
  value: Record<string, unknown>,
): Pick<ProviderConfig, InfoPromptSettingKey> => ({
  deviceInfoPromptEnabled: normalizeInfoPromptOverride(value.deviceInfoPromptEnabled),
  workspaceInfoPromptEnabled: normalizeInfoPromptOverride(value.workspaceInfoPromptEnabled),
})

const normalizeProviderConfig = (
  value: unknown,
  migrateLegacyPrompts = false,
): ProviderConfig | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : createId()
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : '未命名服务商'
  const tagPromptOverrides = resolveProviderTagPromptOverrides(value, migrateLegacyPrompts)
  const infoPromptOverrides = resolveProviderInfoPromptOverrides(value)

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

const ACTINET_PROVIDER_ID = '__actinet__'
const ACTINET_PROVIDER_NAME = 'ActiNet'

const getEnabledModelOptions = (
  providers: ProviderConfig[],
  isActiNetLoggedIn: boolean,
  otherProvidersEnabled: boolean,
): EnabledModelOption[] => {
  const providerOptions = otherProvidersEnabled
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
    const activeModels = getEffectiveActiNetModels()
    const actiNetOptions = activeModels
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

const ensureValidCurrentModelSelection = (settings: AppSettings): AppSettings => {
  // Check ActiNet selection first
  if (settings.currentProviderId === ACTINET_PROVIDER_ID) {
    const effective = getEffectiveActiNetModels()
    const hasActiNetSelection = effective.some(
      (model) => model.id === settings.currentModel && model.enabled,
    )
    if (hasActiNetSelection) return settings
  } else if (settings.otherProvidersEnabled) {
    const hasCurrentSelection = settings.providers.some(
      (provider) =>
        provider.id === settings.currentProviderId &&
        provider.models.some((model) => model.id === settings.currentModel && model.enabled),
    )
    if (hasCurrentSelection) return settings
  }

  const fallback = getEnabledModelOptions(settings.providers, isCloudLoggedIn(), settings.otherProvidersEnabled)[0]
  return {
    ...settings,
    currentProviderId: fallback?.providerId ?? '',
    currentModel: fallback?.modelId ?? '',
  }
}

const resolveProviderRequestSettings = (settings: AppSettings): ActiveProviderRequestSettings | null => {
  // Handle ActiNet virtual provider
  if (settings.currentProviderId === ACTINET_PROVIDER_ID) {
    const cloudAuth = getStoredCloudAuth()
    if (!cloudAuth || !cloudAuth.apiKey) return null

    const effective = getEffectiveActiNetModels()
    const model = effective.find((m) => m.id === settings.currentModel && m.enabled)
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

  const provider = settings.providers.find((item) => item.id === settings.currentProviderId)
  if (!provider) {
    return null
  }

  const model = provider.models.find((item) => item.id === settings.currentModel && item.enabled)
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

const formatCompactCount = (value: number): string => {
  const absolute = Math.abs(value)
  if (absolute < 1000) {
    return numberFormatter.format(Math.round(value))
  }

  const units = [
    { value: 1_000_000_000, suffix: 'b' },
    { value: 1_000_000, suffix: 'm' },
    { value: 1_000, suffix: 'k' },
  ] as const

  const unit = units.find((item) => absolute >= item.value) ?? units[units.length - 1]
  const scaled = value / unit.value
  const digits = Math.abs(scaled) >= 10 ? 1 : 1
  return `${scaled.toFixed(digits).replace(/\.0$/, '')}${unit.suffix}`
}

const snapshotRect = (element: Element | null): RectSnapshot | null => {
  if (!element) {
    return null
  }

  const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}

const shiftRect = (rect: RectSnapshot, x: number, y: number): RectSnapshot => ({
  left: rect.left + x,
  top: rect.top + y,
  width: rect.width,
  height: rect.height,
})

const getTravelOffset = (
  fromRect: RectSnapshot,
  toRect: RectSnapshot,
): { x: number; y: number } => {
  const fromCenterX = fromRect.left + fromRect.width / 2
  const fromCenterY = fromRect.top + fromRect.height / 2
  const toCenterX = toRect.left + toRect.width / 2
  const toCenterY = toRect.top + toRect.height / 2
  const deltaX = toCenterX - fromCenterX
  const deltaY = toCenterY - fromCenterY
  const distance = Math.hypot(deltaX, deltaY)

  if (distance < 0.001) {
    return { x: 0, y: 0 }
  }

  const travel = clamp(
    distance * TITLE_EDIT_TRANSITION_TRAVEL_FACTOR,
    TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX,
    TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX,
  )

  return {
    x: (deltaX / distance) * travel,
    y: (deltaY / distance) * travel,
  }
}

const extractThinkBlocks = (text: string): { cleanedText: string; reasoning: string } => {
  const reasoningChunks: string[] = []
  const cleaned = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, captured: string) => {
    const value = captured.trim()
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

const estimateTokens = (text: string): number => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 0
  }

  const cjkCount = (normalized.match(/[\u3400-\u9fff]/g) ?? []).length
  const latinCount = normalized.length - cjkCount
  return Math.max(1, Math.ceil(cjkCount + latinCount / 4))
}

const apiMessageToText = (message: ApiMessage): string => {
  if (typeof message.content === 'string') {
    return message.content
  }
  return message.content
    .map((part) => (part.type === 'text' ? part.text : '[image]'))
    .join('\n')
    .trim()
}

const estimateUsage = (promptMessages: ApiMessage[], responseText: string): TokenUsage => {
  const promptText = promptMessages.map((message) => apiMessageToText(message)).join('\n')
  const promptTokens = estimateTokens(promptText)
  const completionTokens = estimateTokens(responseText)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

const serializeReadActionForHost = (
  action: Pick<ReadAction, 'root' | 'skill' | 'path' | 'depth' | 'startLine' | 'endLine'>,
): Record<string, unknown> => ({
  ...(action.path !== undefined ? { path: buildEnvVarPath(action.root, action.skill, action.path) } : {}),
  ...(action.depth !== undefined ? { depth: action.depth } : {}),
  ...(action.startLine !== undefined ? { startLine: action.startLine } : {}),
  ...(action.endLine !== undefined ? { endLine: action.endLine } : {}),
})

const resolveReadActionDisplayPath = (
  action: Pick<ReadAction, 'root' | 'path'>,
): string | undefined => {
  const normalizedPath = action.path?.trim()
  if (normalizedPath) {
    return normalizedPath
  }
  return undefined
}

const serializeReadResultForHost = (payload: ReadExecutionResult): Record<string, unknown> => ({
  kind: payload.kind,
  path: buildEnvVarPath(payload.root, 'skill' in payload ? payload.skill : undefined, payload.path),
  ...(payload.kind === 'list'
    ? {
        depth: payload.depth,
        entries: payload.entries,
        truncated: payload.truncated,
      }
    : payload.kind === 'stat'
      ? {
          entryType: payload.entryType,
          ...(payload.size !== undefined ? { size: payload.size } : {}),
          ...(payload.textLikely !== undefined ? { textLikely: payload.textLikely } : {}),
        }
      : {
          content: payload.content,
          lineStart: payload.lineStart,
          lineEnd: payload.lineEnd,
          truncated: payload.truncated,
        }),
})

const serializeRunActionForHost = (
  action: Pick<RunAction, 'id' | 'root' | 'skill' | 'command' | 'session' | 'waitMs'>,
): Record<string, unknown> => ({
  ...(action.id ? { id: action.id } : {}),
  ...(action.command ? { command: action.command } : {}),
  ...(action.session ? { session: action.session } : {}),
  ...(action.waitMs !== undefined ? { waitMs: action.waitMs } : {}),
})

const serializeEditActionForHost = (
  action: Pick<EditAction, 'root' | 'path' | 'createIfMissing' | 'previewContextLines' | 'edits'>,
): Record<string, unknown> => ({
  path: buildEnvVarPath(action.root, undefined, action.path),
  ...(action.createIfMissing ? { createIfMissing: true } : {}),
  ...(action.previewContextLines !== undefined ? { previewContextLines: action.previewContextLines } : {}),
  edits: action.edits,
})

const serializeEditResultForHost = (payload: EditExecutionResult): Record<string, unknown> => ({
  kind: payload.kind,
  path: buildEnvVarPath(payload.root, undefined, payload.path),
  created: payload.created,
  lineCountBefore: payload.lineCountBefore,
  lineCountAfter: payload.lineCountAfter,
  appliedEdits: payload.appliedEdits,
  preview: payload.preview,
})

const formatSkillStepResult = (payload: unknown): string =>
  formatStructuredMarkdown(payload)

const vibrateInteraction = (): void => {
  void Haptics.vibrate({ duration: 10 }).catch(() => {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10)
      }
    })
  })
}

const TRANSCRIPT_REPLAY_SYSTEM_PROMPT = `
历史上下文会以原始多轮转录的形式回放：

1. 历史 assistant 输出中可能出现 <progress>、<read>、<run>、<edit>、<final> 等标签，它们只是历史记录，不会再次执行。
2. 宿主会以 user 角色注入 <host_message>...</host_message> 作为工具结果或运行时反馈；这些内容不是用户新的自然语言输入。
3. 只有你当前正在生成的这一次回复中的动作标签会被宿主解析和执行。
`.trim()

const buildSkillAgentSystemPrompt = async (
  settings: Pick<ActiveProviderRequestSettings, PromptEditorKey | InfoPromptSettingKey>,
  skills: SkillRecord[],
  runtimes: RuntimeRecord[],
  conversationId: string,
  transcript: TranscriptEvent[],
): Promise<string> => {
  const conversationSnapshot = createConversationFromTranscript(conversationId, transcript)
  const workspacePath = settings.workspaceInfoPromptEnabled
    ? await resolveWorkspaceInfoPromptPath(conversationSnapshot.id)
    : ''
  const workspaceInfoPrompt = settings.workspaceInfoPromptEnabled
    ? buildWorkspaceInfoPromptMarkdown(
        createWorkspaceInfoPromptSnapshot(
          workspacePath,
          conversationSnapshot.createdAt,
          conversationSnapshot.updatedAt,
        ),
      )
    : ''
  const deviceInfoPrompt = settings.deviceInfoPromptEnabled
    ? buildDeviceInfoPromptMarkdown(createDeviceInfoPromptSnapshot())
    : ''
  const environmentBlocks: PromptBlock[] = [
    {
      type: 'app_policy',
      title: 'Transcript Replay Semantics',
      content: TRANSCRIPT_REPLAY_SYSTEM_PROMPT,
    },
    buildSkillsCatalogBlock(skills),
    buildRuntimeCatalogBlock(runtimes),
  ]

  return [
    settings.systemPrompt.trim(),
    settings.generalTagSystemPrompt.trim(),
    settings.topLevelTagSystemPrompt.trim(),
    settings.readSystemPrompt.trim(),
    workspaceInfoPrompt,
    settings.skillCallSystemPrompt.trim(),
    settings.editSystemPrompt.trim(),
    deviceInfoPrompt,
    buildPromptBlocksText(environmentBlocks),
  ]
    .filter(Boolean)
    .join('\n\n')
}

const parseActionExecutionPayload = (
  action: SkillCallAction | RunAction,
  stdout: string,
  stderr: string,
): Record<string, unknown> => {
  const metadata =
    action.kind === 'run'
      ? {
          id: action.id,
          command: action.command,
          session: action.session,
        }
      : {
          id: action.id,
          skill: action.skill,
          script: action.script,
        }
  const trimmedStdout = stdout.trim()
  if (!trimmedStdout) {
    return {
      ...metadata,
      stdout: '',
      stderr: stderr.trim(),
    }
  }

  try {
    const parsed = JSON.parse(trimmedStdout) as unknown
    if (isRecord(parsed)) {
      return {
        ...metadata,
        ...parsed,
        stderr: stderr.trim() || undefined,
      }
    }
  } catch {
    // Fall through to raw payload.
  }

  return {
    ...metadata,
    stdout: trimmedStdout,
    stderr: stderr.trim() || undefined,
  }
}

const toHydratedConversation = (
  conversation: ConversationData,
  draftText = '',
): Conversation => ({
  ...conversation,
  storageLoadState: 'hydrated',
  storedSummary: buildConversationSummary(conversation, draftText),
  storageLoadError: undefined,
})

const createSummaryConversation = (
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

const createConversation = (
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

const toConversationSummary = (
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

const isPersistedConversationSummary = (
  summary: ChatStorageConversationSummary,
): boolean =>
  summary.messageCount > 0 ||
  summary.titleManuallyEdited ||
  summary.draftTextLength > 0 ||
  summary.draftAttachmentCount > 0

const withConversationRecordTranscript = (
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

const withConversationRecordResponseMode = (
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

const buildUserTranscriptContent = (
  text: string,
  images: ImageAttachment[] = [],
): TranscriptContentPart[] => [
  ...(text.length > 0 ? ([{ type: 'text', text }] as const) : []),
  ...images.map((image) => ({
    type: 'image' as const,
    image,
  })),
]

const buildOutgoingImageAttachments = (
  pendingImages: PendingImageAttachment[],
): ImageAttachment[] =>
  pendingImages.map((image) => ({
    id: image.id,
    name: image.name,
    mimeType: image.mimeType,
    size: image.size,
    dataUrl: image.dataUrl,
  }))

const getUserTranscriptText = (event: UserMessageTranscriptEvent): string =>
  event.content
    .filter((part): part is Extract<TranscriptContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')

const createStaticAssistantEvent = (
  turnId: string,
  text: string,
  model?: string,
): AssistantMessageTranscriptEvent => ({
  kind: 'assistant_message',
  id: createId(),
  turnId,
  createdAt: Date.now(),
  rawText: text,
  assistantFlow: text ? createAssistantTextFlow(text, { createId }) : undefined,
  model,
})

const normalizeLatexDelimiters = (text: string): string =>
  text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, captured: string) => `$$${captured}$$`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, captured: string) => `$${captured}$`)

const normalizePermissionToggles = (value: unknown): PermissionToggles => {
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

const queryPermissionState = async (name: string): Promise<PermissionState | null> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return null
  }
  try {
    const status = await navigator.permissions.query({
      name: name as PermissionName,
    })
    return status.state
  } catch {
    return null
  }
}

const requestLocationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions()
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return true
      }
      const requested = await Geolocation.requestPermissions()
      return requested.location !== 'denied' || requested.coarseLocation !== 'denied'
    } catch {
      return false
    }
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return false
  }
  const stateBefore = await queryPermissionState('geolocation')
  if (stateBefore === 'granted') {
    return true
  }
  const requestResult = await new Promise<'granted' | 'denied' | 'unknown'>((resolve) => {
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

const requestMediaPermission = async (kind: 'camera' | 'microphone'): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false
  }
  const stateBefore = await queryPermissionState(kind)
  if (stateBefore === 'granted') {
    return true
  }
  try {
    const constraints: MediaStreamConstraints = kind === 'camera' ? { video: true } : { audio: true }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    for (const track of stream.getTracks()) {
      track.stop()
    }
    return true
  } catch {
    const stateAfter = await queryPermissionState(kind)
    return stateAfter === 'granted'
  }
}

const requestNotificationPermission = async (): Promise<boolean> => {
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
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

const applyPermissionGatesToSkillCall = (
  action: SkillCallAction,
  permissionToggles: PermissionToggles,
): SkillCallAction => {
  if (action.skill !== 'device-info') {
    return action
  }
  if (permissionToggles.location) {
    return action
  }
  const argv = Array.isArray(action.argv) ? [...action.argv] : []
  if (!argv.includes('--no-location')) {
    argv.push('--no-location')
  }
  return {
    ...action,
    argv,
  }
}

const applyPermissionGatesToRun = (
  action: RunAction,
  permissionToggles: PermissionToggles,
): RunAction => {
  if (action.root !== 'skill' || action.skill !== 'device-info') {
    return action
  }
  if (permissionToggles.location) {
    return action
  }
  const command = action.command?.trim()
  if (!command || /\s--no-location(?:\s|$)/.test(` ${command} `)) {
    return action
  }
  return {
    ...action,
    command: `${command} --no-location`,
  }
}

const loadSettings = (): AppSettings => {
  try {
    if (typeof localStorage === 'undefined') {
      return createDefaultSettings()
    }

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return createDefaultSettings()
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return createDefaultSettings()
    }

    const shouldMigrateLegacyTagPrompts = typeof parsed.generalTagSystemPrompt !== 'string'
    const parsedProviders = Array.isArray(parsed.providers)
      ? parsed.providers
          .map((item) => normalizeProviderConfig(item, shouldMigrateLegacyTagPrompts))
          .filter((item): item is ProviderConfig => Boolean(item))
      : []
    const providers = parsedProviders

    const rawTemperature = toFiniteNumber(parsed.temperature)
    const rawTopP = toFiniteNumber(parsed.topP)
    const rawMaxTokens = toFiniteNumber(parsed.maxTokens)
    const rawPresencePenalty = toFiniteNumber(parsed.presencePenalty)
    const rawFrequencyPenalty = toFiniteNumber(parsed.frequencyPenalty)
    const rawDeleteConfirmGraceSeconds = toFiniteNumber(parsed.deleteConfirmGraceSeconds)
    const rawConversationGroupGapMinutes = toFiniteNumber(parsed.conversationGroupGapMinutes)
    const rawChatBlurPx = toFiniteNumber(parsed.chatBlurPx)
    const rawEmptyStateStatsMinConversations = toFiniteNumber(parsed.emptyStateStatsMinConversations)
    const rawMaxModelRetryCount = toFiniteNumber(parsed.maxModelRetryCount)
    const defaultResponseMode =
      normalizeConversationResponseMode(parsed.defaultResponseMode) ??
      (typeof parsed.skillModeEnabled === 'boolean'
        ? parsed.skillModeEnabled
          ? 'tool'
          : 'text'
        : DEFAULT_SETTINGS.defaultResponseMode)
    const currentProviderId =
      typeof parsed.currentProviderId === 'string' && parsed.currentProviderId.trim()
        ? parsed.currentProviderId
        : DEFAULT_SETTINGS.currentProviderId
    const currentModel =
      typeof parsed.currentModel === 'string' && parsed.currentModel.trim()
        ? parsed.currentModel
        : DEFAULT_SETTINGS.currentModel
    const storedTagSystemPrompts = migrateLegacyTagSystemPrompts(parsed, {
      legacyGlobalHandling: 'collect-deprecated',
    })
    const deprecatedTagPrompts =
      typeof parsed.deprecatedTagPrompts === 'string' ? parsed.deprecatedTagPrompts : ''
    const legacyGlobalTagSystemPrompt =
      storedTagSystemPrompts.legacyGlobalTagSystemPrompt ??
      (typeof parsed.generalTagSystemPrompt === 'string' &&
      parsed.generalTagSystemPrompt.trim() === DEFAULT_RUN_SYSTEM_PROMPT
        ? parsed.generalTagSystemPrompt
        : undefined)
    const nextDeprecatedTagPrompts = legacyGlobalTagSystemPrompt
      ? upsertDeprecatedPromptBlock(deprecatedTagPrompts, {
          id: LEGACY_GLOBAL_TAG_PROMPT_BLOCK_ID,
          title: LEGACY_GLOBAL_TAG_PROMPT_BLOCK_TITLE,
          content: legacyGlobalTagSystemPrompt,
        })
      : deprecatedTagPrompts

    const assembled = ensureValidCurrentModelSelection({
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
    })
    const migrated = migratePromptVersions(
      assembled as unknown as Record<string, unknown>,
      PROMPT_DEFAULTS,
    )
    return migrated.settings as unknown as AppSettings
  } catch {
    return createDefaultSettings()
  }
}

const createInitialChatState = (defaultResponseMode: ConversationResponseMode): LoadedChatState => {
  const fallbackConversation = createConversation([], defaultResponseMode)
  return {
    conversations: [fallbackConversation],
    activeConversationId: fallbackConversation.id,
    draftsByConversation: {},
    historyStats: EMPTY_HISTORY_STATS,
  }
}

const buildPersistChatState = (
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

const MarkdownMessage = memo(({ text }: { text: string }) => {
  const normalizedText = useMemo(() => normalizeLatexDelimiters(text), [text])

  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {normalizedText}
    </ReactMarkdown>
  )
})

MarkdownMessage.displayName = 'MarkdownMessage'

const ChatScrollPlaceholder = memo(
  ({ heightPx, position }: { heightPx: number; position: 'top' | 'bottom' }) => {
    if (heightPx <= 0) {
      return null
    }

    return (
      <div
        aria-hidden="true"
        className={`chat-scroll-placeholder chat-scroll-placeholder--${position}`}
        style={{ height: `${heightPx}px` }}
      />
    )
  },
)

ChatScrollPlaceholder.displayName = 'ChatScrollPlaceholder'

const MARKDOWN_COMPONENTS: Components = {
  img: ({ node, ...props }) => {
    void node
    return (
      <span className="markdown-media-scroll">
        <img {...props} />
      </span>
    )
  },
  table: ({ node, ...props }) => {
    void node
    return (
      <div className="markdown-table-scroll">
        <table {...props} />
      </div>
    )
  },
}

function App() {
  const initialSettingsRef = useRef<AppSettings | null>(null)
  if (!initialSettingsRef.current) {
    initialSettingsRef.current = loadSettings()
  }

  const initialStateRef = useRef<LoadedChatState | null>(null)
  if (!initialStateRef.current) {
    initialStateRef.current = createInitialChatState(initialSettingsRef.current.defaultResponseMode)
  }

  // Initialize zustand stores once from lazy-loaded initial state.
  const storeInitRef = useRef(false)
  if (!storeInitRef.current) {
    storeInitRef.current = true
    const initialSettings = initialSettingsRef.current as AppSettings
    const initialChatState = initialStateRef.current
    useSettingsStore.setState({
      settings: initialSettings,
      numericSettingDrafts: createNumericSettingDrafts(initialSettings),
      providerNumericSettingDrafts: createProviderNumericSettingDrafts(null),
    })
    useChatStore.setState({
      conversations: initialChatState.conversations,
      activeConversationId: initialChatState.activeConversationId,
      draftsByConversation: initialChatState.draftsByConversation,
      historyStats: initialChatState.historyStats,
    })
  }

  // ── Settings store ──
  const settings = useSettingsStore((s) => s.settings)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const numericSettingDrafts = useSettingsStore((s) => s.numericSettingDrafts)
  const setNumericSettingDrafts = useSettingsStore((s) => s.setNumericSettingDrafts)
  const providerNumericSettingDrafts = useSettingsStore((s) => s.providerNumericSettingDrafts)
  const setProviderNumericSettingDrafts = useSettingsStore((s) => s.setProviderNumericSettingDrafts)

  // ── Chat store ──
  const conversations = useChatStore((s) => s.conversations)
  const setConversations = useChatStore((s) => s.setConversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId)
  const draftsByConversation = useChatStore((s) => s.draftsByConversation)
  const setDraftsByConversation = useChatStore((s) => s.setDraftsByConversation)
  const historyStats = useChatStore((s) => s.historyStats)
  const setHistoryStats = useChatStore((s) => s.setHistoryStats)
  const chatStateLoadError = useChatStore((s) => s.chatStateLoadError)
  const setChatStateLoadError = useChatStore((s) => s.setChatStateLoadError)
  const chatStateLoaded = useChatStore((s) => s.chatStateLoaded)
  const setChatStateLoaded = useChatStore((s) => s.setChatStateLoaded)
  const pendingImages = useChatStore((s) => s.pendingImages)
  const setPendingImages = useChatStore((s) => s.setPendingImages)
  const pendingImageCompressionTaskIdRef = useRef<Record<string, number>>({})

  // ── UI store: animated visibility ──
  const settingsMounted = useUIStore((s) => s.settingsMounted)
  const settingsVisible = useUIStore((s) => s.settingsVisible)
  const openSettings = useCallback((): void => {
    useUIStore.getState().setSettingsVisibility(true, true)
  }, [])
  const closeSettings = useCallback((): void => {
    useUIStore.getState().setSettingsVisibility(false, false)
  }, [])
  const drawerMounted = useUIStore((s) => s.drawerMounted)
  const drawerVisible = useUIStore((s) => s.drawerVisible)
  const openDrawer = useCallback((): void => {
    useUIStore.getState().setDrawerVisibility(true, false)
    if (drawerAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(drawerAnimationFrameRef.current)
    }
    drawerAnimationFrameRef.current = window.requestAnimationFrame(() => {
      drawerAnimationFrameRef.current = null
      useUIStore.getState().setDrawerVisibility(true, true)
    })
  }, [])
  const closeDrawer = useCallback((): void => {
    if (drawerAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(drawerAnimationFrameRef.current)
      drawerAnimationFrameRef.current = null
    }
    useUIStore.getState().setDrawerVisibility(true, false)
  }, [])
  const modelMenuMounted = useUIStore((s) => s.modelMenuMounted)
  const modelMenuVisible = useUIStore((s) => s.modelMenuVisible)
  const openModelMenu = useCallback((): void => {
    useUIStore.getState().setModelMenuVisibility(true, false)
    if (modelMenuAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(modelMenuAnimationFrameRef.current)
    }
    modelMenuAnimationFrameRef.current = window.requestAnimationFrame(() => {
      modelMenuAnimationFrameRef.current = null
      useUIStore.getState().setModelMenuVisibility(true, true)
    })
  }, [])
  const closeModelMenu = useCallback((): void => {
    if (modelMenuAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(modelMenuAnimationFrameRef.current)
      modelMenuAnimationFrameRef.current = null
    }
    useUIStore.getState().setModelMenuVisibility(true, false)
  }, [])
  const imageViewerMounted = useUIStore((s) => s.imageViewerMounted)
  const imageViewerVisible = useUIStore((s) => s.imageViewerVisible)
  const showImageViewerOverlay = useCallback((): void => {
    useUIStore.getState().setImageViewerVisibility(true, true)
  }, [])
  const hideImageViewerOverlay = useCallback((): void => {
    useUIStore.getState().setImageViewerVisibility(false, false)
  }, [])
  const scrollToBottomButtonMounted = useUIStore((s) => s.scrollToBottomButtonMounted)
  const scrollToBottomButtonVisible = useUIStore((s) => s.scrollToBottomButtonVisible)
  const showScrollToBottomButton = useCallback((): void => {
    useUIStore.getState().setScrollToBottomButtonVisibility(true, true)
  }, [])
  const hideScrollToBottomButton = useCallback((): void => {
    useUIStore.getState().setScrollToBottomButtonVisibility(false, false)
  }, [])

  // ── UI store: settings navigation ──
  const settingsView = useUIStore((s) => s.settingsView)
  const providerDetailTargetId = useUIStore((s) => s.providerDetailTargetId)
  const setProviderDetailTargetId = useUIStore((s) => s.setProviderDetailTargetId)
  const manualModelDraft = useUIStore((s) => s.manualModelDraft)
  const setManualModelDraft = useUIStore((s) => s.setManualModelDraft)
  const providerModelSearch = useUIStore((s) => s.providerModelSearch)
  const setProviderModelSearch = useUIStore((s) => s.setProviderModelSearch)
  const isFetchingModelsByProviderId = useUIStore((s) => s.isFetchingModelsByProviderId)
  const setIsFetchingModelsByProviderId = useUIStore((s) => s.setIsFetchingModelsByProviderId)

  // ── UI store: prompt editors ──
  const openPromptEditors = useUIStore((s) => s.openPromptEditors)
  const openProviderPromptEditors = useUIStore((s) => s.openProviderPromptEditors)
  const setOpenProviderPromptEditors = useUIStore((s) => s.setOpenProviderPromptEditors)

  // ── UI store: delete / edit / notice / sending ──
  const deleteModeEnabled = useUIStore((s) => s.deleteModeEnabled)
  const setDeleteModeEnabled = useUIStore((s) => s.setDeleteModeEnabled)
  const deleteDialog = useUIStore((s) => s.deleteDialog)
  const deleteDialogConversationId = deleteDialog?.type === 'conversation' ? deleteDialog.targetId : null
  const deleteDialogProviderId = deleteDialog?.type === 'provider' ? deleteDialog.targetId : null
  const deleteDialogSkillId = deleteDialog?.type === 'skill' ? deleteDialog.targetId : null
  const deleteDialogRuntimeId = deleteDialog?.type === 'runtime' ? deleteDialog.targetId : null
  const editingMessageId = useUIStore((s) => s.editingMessageId)
  const setEditingMessageId = useUIStore((s) => s.setEditingMessage)
  const editingText = useUIStore((s) => s.editingText)
  const setEditingText = useUIStore((s) => s.setEditingText)
  const imageViewer = useUIStore((s) => s.imageViewer)
  const openReasoningByMessage = useUIStore((s) => s.openReasoningByMessage)
  const openSkillResultByStep = useUIStore((s) => s.openSkillResultByStep)
  const isEditingTitle = useUIStore((s) => s.isEditingTitle)
  const titleDraft = useUIStore((s) => s.titleDraft)
  const titleTransition = useUIStore((s) => s.titleTransition)
  const setTitleTransition = useUIStore((s) => s.setTitleTransition)
  const setTitleDraft = useUIStore((s) => s.setTitleDraft)
  const setIsEditingTitle = useUIStore((s) => s.setIsEditingTitle)
  const setImageViewer = useUIStore((s) => s.setImageViewer)
  const setHomepageSendTransition = useUIStore((s) => s.setHomepageSendTransition)
  const notice = useUIStore((s) => s.notice)
  const setNotice = useUIStore((s) => s.setNotice)
  const isSending = useUIStore((s) => s.isSending)
  const setIsSending = useUIStore((s) => s.setIsSending)
  const activeRequestConversationId = useUIStore((s) => s.activeRequestConversationId)
  const setActiveRequestConversationId = useUIStore((s) => s.setActiveRequestConversationId)

  // ── UI store: drawer ──
  const collapsedConversationGroups = useUIStore((s) => s.collapsedConversationGroups)
  const setCollapsedConversationGroups = useUIStore((s) => s.setCollapsedConversationGroups)
  const swipingConversationId = useUIStore((s) => s.swipingConversationId)
  const setSwipingConversationId = useUIStore((s) => s.setSwipingConversation)
  const swipeOffsetX = useUIStore((s) => s.swipeOffsetX)
  const setSwipeOffsetX = useUIStore((s) => s.setSwipeOffsetX)

  // ── UI store: scroll ──
  const isAutoFollowEnabled = useUIStore((s) => s.isAutoFollowEnabled)
  const setIsAutoFollowEnabled = useUIStore((s) => s.setIsAutoFollowEnabled)
  const messageListScrollMetrics = useUIStore((s) => s.messageListScrollMetrics)
  const setMessageListScrollMetrics = useUIStore((s) => s.setMessageListScrollMetrics)
  const activeChatScrollInsets = useUIStore((s) => s.activeChatScrollInsets)
  const setActiveChatScrollInsets = useUIStore((s) => s.setActiveChatScrollInsets)

  // ── UI store: transitions ──
  const homepageSendTransition = useUIStore((s) => s.homepageSendTransition)

  // ── UI store: permissions ──
  const requestingPermissionByKey = useUIStore((s) => s.requestingPermissionByKey)
  const setRequestingPermissionByKey = useUIStore((s) => s.setRequestingPermissionByKey)

  // ── Extensions store ──
  const skillRecords = useExtensionsStore((s) => s.skillRecords)
  const setSkillRecords = useExtensionsStore((s) => s.setSkillRecords)
  const runtimeRecords = useExtensionsStore((s) => s.runtimeRecords)
  const setRuntimeRecords = useExtensionsStore((s) => s.setRuntimeRecords)
  const isLoadingExtensions = useExtensionsStore((s) => s.isLoadingExtensions)
  const setIsLoadingExtensions = useExtensionsStore((s) => s.setIsLoadingExtensions)
  const isInstallingSkillArchive = useExtensionsStore((s) => s.isInstallingSkillArchive)
  const setIsInstallingSkillArchive = useExtensionsStore((s) => s.setIsInstallingSkillArchive)
  const isInstallingRuntimeArchive = useExtensionsStore((s) => s.isInstallingRuntimeArchive)
  const setIsInstallingRuntimeArchive = useExtensionsStore((s) => s.setIsInstallingRuntimeArchive)
  const skillConfigTargetId = useExtensionsStore((s) => s.skillConfigTargetId)
  const setSkillConfigTargetId = useExtensionsStore((s) => s.setSkillConfigTargetId)
  const skillConfigDraft = useExtensionsStore((s) => s.skillConfigDraft)
  const setSkillConfigDraft = useExtensionsStore((s) => s.setSkillConfigDraft)
  const skillConfigValue = useExtensionsStore((s) => s.skillConfigValue)
  const setSkillConfigValue = useExtensionsStore((s) => s.setSkillConfigValue)
  const skillConfigRawError = useExtensionsStore((s) => s.skillConfigRawError)
  const setSkillConfigRawError = useExtensionsStore((s) => s.setSkillConfigRawError)
  const isLoadingSkillConfig = useExtensionsStore((s) => s.isLoadingSkillConfig)
  const setIsLoadingSkillConfig = useExtensionsStore((s) => s.setIsLoadingSkillConfig)
  const isSavingSkillConfig = useExtensionsStore((s) => s.isSavingSkillConfig)
  const setIsSavingSkillConfig = useExtensionsStore((s) => s.setIsSavingSkillConfig)
  const modelHealth = useExtensionsStore((s) => s.modelHealth)
  const setModelHealth = useExtensionsStore((s) => s.setModelHealth)

  const [resolvedDailyCover, setResolvedDailyCover] = useState<ResolvedDailyCover | null>(() =>
    resolveBundledDailyCover(getLocalDateKey()),
  )
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [cloudAuthMode, setCloudAuthMode] = useState<'none' | 'login' | 'register'>('none')
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updatingNow, setUpdatingNow] = useState(false) // eslint-disable-line @typescript-eslint/no-unused-vars

  const handleInstallUpdate = useCallback(async (blob: Blob, fileName: string) => {
    setUpdatingNow(true)
    try {
      // Try native install path (Android/Capacitor)
      const bridge = (window as any).SkillRuntimePlugin
      if (bridge?.installApk) {
        // Save the blob to a file path that the native side can access
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        await bridge.installApk({ apkData: base64, fileName })
      } else {
        // Fallback: trigger browser download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      setShowUpdateDialog(false)
    } catch (err) {
      console.error('[update] Install failed', err)
    } finally {
      setUpdatingNow(false)
    }
  }, [])

  const handleManualUpdateCheck = useCallback(async () => {
    if (!isCloudLoggedIn()) return
    const update = await checkForUpdate(getCloudServerUrl())
    if (update) {
      setPendingUpdate(update)
      setShowUpdateDialog(true)
    } else {
      // No update available — could show a notice
      console.log('[update] No update available')
    }
  }, [])
  // 强制刷新计数器 — 当 localStorage 中的 auth 状态被异步修改后
  // (verifyCloudAuth/deactivateCloudAuth/tryAutoLogin)，需要触发重新渲染以
  // 让 cloudLoggedIn = isCloudLoggedIn() 重新从 localStorage 读取最新值。
  const [_authVersion, setAuthVersion] = useState(0)

  // ── Startup: verify ActiNet connectivity or auto-login ──
  useEffect(() => {
    let cancelled = false

    if (isCloudLoggedIn()) {
      // 已有 token — 验证连通性
      verifyCloudAuth().then((valid) => {
        if (cancelled) return
        if (!valid) {
          console.warn('[actinet] Startup connectivity check failed — deactivating auth (credentials preserved)')
          deactivateCloudAuth()
          setAuthVersion(v => v + 1)
        }
      })
    } else if (hasStoredCredentials()) {
      // 无 token 但有凭据 — 尝试自动登录
      tryAutoLogin().then((success) => {
        if (cancelled) return
        if (success) {
          console.log('[actinet] Auto-login succeeded')
          // 强制刷新以让 cloudLoggedIn 重新从 localStorage 读取
          setCloudAuthMode('none')
          setAuthVersion(v => v + 1)
          // ── Check for app update ──
          checkForUpdate(getCloudServerUrl()).then((update) => {
            if (update && !isUpdateDismissed(update.version_code)) {
              setPendingUpdate(update)
              setShowUpdateDialog(true)
            }
          })
        }
        // 失败时静默 — 主页自然显示 CloudAuthForm
      })
    }

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Delete dialog helpers (unified store interface)
  const openDeleteDialog = useCallback((dialog: DeleteDialogState): void => {
    useUIStore.getState().openDeleteDialog(dialog)
  }, [])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const skillArchiveInputRef = useRef<HTMLInputElement | null>(null)
  const runtimeArchiveInputRef = useRef<HTMLInputElement | null>(null)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const titleTextRef = useRef<HTMLSpanElement | null>(null)
  const titleRenameButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const titleActionsRef = useRef<HTMLDivElement | null>(null)
  const messageListRef = useRef<HTMLElement | null>(null)
  const chatContentStackRef = useRef<HTMLDivElement | null>(null)
  const chatHeaderRef = useRef<HTMLElement | null>(null)
  const homepageShowcaseRef = useRef<HTMLElement | null>(null)
  const chatSummaryBarRef = useRef<HTMLElement | null>(null)
  const composerFooterRef = useRef<HTMLElement | null>(null)
  const settingsPageRef = useRef<HTMLElement | null>(null)
  const conversationListRef = useRef<HTMLDivElement | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const storageWarningShownRef = useRef(false)
  const conversationPersistTaskIdRef = useRef(0)
  const chatStateSignatureRef = useRef('')
  const activeConversationIdRef = useRef(initialStateRef.current.activeConversationId)
  const draftsByConversationRef = useRef<ConversationDrafts>(initialStateRef.current.draftsByConversation)
  const hydratingImageKeysRef = useRef<Set<string>>(new Set())
  const settingsScrollByViewRef = useRef<Record<SettingsView, number>>({
    main: 0,
    'tag-prompts': 0,
    accounts: 0,
    actinet: 0,
    providers: 0,
    'provider-detail': 0,
    'provider-tag-prompts': 0,
    skills: 0,
    'skill-config': 0,
    runtimes: 0,
    permissions: 0,
    'daily-cover': 0,
  })
  const drawerScrollTopRef = useRef(0)
  const titleTransitionPrepRef = useRef<PendingTitleTransition | null>(null)
  const titleTransitionAnimationFrameRef = useRef<number | null>(null)
  const titleTransitionTimerRef = useRef<number | null>(null)
  const messageListInteractionTimerRef = useRef<number | null>(null)
  const messageListUserInteractingRef = useRef(false)
  const messageListProgrammaticScrollRef = useRef(false)
  const messageListProgrammaticScrollAnimationFrameRef = useRef<number | null>(null)
  const messageListSmoothScrollAnimationFrameRef = useRef<number | null>(null)
  const messageListSmoothScrollInProgressRef = useRef(false)
  const pendingMessageListBottomResetRef = useRef(true)
  const hasAutoCollapsedConversationGroupsRef = useRef(false)
  const conversationGroupElementRefs = useRef<Record<string, HTMLElement | null>>({})
  const deleteConfirmBypassUntilRef = useRef(0)
  const conversationSwipeStartRef = useRef<{
    conversationId: string
    pointerId: number
    x: number
    y: number
    thresholdReached: boolean
    longPressTriggered: boolean
    longPressTimerId: number | null
  } | null>(null)
  const ignoreNextConversationClickRef = useRef<string | null>(null)
  const drawerAnimationFrameRef = useRef<number | null>(null)
  const modelMenuAnimationFrameRef = useRef<number | null>(null)
  const openSettingsAfterDrawerTimerRef = useRef<number | null>(null)
  const queuedAssistantStreamDeltaRef = useRef<{
    conversationId: string
    assistantId: string
    content: string
    reasoning: string
    roundId?: string
  } | null>(null)
  const queuedAssistantStreamDeltaAnimationFrameRef = useRef<number | null>(null)
  const lastSkillRoundLogKeyRef = useRef<string>('')
  const lastObjectFlowLogKeyRef = useRef<string>('')
  const queuedTurnExecutionsRef = useRef<TurnExecutionJob[]>([])
  const processingTurnQueueRef = useRef(false)

  const closeImageViewer = useCallback((): void => {
    hideImageViewerOverlay()
  }, [hideImageViewerOverlay])

  const appendSkillRoundLog = useCallback(
    (payload: Record<string, unknown>, dedupeKey?: string): void => {
      if (dedupeKey && lastSkillRoundLogKeyRef.current === dedupeKey) {
        return
      }
      if (dedupeKey) {
        lastSkillRoundLogKeyRef.current = dedupeKey
      }
      const entry = {
        timestamp: new Date().toISOString(),
        ...payload,
      }
      appendDebugLogEntry(DEBUG_SKILL_ROUND_LOG_STORAGE_KEY, entry)
      console.info(`[debug][skill-round] ${JSON.stringify(entry)}`)
    },
    [],
  )

  const appendObjectFlowLog = useCallback(
    (payload: Record<string, unknown>, dedupeKey?: string): void => {
      if (dedupeKey && lastObjectFlowLogKeyRef.current === dedupeKey) {
        return
      }
      if (dedupeKey) {
        lastObjectFlowLogKeyRef.current = dedupeKey
      }
      const entry = {
        timestamp: new Date().toISOString(),
        ...payload,
      }
      appendDebugLogEntry(DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY, entry)
      console.info(`[debug][object-flow] ${JSON.stringify(entry)}`)
    },
    [],
  )

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ??
      conversations[0] ??
      null,
    [conversations, activeConversationId],
  )
  const activeConversationResponseMode = useMemo(
    () => resolveConversationResponseMode(activeConversation, settings.defaultResponseMode),
    [activeConversation, settings.defaultResponseMode],
  )
  const activeConversationModeLocked = useMemo(
    () => (activeConversation ? hasConversationStarted(activeConversation) : false),
    [activeConversation],
  )
  const setConversationsState = useCallback(
    (
      nextState:
        | Conversation[]
        | ((previous: Conversation[]) => Conversation[]),
    ): void => {
      const next =
        typeof nextState === 'function'
          ? (nextState as (previous: Conversation[]) => Conversation[])(useChatStore.getState().conversations)
          : nextState
      setConversations(next)
    },
    [],
  )

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    draftsByConversationRef.current = draftsByConversation
  }, [draftsByConversation])

  const skillConfigTarget = useMemo(
    () =>
      skillConfigTargetId
        ? skillRecords.find((skill) => skill.id === skillConfigTargetId) ?? null
        : null,
    [skillConfigTargetId, skillRecords],
  )
  const nativeRuntimeAvailable = isNativeRuntimeAvailable()
  const deleteDialogConversation = useMemo(
    () =>
      deleteDialogConversationId
        ? conversations.find((conversation) => conversation.id === deleteDialogConversationId) ?? null
        : null,
    [conversations, deleteDialogConversationId],
  )
  const deleteDialogProvider = useMemo(
    () =>
      deleteDialogProviderId
        ? settings.providers.find((provider) => provider.id === deleteDialogProviderId) ?? null
        : null,
    [deleteDialogProviderId, settings.providers],
  )
  const deleteDialogSkill = useMemo(
    () =>
      deleteDialogSkillId
        ? skillRecords.find((skill) => skill.id === deleteDialogSkillId) ?? null
        : null,
    [deleteDialogSkillId, skillRecords],
  )
  const deleteDialogRuntime = useMemo(
    () =>
      deleteDialogRuntimeId
        ? runtimeRecords.find((runtime) => runtime.id === deleteDialogRuntimeId) ?? null
        : null,
    [deleteDialogRuntimeId, runtimeRecords],
  )
  const projectedMessagesByConversationId = useMemo(
    () =>
      new Map(
        conversations.map((conversation) => [conversation.id, projectConversationMessages(conversation)]),
      ),
    [conversations],
  )
  const activeMessages = useMemo(
    () => (activeConversation ? projectedMessagesByConversationId.get(activeConversation.id) ?? [] : []),
    [activeConversation, projectedMessagesByConversationId],
  )
  const conversationSummariesById = useMemo(
    () =>
      new Map(
        conversations.map((conversation) => [
          conversation.id,
          toConversationSummary(conversation, draftsByConversation[conversation.id] ?? ''),
        ]),
      ),
    [conversations, draftsByConversation],
  )
  const currentHistoryStats = useMemo(
    () =>
      buildHistoryStatsFromSummaries(
        Array.from(conversationSummariesById.values()).filter((summary) => isPersistedConversationSummary(summary)),
      ),
    [conversationSummariesById],
  )
  const effectiveHistoryStats = chatStateLoaded ? currentHistoryStats : historyStats
  const hasActiveMessages = activeMessages.length > 0
  const isActiveConversationLoading =
    activeConversation?.storageLoadState === 'summary' || activeConversation?.storageLoadState === 'hydrating'
  const isActiveConversationLoadError = activeConversation?.storageLoadState === 'error'
  const isHomepageEmptyState =
    activeConversation?.storageLoadState === 'hydrated' &&
    activeMessages.length === 0
  const cloudLoggedIn = isCloudLoggedIn()
  const hasProviders = settings.providers.length > 0
  const showCloudAuthOnHomepage =
    isHomepageEmptyState &&
    ((!cloudLoggedIn && !hasProviders) || cloudAuthMode !== 'none')
  const isCloudAuthRegisterMode = cloudAuthMode === 'register'
  const displayConversationTitle = activeConversation?.title ?? '新对话'
  const shouldShowTitleRenameButton = activeConversation !== null && !isHomepageEmptyState
  const shouldShowHomepageBackground = isHomepageEmptyState && resolvedDailyCover !== null
  const homepageBackgroundStyle = shouldShowHomepageBackground && resolvedDailyCover
    ? ({ '--homepage-cover-image': `url("${resolvedDailyCover.imageUrl}")` } as CSSProperties)
    : undefined
  const shouldShowChatBackground = !isHomepageEmptyState
  const appShellStyle = {
    '--homepage-send-transition-duration': `${HOMEPAGE_SEND_TRANSITION_DURATION_MS}ms`,
    '--homepage-send-transition-easing': 'cubic-bezier(0.22, 1, 0.36, 1)',
    ...(homepageBackgroundStyle ?? {}),
  } as CSSProperties
  const draft = activeConversation ? draftsByConversation[activeConversation.id] ?? '' : ''
  const imageViewerItems = useMemo(
    () => collectConversationImageViewerItems(activeMessages, pendingImages),
    [activeMessages, pendingImages],
  )
  const visibleConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.storageLoadState !== 'hydrated' ||
          !isTranscriptConversationWorkspacePlaceholder(conversation, draftsByConversation[conversation.id] ?? ''),
      ),
    [conversations, draftsByConversation],
  )

  const sortedConversations = useMemo(
    () => [...visibleConversations].sort((left, right) => right.updatedAt - left.updatedAt),
    [visibleConversations],
  )
  const conversationGroups = useMemo<ConversationGroup[]>(() => {
    const conversationGroupGapMs = Math.max(0, settings.conversationGroupGapMinutes) * 60 * 1000
    const groups: ConversationGroup[] = []

    for (const conversation of sortedConversations) {
      const previousGroup = groups[groups.length - 1]
      const previousConversation = previousGroup?.conversations[previousGroup.conversations.length - 1]
      const shouldCreateGroup =
        !previousGroup ||
        !previousConversation ||
        previousConversation.updatedAt - conversation.updatedAt > conversationGroupGapMs

      if (shouldCreateGroup) {
        groups.push({
          id: conversation.id,
          labelTime: conversation.updatedAt,
          conversations: [conversation],
        })
        continue
      }

      previousGroup.conversations.push(conversation)
    }

    return groups.map((group) => ({
      ...group,
      id: group.conversations.map((conversation) => conversation.id).join('|'),
    }))
  }, [sortedConversations, settings.conversationGroupGapMinutes])

  const openImageViewer = useCallback(
    (viewerKey: string, image: Pick<ImageAttachment, 'name' | 'dataUrl'>): void => {
      const fallbackItem = toImageViewerItem(viewerKey, image)
      if (!fallbackItem) {
        return
      }

      const items = imageViewerItems.length > 0 ? imageViewerItems : [fallbackItem]
      const initialIndex = items.findIndex((item) => item.key === viewerKey)

      setImageViewer({
        items,
        initialIndex: initialIndex >= 0 ? initialIndex : 0,
      })
      showImageViewerOverlay()
    },
    [imageViewerItems, showImageViewerOverlay],
  )

  const enabledModelOptions = useMemo(
    () => getEnabledModelOptions(settings.providers, cloudLoggedIn, settings.otherProvidersEnabled),
    [settings.providers, cloudLoggedIn, settings.otherProvidersEnabled],
  )
  const enabledModelsByProvider = useMemo(
    () => {
      const groups = settings.otherProvidersEnabled
        ? settings.providers
            .map((provider) => ({
              providerId: provider.id,
              providerName: provider.name,
              models: provider.models.filter((model) => model.enabled),
            }))
            .filter((provider) => provider.models.length > 0)
        : []

      // Add ActiNet group if logged in
      if (isCloudLoggedIn()) {
        const effective = getEffectiveActiNetModels()
        const enabled = effective.filter((m) => m.enabled)
        if (enabled.length > 0) {
          groups.push({
            providerId: ACTINET_PROVIDER_ID,
            providerName: ACTINET_PROVIDER_NAME,
            models: enabled,
          })
        }
      }

      return groups
    },
    [settings.providers, settings.actiNetModels, settings.otherProvidersEnabled, cloudLoggedIn],
  )
  const activeProviderRequestSettings = useMemo(
    () => resolveProviderRequestSettings(settings),
    [settings],
  )
  const isRunningInActiveConversation =
    activeConversation !== null &&
    activeRequestConversationId !== null &&
    activeConversation.id === activeRequestConversationId
  const providerDetailTarget = useMemo(
    () => settings.providers.find((provider) => provider.id === providerDetailTargetId) ?? null,
    [providerDetailTargetId, settings.providers],
  )
  const filteredProviderModels = useMemo(() => {
    const provider = providerDetailTarget
    if (!provider) {
      return []
    }

    const keyword = providerModelSearch.trim().toLowerCase()
    if (!keyword) {
      return provider.models
    }

    return provider.models.filter((model) => model.id.toLowerCase().includes(keyword))
  }, [providerDetailTarget, providerModelSearch])

  const tokenSummary = useMemo(() => {
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let estimatedCount = 0

    for (const message of activeMessages) {
      if (message.role !== 'assistant' || !message.usage) {
        continue
      }
      promptTokens += message.usage.promptTokens
      completionTokens += message.usage.completionTokens
      totalTokens += message.usage.totalTokens
      if (message.usageEstimated) {
        estimatedCount += 1
      }
    }

    return { promptTokens, completionTokens, totalTokens, estimatedCount }
  }, [activeMessages])

  const rounds = useMemo(
    () => activeMessages.filter((message) => message.role === 'user').length,
    [activeMessages],
  )
  const chatSummarySnapshot = useMemo<ChatSummarySnapshot>(
    () => ({
      rounds,
      promptTokens: tokenSummary.promptTokens,
      completionTokens: tokenSummary.completionTokens,
      totalTokens: tokenSummary.totalTokens,
      estimatedCount: tokenSummary.estimatedCount,
    }),
    [rounds, tokenSummary],
  )

  const emptyStateStats = useMemo(() => {
    return {
      totalConversationCount: effectiveHistoryStats.totalConversationCount,
      totalPhotoCount: effectiveHistoryStats.totalPhotoCount,
      totalMessageCount: effectiveHistoryStats.totalMessageCount,
      totalTokenCount: effectiveHistoryStats.totalTokenCount,
      totalToolCallCount: effectiveHistoryStats.totalToolCallCount,
    }
  }, [effectiveHistoryStats])

  const homepageHighlightStats = useMemo<HomepageHighlightStat[]>(
    () =>
      selectHomepageHighlights([
        {
          id: 'tokenUsage',
          label: 'Total token use',
          value: formatCompactCount(emptyStateStats.totalTokenCount),
          meta: '词元消耗',
          count: emptyStateStats.totalTokenCount,
          priority: 'primary',
        },
        {
          id: 'conversationHistory',
          label: 'Conversation archive',
          value: numberFormatter.format(emptyStateStats.totalConversationCount),
          meta: '历史会话',
          count: emptyStateStats.totalConversationCount,
          priority: 'primary',
        },
        {
          id: 'toolCalls',
          label: 'Tool calls',
          value: numberFormatter.format(emptyStateStats.totalToolCallCount),
          meta: '工具调用',
          count: emptyStateStats.totalToolCallCount,
          priority: 'primary',
        },
        {
          id: 'imagesSent',
          label: 'Images sent',
          value: numberFormatter.format(emptyStateStats.totalPhotoCount),
          meta: '发送图片',
          count: emptyStateStats.totalPhotoCount,
          priority: 'backup',
        },
        {
          id: 'messageCount',
          label: 'Messages sent',
          value: numberFormatter.format(emptyStateStats.totalMessageCount),
          meta: '消息数量',
          count: emptyStateStats.totalMessageCount,
          priority: 'backup',
        },
      ]),
    [emptyStateStats],
  )

  const hasDraftText = draft.trim().length > 0
  const hasComposerPayload = hasDraftText || pendingImages.length > 0
  const isComposerLocked =
    activeConversation === null || isActiveConversationLoading || isActiveConversationLoadError
  const canSend = !isComposerLocked && hasComposerPayload && !isSending
  const canAppendWhileSending =
    !isComposerLocked &&
    activeConversationResponseMode === 'tool' &&
    isSending &&
    isRunningInActiveConversation &&
    hasComposerPayload
  const shouldShowScrollToBottomButton =
    activeMessages.length > 0 &&
    messageListScrollMetrics.viewportHeight > 0 &&
    messageListScrollMetrics.bottomOffset >
      messageListScrollMetrics.viewportHeight * MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR

  useEffect(() => {
    let cancelled = false

    if (!settings.dailyCover.enabled) {
      setResolvedDailyCover(null)
      return undefined
    }

    const dateKey = getLocalDateKey()
    setResolvedDailyCover(resolveBundledDailyCover(dateKey))

    void (async () => {
      const nextCover = await resolveDailyCover(settings.dailyCover, dateKey)
      if (!cancelled) {
        setResolvedDailyCover(nextCover)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [settings.dailyCover])

  const pushNotice = useCallback((text: string, type: Notice['type'] = 'info'): void => {
    setNotice({ text, type })
  }, [])

  // ── Relay ActiNetSettings custom events as pushNotice ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: 'success' | 'error' | 'info'; text: string } | undefined
      if (detail) pushNotice(detail.text, detail.type)
    }
    window.addEventListener('actinet-notice', handler)
    return () => window.removeEventListener('actinet-notice', handler)
  }, [pushNotice])

  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }, [])

  const applySkillConfigValue = useCallback((nextValue: JsonObjectValue): void => {
    setSkillConfigValue(nextValue)
    setSkillConfigDraft(formatJsonObject(nextValue))
    setSkillConfigRawError(null)
  }, [])

  const handleSkillConfigDraftChange = useCallback((nextDraft: string): void => {
    setSkillConfigDraft(nextDraft)
    const parsed = parseSkillConfigDraft(nextDraft)
    if (parsed.error || !parsed.value) {
      setSkillConfigRawError(parsed.error ?? '配置必须是合法的 JSON。')
      return
    }
    setSkillConfigValue(parsed.value)
    setSkillConfigRawError(null)
  }, [])

  const formatSkillConfigDraft = useCallback((): void => {
    const parsed = parseSkillConfigDraft(skillConfigDraft)
    if (parsed.error || !parsed.value) {
      pushNotice(parsed.error ?? '当前配置不是合法 JSON，无法格式化。', 'error')
      return
    }
    applySkillConfigValue(parsed.value)
  }, [applySkillConfigValue, pushNotice, skillConfigDraft])

  const togglePromptEditor = useCallback((key: TagPromptEditorKey): void => {
    useUIStore.getState().togglePromptEditor(key)
  }, [])

  const toggleProviderPromptEditor = useCallback((key: PromptEditorKey): void => {
    useUIStore.getState().toggleProviderPromptEditor(key)
  }, [])

  const resetProviderDetailState = useCallback((): void => {
    setProviderDetailTargetId(null)
    setManualModelDraft('')
    setProviderModelSearch('')
    setProviderNumericSettingDrafts(createProviderNumericSettingDrafts(null))
    setOpenProviderPromptEditors({
      systemPrompt: false,
      topLevelTagSystemPrompt: false,
      generalTagSystemPrompt: false,
      readSystemPrompt: false,
      skillCallSystemPrompt: false,
      editSystemPrompt: false,
    })
  }, [])

  const openSettingsHome = useCallback((): void => {
    navigateSettingsView('main')
    resetProviderDetailState()
    setSkillConfigTargetId(null)
    setSkillConfigDraft('')
    setSkillConfigValue({})
    setSkillConfigRawError(null)
    openSettings()
  }, [openSettings, resetProviderDetailState])

  const clearOpenSettingsAfterDrawerTimer = useCallback((): void => {
    if (openSettingsAfterDrawerTimerRef.current !== null) {
      window.clearTimeout(openSettingsAfterDrawerTimerRef.current)
      openSettingsAfterDrawerTimerRef.current = null
    }
  }, [])

  const openSettingsFromDrawer = useCallback((): void => {
    closeDrawer()
    clearOpenSettingsAfterDrawerTimer()
    openSettingsAfterDrawerTimerRef.current = window.setTimeout(() => {
      openSettingsAfterDrawerTimerRef.current = null
      openSettingsHome()
    }, DRAWER_TO_SETTINGS_OPEN_DELAY_MS)
  }, [clearOpenSettingsAfterDrawerTimer, closeDrawer, openSettingsHome])

  useEffect(
    () => () => {
      if (openSettingsAfterDrawerTimerRef.current !== null) {
        window.clearTimeout(openSettingsAfterDrawerTimerRef.current)
      }
      openSettingsAfterDrawerTimerRef.current = null
    },
    [],
  )

  const rememberSettingsScrollPosition = useCallback((view: SettingsView = settingsView): void => {
    const settingsPage = settingsPageRef.current
    if (!settingsPage) {
      return
    }
    settingsScrollByViewRef.current[view] = settingsPage.scrollTop
  }, [settingsView])

  const navigateSettingsView = useCallback((nextView: SettingsView): void => {
    rememberSettingsScrollPosition()
    useUIStore.getState().navigateSettingsView(nextView)
  }, [rememberSettingsScrollPosition])

  const openProviderDetail = useCallback((providerId: string): void => {
    rememberSettingsScrollPosition()
    const targetProvider =
      useSettingsStore.getState().settings.providers.find((provider) => provider.id === providerId) ?? null
    startTransition(() => {
      setManualModelDraft('')
      setProviderModelSearch('')
      setProviderNumericSettingDrafts(createProviderNumericSettingDrafts(targetProvider))
      setOpenProviderPromptEditors({
        systemPrompt: false,
        topLevelTagSystemPrompt: false,
        generalTagSystemPrompt: false,
        readSystemPrompt: false,
        skillCallSystemPrompt: false,
        editSystemPrompt: false,
      })
      setProviderDetailTargetId(providerId)
      navigateSettingsView('provider-detail')
    })
  }, [rememberSettingsScrollPosition])

  const closeSettingsPanel = useCallback((): void => {
    rememberSettingsScrollPosition()
    navigateSettingsView('main')
    resetProviderDetailState()
    setSkillConfigTargetId(null)
    setSkillConfigDraft('')
    setSkillConfigValue({})
    setSkillConfigRawError(null)
    closeSettings()
  }, [closeSettings, rememberSettingsScrollPosition, resetProviderDetailState])

  const handleSettingsBack = useCallback((): void => {
    if (settingsView === 'skill-config') {
      rememberSettingsScrollPosition()
      navigateSettingsView('skills')
      setSkillConfigTargetId(null)
      setSkillConfigDraft('')
      setSkillConfigValue({})
      setSkillConfigRawError(null)
      return
    }
    if (settingsView === 'provider-detail') {
      rememberSettingsScrollPosition()
      resetProviderDetailState()
      navigateSettingsView('providers')
      return
    }
    if (settingsView === 'provider-tag-prompts') {
      rememberSettingsScrollPosition()
      navigateSettingsView('provider-detail')
      return
    }
    if (settingsView === 'providers' || settingsView === 'actinet') {
      rememberSettingsScrollPosition()
      navigateSettingsView('accounts')
      return
    }
    if (settingsView !== 'main') {
      rememberSettingsScrollPosition()
      navigateSettingsView('main')
      return
    }
    closeSettingsPanel()
  }, [closeSettingsPanel, rememberSettingsScrollPosition, resetProviderDetailState, settingsView])

  const onSettingsScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      settingsScrollByViewRef.current[settingsView] = event.currentTarget.scrollTop
    },
    [settingsView],
  )

  const refreshExtensions = useCallback(async (silent = false): Promise<void> => {
    if (!silent) {
      setIsLoadingExtensions(true)
    }
    const errors: string[] = []
    try {
      const initializeResults = await Promise.allSettled([
        initializeSkillHost(),
        ensureBundledRuntimesInstalled(),
      ])
      for (const result of initializeResults) {
        if (result.status === 'rejected') {
          errors.push(result.reason instanceof Error ? result.reason.message : '初始化扩展能力失败')
        }
      }

      const [skillsResult, runtimesResult] = await Promise.allSettled([listSkills(), listRuntimes()])
      if (skillsResult.status === 'fulfilled') {
        setSkillRecords(skillsResult.value)
      } else {
        errors.push(
          skillsResult.reason instanceof Error ? skillsResult.reason.message : '加载 skills 失败',
        )
      }

      if (runtimesResult.status === 'fulfilled') {
        setRuntimeRecords(runtimesResult.value)
      } else {
        errors.push(
          runtimesResult.reason instanceof Error ? runtimesResult.reason.message : '加载 runtimes 失败',
        )
      }
    } finally {
      if (errors.length > 0) {
        setNotice({ text: `加载扩展能力失败：${errors.join('；')}`, type: 'error' })
      }
      if (!silent) {
        setIsLoadingExtensions(false)
      }
    }
  }, [])

  const openSkillConfigEditor = useCallback(async (skillId: string): Promise<void> => {
    rememberSettingsScrollPosition()
    navigateSettingsView('skill-config')
    setSkillConfigTargetId(skillId)
    setIsLoadingSkillConfig(true)
    try {
      const config = await readSkillConfig(skillId)
      const nextValue = isJsonObjectRecord(config) ? config : {}
      setSkillConfigValue(nextValue)
      setSkillConfigDraft(formatJsonObject(nextValue))
      setSkillConfigRawError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取 skill 配置失败'
      pushNotice(`读取配置失败：${message}`, 'error')
      navigateSettingsView('skills')
      setSkillConfigTargetId(null)
      setSkillConfigDraft('')
      setSkillConfigValue({})
      setSkillConfigRawError(null)
    } finally {
      setIsLoadingSkillConfig(false)
    }
  }, [pushNotice, rememberSettingsScrollPosition])

  const saveSkillConfig = useCallback(async (): Promise<void> => {
    if (!skillConfigTargetId) {
      return
    }

    const parsed = parseSkillConfigDraft(skillConfigDraft)
    if (parsed.error || !parsed.value) {
      pushNotice(parsed.error ?? '配置必须是合法的 JSON。', 'error')
      return
    }

    setIsSavingSkillConfig(true)
    try {
      setSkillConfigValue(parsed.value)
      setSkillConfigRawError(null)
      await writeSkillConfig(skillConfigTargetId, parsed.value)
      await refreshExtensions(true)
      pushNotice(`已保存 ${skillConfigTargetId} 的配置。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存 skill 配置失败'
      pushNotice(`保存配置失败：${message}`, 'error')
    } finally {
      setIsSavingSkillConfig(false)
    }
  }, [pushNotice, refreshExtensions, skillConfigDraft, skillConfigTargetId])

  const handleSkillArchiveSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      setIsInstallingSkillArchive(true)
      try {
        const result = await installSkillPackage(file)
        await refreshExtensions(true)
        pushNotice(
          result.replacedExisting
            ? `Skill ${result.skill.id} 已更新。`
            : `Skill ${result.skill.id} 已安装。`,
          'success',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Skill 安装失败'
        pushNotice(`Skill 安装失败：${message}`, 'error')
      } finally {
        event.target.value = ''
        setIsInstallingSkillArchive(false)
      }
    },
    [pushNotice, refreshExtensions],
  )

  const handleRuntimeArchiveSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      setIsInstallingRuntimeArchive(true)
      try {
        const result = await installRuntimePackage(file)
        await refreshExtensions(true)
        pushNotice(
          result.replacedExisting
            ? `运行时 ${result.runtime.id} 已更新。`
            : `运行时 ${result.runtime.id} 已安装。`,
          'success',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : '运行时安装失败'
        pushNotice(`运行时安装失败：${message}`, 'error')
      } finally {
        event.target.value = ''
        setIsInstallingRuntimeArchive(false)
      }
    },
    [pushNotice, refreshExtensions],
  )

  const handleSetSkillEnabled = useCallback(async (skillId: string, enabled: boolean): Promise<void> => {
    try {
      await setSkillEnabled(skillId, enabled)
      setSkillRecords((previous) =>
        previous.map((skill) => (skill.id === skillId ? { ...skill, enabled } : skill)),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新 skill 状态失败'
      pushNotice(`更新 skill 状态失败：${message}`, 'error')
    }
  }, [pushNotice])

  const deleteSkillById = useCallback(async (skillId: string): Promise<void> => {
    try {
      await deleteSkill(skillId)
      if (skillConfigTargetId === skillId) {
        navigateSettingsView('skills')
        setSkillConfigTargetId(null)
        setSkillConfigDraft('')
        setSkillConfigValue({})
        setSkillConfigRawError(null)
      }
      await refreshExtensions(true)
      pushNotice(`已删除 skill：${skillId}`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除 skill 失败'
      pushNotice(`删除 skill 失败：${message}`, 'error')
    }
  }, [pushNotice, refreshExtensions, skillConfigTargetId])

  const requestDeleteSkill = useCallback((skillId: string): void => {
    openDeleteDialog({ type: 'skill', targetId: skillId })
  }, [openDeleteDialog])

  const handleSetRuntimeEnabled = useCallback(async (runtimeId: string, enabled: boolean): Promise<void> => {
    try {
      await setRuntimeEnabled(runtimeId, enabled)
      setRuntimeRecords((previous) =>
        previous.map((runtime) => (runtime.id === runtimeId ? { ...runtime, enabled } : runtime)),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新运行时状态失败'
      pushNotice(`更新运行时状态失败：${message}`, 'error')
    }
  }, [pushNotice])

  const deleteRuntimeById = useCallback(async (runtimeId: string): Promise<void> => {
    try {
      await deleteRuntime(runtimeId)
      await refreshExtensions(true)
      pushNotice(`已删除运行时：${runtimeId}`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除运行时失败'
      pushNotice(`删除运行时失败：${message}`, 'error')
    }
  }, [pushNotice, refreshExtensions])

  const requestDeleteRuntime = useCallback((runtimeId: string): void => {
    openDeleteDialog({ type: 'runtime', targetId: runtimeId })
  }, [openDeleteDialog])

  const handleSetDefaultRuntime = useCallback(
    async (runtime: RuntimeRecord): Promise<void> => {
      if (runtime.type !== 'python' && runtime.type !== 'node') {
        return
      }

      try {
        await setDefaultRuntime(runtime.type, runtime.id)
        await refreshExtensions(true)
        pushNotice(`已将 ${runtime.id} 设为默认 ${runtime.type} 运行时。`, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : '设置默认运行时失败'
        pushNotice(`设置默认运行时失败：${message}`, 'error')
      }
    },
    [pushNotice, refreshExtensions],
  )

  const handleTestRuntime = useCallback(async (runtimeId: string): Promise<void> => {
    setRuntimeRecords((previous) =>
      previous.map((runtime) =>
        runtime.id === runtimeId ? { ...runtime, testStatus: undefined, testMessage: '检测中...' } : runtime,
      ),
    )

    try {
      const nextRuntime = await testRuntime(runtimeId)
      setRuntimeRecords((previous) =>
        previous.map((runtime) => (runtime.id === runtimeId ? nextRuntime : runtime)),
      )
      pushNotice(
        nextRuntime.testStatus === 'ok'
          ? `运行时 ${runtimeId} 检测成功。`
          : `运行时 ${runtimeId} 检测失败：${nextRuntime.testMessage ?? '未知错误'}`,
        nextRuntime.testStatus === 'ok' ? 'success' : 'error',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '运行时检测失败'
      setRuntimeRecords((previous) =>
        previous.map((runtime) =>
          runtime.id === runtimeId ? { ...runtime, testStatus: 'error', testMessage: message } : runtime,
        ),
      )
      pushNotice(`运行时检测失败：${message}`, 'error')
    }
  }, [pushNotice])

  const applySettingsUpdate = useCallback((updater: (previous: AppSettings) => AppSettings): void => {
    setSettings((previous) => ensureValidCurrentModelSelection(updater(previous)))
  }, [])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    applySettingsUpdate((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const updateDailyCoverSetting = useCallback(
    <K extends keyof DailyCoverSettings>(key: K, value: DailyCoverSettings[K]): void => {
      applySettingsUpdate((previous) => ({
        ...previous,
        dailyCover: {
          ...previous.dailyCover,
          [key]: value,
        },
      }))
    },
    [applySettingsUpdate],
  )

  const resetPromptToDefault = (key: GlobalPromptSettingKey): void => {
    updateSetting(key, PROMPT_DEFAULTS[key] as AppSettings[typeof key])
    pushNotice('已重置为默认提示词。', 'success')
  }

  const handlePermissionToggle = useCallback(
    async (key: AppPermissionKey, enabled: boolean): Promise<void> => {
      if (!enabled) {
        applySettingsUpdate((previous) => ({
          ...previous,
          permissionToggles: {
            ...previous.permissionToggles,
            [key]: false,
          },
        }))
        return
      }

      setRequestingPermissionByKey((previous) => ({
        ...previous,
        [key]: true,
      }))
      try {
        const granted =
          key === 'location'
            ? await requestLocationPermission()
            : key === 'camera'
              ? await requestMediaPermission('camera')
              : key === 'microphone'
                ? await requestMediaPermission('microphone')
                : await requestNotificationPermission()
        if (!granted) {
          pushNotice(`${PERMISSION_LABELS[key]}权限未授予。请在系统设置中手动开启。`, 'error')
          applySettingsUpdate((previous) => ({
            ...previous,
            permissionToggles: {
              ...previous.permissionToggles,
              [key]: false,
            },
          }))
          return
        }

        applySettingsUpdate((previous) => ({
          ...previous,
          permissionToggles: {
            ...previous.permissionToggles,
            [key]: true,
          },
        }))
        pushNotice(`${PERMISSION_LABELS[key]}权限已开启。`, 'success')
      } finally {
        setRequestingPermissionByKey((previous) => ({
          ...previous,
          [key]: false,
        }))
      }
    },
    [applySettingsUpdate, pushNotice],
  )

  const handleNumericSettingChange = (
    key: NumericSettingKey,
    rawValue: string,
    minimum: number,
    maximum: number,
    integer = false,
  ): void => {
    setNumericSettingDrafts((previous) => ({
      ...previous,
      [key]: rawValue,
    }))

    if (rawValue.trim() === '') {
      updateSetting(key, NUMERIC_SETTING_DEFAULTS[key] as AppSettings[typeof key])
      return
    }

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      return
    }

    const nextValue = integer ? Math.round(clamp(parsed, minimum, maximum)) : clamp(parsed, minimum, maximum)
    updateSetting(key, nextValue as AppSettings[typeof key])
  }

  const finalizeNumericSettingDraft = (key: NumericSettingKey): void => {
    setNumericSettingDrafts((previous) => ({
      ...previous,
      [key]: normalizeNumericSettingDraft(key, useSettingsStore.getState().settings[key]),
    }))
  }

  const updateProviderById = useCallback(
    (providerId: string, updater: (provider: ProviderConfig) => ProviderConfig): void => {
      applySettingsUpdate((previous) => ({
        ...previous,
        providers: previous.providers.map((provider) =>
          provider.id === providerId ? updater(provider) : provider,
        ),
      }))
    },
    [applySettingsUpdate],
  )

  const selectCurrentModel = useCallback(
    (providerId: string, modelId: string): void => {
      applySettingsUpdate((previous) => {
        // ActiNet 虚拟服务商 — 不在 providers 数组中，需单独处理
        if (providerId === ACTINET_PROVIDER_ID) {
          const effective = getEffectiveActiNetModels()
          const model = effective.find((m) => m.id === modelId && m.enabled)
          if (!model) return previous
          return {
            ...previous,
            currentProviderId: providerId,
            currentModel: modelId,
          }
        }

        const provider = previous.providers.find((item) => item.id === providerId)
        if (!provider || !provider.models.some((model) => model.id === modelId && model.enabled)) {
          return previous
        }
        return {
          ...previous,
          currentProviderId: providerId,
          currentModel: modelId,
        }
      })
    },
    [applySettingsUpdate],
  )

  const addProvider = useCallback((): void => {
    rememberSettingsScrollPosition()
    const provider = createProviderConfig(createProviderNameCandidate(useSettingsStore.getState().settings.providers))
    setManualModelDraft('')
    setProviderModelSearch('')
    setProviderNumericSettingDrafts(createProviderNumericSettingDrafts(provider))
    setOpenProviderPromptEditors({
      systemPrompt: false,
      topLevelTagSystemPrompt: false,
      generalTagSystemPrompt: false,
      readSystemPrompt: false,
      skillCallSystemPrompt: false,
      editSystemPrompt: false,
    })
    setProviderDetailTargetId(provider.id)
    navigateSettingsView('provider-detail')
    applySettingsUpdate((previous) => ({
      ...previous,
      providers: [...previous.providers, provider],
    }))
  }, [applySettingsUpdate, rememberSettingsScrollPosition])

  const deleteProvider = useCallback(
    (providerId: string): void => {
      const targetProvider = useSettingsStore.getState().settings.providers.find((provider) => provider.id === providerId)
      const providerLabel = targetProvider?.name.trim() || '未命名服务商'

      applySettingsUpdate((previous) => ({
        ...previous,
        providers: previous.providers.filter((provider) => provider.id !== providerId),
      }))
      setModelHealth((previous) => {
        const next: Record<string, ModelHealth> = {}
        const prefix = `${providerId}::`
        for (const [key, value] of Object.entries(previous)) {
          if (!key.startsWith(prefix)) {
            next[key] = value
          }
        }
        return next
      })

      if (providerDetailTargetId === providerId) {
        resetProviderDetailState()
        navigateSettingsView('providers')
      }

      pushNotice(`已删除服务商：${providerLabel}`, 'success')
    },
    [applySettingsUpdate, providerDetailTargetId, pushNotice, resetProviderDetailState],
  )

  const requestDeleteProvider = useCallback((providerId: string): void => {
    openDeleteDialog({ type: 'provider', targetId: providerId })
  }, [openDeleteDialog])

  const updateProviderField = useCallback(
    (providerId: string, key: 'name' | 'apiBaseUrl' | 'apiKey', value: string): void => {
      updateProviderById(providerId, (provider) => ({
        ...provider,
        [key]: value,
      }))
    },
    [updateProviderById],
  )

  const updateProviderPromptOverride = useCallback(
    (providerId: string, key: ProviderPromptSettingKey, value: string): void => {
      const normalizedValue = normalizeProviderPromptOverride(value)
      updateProviderById(providerId, (provider) => ({
        ...provider,
        [key]: normalizedValue,
      }))
    },
    [updateProviderById],
  )

  const clearProviderPromptOverride = useCallback(
    (providerId: string, key: ProviderPromptSettingKey): void => {
      updateProviderById(providerId, (provider) => ({
        ...provider,
        [key]: undefined,
      }))
      pushNotice('已恢复跟随全局提示词。', 'success')
    },
    [pushNotice, updateProviderById],
  )

  const updateProviderInfoPromptOverride = useCallback(
    (providerId: string, key: ProviderBooleanSettingKey, enabled: boolean): void => {
      const globalValue = useSettingsStore.getState().settings[key]
      updateProviderById(providerId, (provider) => {
        const nextValue = enabled === globalValue ? undefined : enabled
        if (provider[key] === nextValue) {
          return provider
        }
        return {
          ...provider,
          [key]: nextValue,
        }
      })
    },
    [updateProviderById],
  )

  const clearProviderInfoPromptOverride = useCallback(
    (providerId: string, key: ProviderBooleanSettingKey): void => {
      updateProviderById(providerId, (provider) => ({
        ...provider,
        [key]: undefined,
      }))
      pushNotice('已恢复跟随全局信息提示词开关。', 'success')
    },
    [pushNotice, updateProviderById],
  )

  const handleProviderNumericSettingChange = useCallback(
    (key: ProviderNumericSettingKey, rawValue: string): void => {
      setProviderNumericSettingDrafts((previous) => ({
        ...previous,
        [key]: rawValue,
      }))

      if (!providerDetailTargetId) {
        return
      }

      if (rawValue.trim() === '') {
        updateProviderById(providerDetailTargetId, (provider) => ({
          ...provider,
          [key]: undefined,
        }))
        return
      }

      const parsed = Number(rawValue)
      if (!Number.isFinite(parsed)) {
        return
      }

      const limits = PROVIDER_NUMERIC_LIMITS[key]
      const nextValue = limits.integer
        ? Math.round(clamp(parsed, limits.minimum, limits.maximum))
        : clamp(parsed, limits.minimum, limits.maximum)
      updateProviderById(providerDetailTargetId, (provider) => ({
        ...provider,
        [key]: nextValue,
      }))
    },
    [providerDetailTargetId, updateProviderById],
  )

  const finalizeProviderNumericSettingDraft = useCallback((key: ProviderNumericSettingKey): void => {
    if (!providerDetailTargetId) {
      return
    }

    const provider =
      useSettingsStore.getState().settings.providers.find((item) => item.id === providerDetailTargetId) ?? null
    const nextValue = provider?.[key]
    setProviderNumericSettingDrafts((previous) => ({
      ...previous,
      [key]: nextValue === undefined ? '' : String(nextValue),
    }))
  }, [providerDetailTargetId])

  const setProviderModelEnabled = useCallback(
    (providerId: string, modelId: string, enabled: boolean): void => {
      updateProviderById(providerId, (provider) => ({
        ...provider,
        models: provider.models.map((model) =>
          model.id === modelId
            ? {
                ...model,
                enabled,
              }
            : model,
        ),
      }))
    },
    [updateProviderById],
  )

  const addManualProviderModel = useCallback((): void => {
    if (!providerDetailTargetId) {
      return
    }

    const modelId = manualModelDraft.trim()
    if (!modelId) {
      return
    }

    updateProviderById(providerDetailTargetId, (provider) => {
      if (provider.models.some((model) => model.id === modelId)) {
        return provider
      }

      return {
        ...provider,
        models: [...provider.models, { id: modelId, enabled: false }],
      }
    })
    setModelHealth((previous) => ({
      ...previous,
      [createProviderModelKey(providerDetailTargetId, modelId)]:
        previous[createProviderModelKey(providerDetailTargetId, modelId)] ?? 'untested',
    }))
    setManualModelDraft('')
  }, [manualModelDraft, providerDetailTargetId, updateProviderById])

  const updateConversationDraft = useCallback((conversationId: string, nextDraft: string): void => {
    setDraftsByConversation((previous) => {
      if (nextDraft.length === 0) {
        if (!Object.prototype.hasOwnProperty.call(previous, conversationId)) {
          return previous
        }
        const next = { ...previous }
        delete next[conversationId]
        return next
      }

      if (previous[conversationId] === nextDraft) {
        return previous
      }

      return {
        ...previous,
        [conversationId]: nextDraft,
      }
    })
  }, [])

  const updateConversationTranscript = (conversationId: string, transcript: TranscriptEvent[]): void => {
    setConversationsState((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? withConversationRecordTranscript(
              conversation,
              transcript,
              draftsByConversationRef.current[conversation.id] ?? '',
            )
          : conversation,
      ),
    )
  }

  const updateConversationResponseMode = useCallback(
    (conversationId: string, responseMode: ConversationResponseMode): void => {
      setConversationsState((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? withConversationRecordResponseMode(
                conversation,
                responseMode,
                draftsByConversationRef.current[conversation.id] ?? '',
              )
            : conversation,
        ),
      )
    },
    [setConversationsState],
  )

  const resetComposerState = useCallback(
    (conversationId: string): void => {
      updateConversationDraft(conversationId, '')
      pendingImageCompressionTaskIdRef.current = {}
      setPendingImages([])
      setEditingMessageId(null)
      closeModelMenu()
    },
    [closeModelMenu, updateConversationDraft],
  )

  const buildTurnHistoryTranscript = useCallback(
    (conversationId: string, turnId: string): TranscriptEvent[] | null => {
      const conversation =
        useChatStore.getState().conversations.find((item) => item.id === conversationId) ?? null
      if (!conversation) {
        return null
      }

      const userEventIndex = conversation.transcript.findIndex(
        (event) => event.kind === 'user_message' && event.turnId === turnId,
      )
      if (userEventIndex < 0) {
        return null
      }

      return conversation.transcript.slice(0, userEventIndex + 1)
    },
    [],
  )

  const clearQueuedTurnExecutions = useCallback((): void => {
    queuedTurnExecutionsRef.current = []
  }, [])

  const appendConversationTranscriptEvents = useCallback(
    (conversationId: string, events: TranscriptEvent[]): void => {
      if (events.length === 0) {
        return
      }
      setConversationsState((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? withConversationRecordTranscript(
                conversation,
                [...conversation.transcript, ...events],
                draftsByConversationRef.current[conversation.id] ?? '',
              )
            : conversation,
        ),
      )
    },
    [setConversationsState],
  )

  const updateAssistantEvent = useCallback(
    (
      conversationId: string,
      assistantId: string,
      updater: (event: AssistantMessageTranscriptEvent) => AssistantMessageTranscriptEvent,
    ): void => {
      setConversationsState((previous) =>
        previous.map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation
          }

          let hasUpdatedEvent = false
          const nextTranscript = conversation.transcript.map((event) => {
            if (event.kind !== 'assistant_message' || event.id !== assistantId) {
              return event
            }

            const nextEvent = updater(event)
            if (nextEvent === event) {
              return event
            }

            hasUpdatedEvent = true
            return nextEvent
          })

          return hasUpdatedEvent
            ? withConversationRecordTranscript(
                conversation,
                nextTranscript,
                draftsByConversationRef.current[conversation.id] ?? '',
              )
            : conversation
        }),
      )
    },
    [setConversationsState],
  )

  const applyAssistantFlowState = useCallback(
    (
      event: AssistantMessageTranscriptEvent,
      nextFlow: AssistantFlowNode[] | undefined,
    ): AssistantMessageTranscriptEvent => {
      const normalizedFlow = nextFlow && nextFlow.length > 0 ? nextFlow : undefined
      if (normalizedFlow === event.assistantFlow) {
        return event
      }
      return {
        ...event,
        assistantFlow: normalizedFlow,
      }
    },
    [],
  )

  const updateAssistantFlow = useCallback(
    (
      conversationId: string,
      assistantId: string,
      updater: (
        flow: AssistantFlowNode[] | undefined,
        event: AssistantMessageTranscriptEvent,
      ) => AssistantFlowNode[] | undefined,
    ): void => {
      updateAssistantEvent(conversationId, assistantId, (event) => {
        const nextFlow = updater(event.assistantFlow, event)
        if (nextFlow === event.assistantFlow) {
          return event
        }
        return applyAssistantFlowState(event, nextFlow)
      })
    },
    [applyAssistantFlowState, updateAssistantEvent],
  )

  const appendAssistantFlowRoundDivider = (
    conversationId: string,
    assistantId: string,
    roundId: string,
    explanation?: string,
  ): void => {
    updateAssistantFlow(conversationId, assistantId, (flow) => {
      const nextFlow = appendAssistantFlowDivider(flow, { createId, roundId }, explanation)
      if (nextFlow === flow) {
        return flow
      }
      appendObjectFlowLog(
        {
          event: 'assistant_flow_add_divider',
          conversationId,
          assistantId,
          roundId,
          previousNodeCount: flow?.length ?? 0,
          explanationPreview: explanation ? truncateDebugLogText(explanation, 160) : undefined,
        },
        `flow-divider:${assistantId}:${roundId}:${flow?.length ?? 0}`,
      )
      return nextFlow
    })
  }

  const clearAssistantFlowRoundState = (
    conversationId: string,
    assistantId: string,
    roundId: string,
  ): void => {
    updateAssistantFlow(conversationId, assistantId, (flow) => {
      const nextFlow = clearAssistantFlowRound(flow, roundId)
      if (nextFlow === flow) {
        return flow
      }
      appendObjectFlowLog(
        {
          event: 'assistant_flow_clear_round',
          conversationId,
          assistantId,
          roundId,
          previousNodeCount: flow?.length ?? 0,
          nextNodeCount: nextFlow?.length ?? 0,
        },
        `flow-clear-round:${assistantId}:${roundId}:${flow?.length ?? 0}->${nextFlow?.length ?? 0}`,
      )
      return nextFlow
    })
  }

  const applyAssistantStreamDelta = useCallback(
    (
      conversationId: string,
      assistantId: string,
      delta: {
        content?: string
        reasoning?: string
        roundId?: string
      },
    ): void => {
      const content = delta.content ?? ''
      const reasoning = delta.reasoning ?? ''
      if (!content && !reasoning) {
        return
      }

      updateAssistantEvent(conversationId, assistantId, (event) => {
        const previousFlow = event.assistantFlow
        const appendResult = content
          ? appendAssistantFlowContent(event.assistantFlow, content, {
              createId,
              roundId: delta.roundId,
            })
          : {
              flow: event.assistantFlow,
              plainTextDelta: '',
            }
        const nextFlow = appendResult.flow
        const currentReasoning = event.reasoning ?? ''
        const nextReasoning = reasoning ? `${currentReasoning}${reasoning}` : currentReasoning
        const nextEvent =
          nextFlow === event.assistantFlow ? event : applyAssistantFlowState(event, nextFlow)

        if (
          nextEvent === event &&
          nextReasoning === currentReasoning &&
          event.error === undefined
        ) {
          return event
        }

        if (appendResult.plainTextDelta) {
          appendObjectFlowLog(
            {
              event: 'assistant_text_append',
              conversationId,
              assistantId,
              roundId: delta.roundId ?? null,
              appendedLength: appendResult.plainTextDelta.length,
              appendedPreview: truncateDebugLogText(appendResult.plainTextDelta, 200),
              nextTextLength: assistantFlowToPlainText(nextFlow).length,
            },
            `text-append:${assistantId}:${assistantFlowToPlainText(nextFlow).length}:${appendResult.plainTextDelta.length}`,
          )
        }

        if (nextFlow !== previousFlow) {
          appendObjectFlowLog(
            {
              event: 'assistant_flow_update',
              conversationId,
              assistantId,
              roundId: delta.roundId ?? null,
              previousNodeCount: previousFlow?.length ?? 0,
              nextNodeCount: nextFlow?.length ?? 0,
            },
            `flow-update:${assistantId}:${delta.roundId ?? 'none'}:${previousFlow?.length ?? 0}->${nextFlow?.length ?? 0}`,
          )
        }

        return {
          ...nextEvent,
          reasoning: nextReasoning || undefined,
          error: undefined,
        }
      })
    },
    [appendObjectFlowLog, applyAssistantFlowState, updateAssistantEvent],
  )

  const flushQueuedAssistantStreamDelta = useCallback((): void => {
    if (queuedAssistantStreamDeltaAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(queuedAssistantStreamDeltaAnimationFrameRef.current)
      queuedAssistantStreamDeltaAnimationFrameRef.current = null
    }

    const queuedDelta = queuedAssistantStreamDeltaRef.current
    if (!queuedDelta) {
      return
    }

    queuedAssistantStreamDeltaRef.current = null
    applyAssistantStreamDelta(queuedDelta.conversationId, queuedDelta.assistantId, {
      content: queuedDelta.content,
      reasoning: queuedDelta.reasoning,
    })
  }, [applyAssistantStreamDelta])

  useEffect(
    () => () => {
      if (queuedAssistantStreamDeltaAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(queuedAssistantStreamDeltaAnimationFrameRef.current)
      }
      queuedAssistantStreamDeltaAnimationFrameRef.current = null
      queuedAssistantStreamDeltaRef.current = null
    },
    [],
  )

  const appendAssistantStreamDelta = (
    conversationId: string,
    assistantId: string,
    delta: {
      content?: string
      reasoning?: string
      roundId?: string
    },
  ): void => {
    const content = delta.content ?? ''
    const reasoning = delta.reasoning ?? ''
    if (!content && !reasoning) {
      return
    }

    const queuedDelta = queuedAssistantStreamDeltaRef.current
    if (
      queuedDelta &&
      (queuedDelta.conversationId !== conversationId ||
        queuedDelta.assistantId !== assistantId ||
        queuedDelta.roundId !== delta.roundId)
    ) {
      flushQueuedAssistantStreamDelta()
    }

    const nextQueued = queuedAssistantStreamDeltaRef.current
    if (!nextQueued) {
      queuedAssistantStreamDeltaRef.current = {
        conversationId,
        assistantId,
        content,
        reasoning,
        roundId: delta.roundId,
      }
    } else {
      nextQueued.content += content
      nextQueued.reasoning += reasoning
      nextQueued.roundId = nextQueued.roundId ?? delta.roundId
    }

    if (queuedAssistantStreamDeltaAnimationFrameRef.current !== null) {
      return
    }

    queuedAssistantStreamDeltaAnimationFrameRef.current = window.requestAnimationFrame(() => {
      queuedAssistantStreamDeltaAnimationFrameRef.current = null
      const frameQueuedDelta = queuedAssistantStreamDeltaRef.current
      if (!frameQueuedDelta) {
        return
      }
      queuedAssistantStreamDeltaRef.current = null
      applyAssistantStreamDelta(frameQueuedDelta.conversationId, frameQueuedDelta.assistantId, {
        content: frameQueuedDelta.content,
        reasoning: frameQueuedDelta.reasoning,
        roundId: frameQueuedDelta.roundId,
      })
    })
  }

  const resetAssistantStreamOutput = (conversationId: string, assistantId: string): void => {
    flushQueuedAssistantStreamDelta()
    updateAssistantEvent(conversationId, assistantId, (event) => {
      if (
        !event.rawText &&
        !event.reasoning &&
        (event.assistantFlow?.length ?? 0) === 0 &&
        event.error === undefined
      ) {
        return event
      }

      return {
        ...event,
        rawText: '',
        assistantFlow: undefined,
        reasoning: undefined,
        error: undefined,
      }
    })
  }

  const updateConversationTitle = (
    conversationId: string,
    title: string,
    manual: boolean,
  ): void => {
    setConversationsState((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }
        const next = {
          ...conversation,
          title,
          titleManuallyEdited: manual,
          updatedAt: Date.now(),
        }
        return next
      }),
    )
  }

  const ensureReadyToRequest = (): boolean => {
    if (!activeProviderRequestSettings) {
      pushNotice('请先选择已启用模型。', 'error')
      if (enabledModelOptions.length === 0) {
        openSettings()
        navigateSettingsView('providers')
      } else {
        openModelMenu()
      }
      closeDrawer()
      return false
    }

    if (
      !activeProviderRequestSettings.apiBaseUrl.trim() ||
      !activeProviderRequestSettings.apiKey.trim()
    ) {
      pushNotice('请先在服务商设置中填写 URL 和 API Key。', 'error')
      openSettings()
      openProviderDetail(activeProviderRequestSettings.providerId)
      closeDrawer()
      return false
    }
    return true
  }

  const applyAssistantResult = (
    conversationId: string,
    assistantId: string,
    result: CompletionResult,
    promptMessages: ApiMessage[],
    options?: {
      resolvedText?: string
      preserveRawText?: boolean
      storedRawText?: string
    },
  ): void => {
    flushQueuedAssistantStreamDelta()
    const preserveRawText = options?.preserveRawText === true
    const extracted = preserveRawText ? { cleanedText: '', reasoning: '' } : extractThinkBlocks(result.text)
    const finalText =
      options?.resolvedText !== undefined
        ? options.resolvedText.trim()
        : extracted.cleanedText || result.text.trim()
    const finalReasoning = preserveRawText
      ? result.reasoning.trim()
      : [result.reasoning, extracted.reasoning].filter(Boolean).join('\n\n').trim()
    const usage = result.usage ?? estimateUsage(promptMessages, finalText)
    const usageEstimated = result.usage === undefined

    setConversationsState((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }
        const nextTranscript = conversation.transcript.map((event) => {
          if (event.kind !== 'assistant_message' || event.id !== assistantId) {
            return event
          }
          const nextFlow =
            (event.assistantFlow?.length ?? 0) === 0
              ? createAssistantTextFlow(finalText, { createId })
              : event.assistantFlow
          const nextEvent = applyAssistantFlowState(event, nextFlow)
          return {
            ...nextEvent,
            rawText: options?.storedRawText ?? result.text,
            reasoning: finalReasoning || undefined,
            usage,
            usageEstimated,
            firstTokenLatencyMs: result.firstTokenLatencyMs,
            totalTimeMs: result.totalTimeMs,
            error: undefined,
          }
        })
        return withConversationRecordTranscript(
          conversation,
          nextTranscript,
          draftsByConversationRef.current[conversation.id] ?? '',
        )
      }),
    )
  }

  const executeAssistantTurn = async (
    conversationId: string,
    historyTranscript: TranscriptEvent[],
    turnId: string,
    responseMode: ConversationResponseMode,
    controller: AbortController,
  ): Promise<TurnExecutionOutcome> => {
    if (!ensureReadyToRequest()) {
      return 'blocked'
    }

    const settingsSnapshot = activeProviderRequestSettings
    if (!settingsSnapshot) {
      return 'blocked'
    }
    const firstTokenHapticsEnabled = settings.firstTokenHapticsEnabled
    let hasTriggeredFirstTokenHaptic = false
    const currentUserEvent = historyTranscript[historyTranscript.length - 1]
    const traceId = createId()
    let latestAssistantId: string | null = null
    let latestAssistantRawText = ''
    appendSkillRoundLog({
      event: 'request_start',
      traceId,
      conversationId,
      turnId,
      model: settingsSnapshot.currentModel,
      responseMode,
      userInput:
        currentUserEvent?.kind === 'user_message'
          ? truncateDebugLogText(getUserTranscriptText(currentUserEvent))
          : '',
    })
    type LiveRoundContext = {
      roundId: string
      skillTokenOrder: string[]
      skillKindByToken: Map<string, SkillStepKind>
      hasVisibleFlow: boolean
      markHasVisibleFlow: () => void
      resetTracking: () => void
    }

    const compactActionPreviewPayload = (payload: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(
        Object.entries(payload).filter(([, value]) => {
          if (value === undefined || value === null) {
            return false
          }
          if (typeof value === 'string') {
            return value.trim().length > 0
          }
          if (Array.isArray(value)) {
            return value.length > 0
          }
          if (isRecord(value)) {
            return Object.keys(value).length > 0
          }
          return true
        }),
      )

    const formatLiveActionPreview = (
      tag: SkillStepKind,
      preview: SkillActionStreamEvent['preview'],
      error?: string,
    ): string => {
      const previewRoot: InternalActionLocation | undefined =
        preview.root === 'skill' || preview.root === 'workspace' || preview.root === 'home' || preview.root === 'absolute'
          ? preview.root
          : undefined
      const effectivePath = preview.path !== undefined && previewRoot !== undefined
        ? buildEnvVarPath(previewRoot, preview.skill, preview.path)
        : undefined
      const payload = compactActionPreviewPayload({
        tag,
        id: preview.id,
        ...(effectivePath !== undefined ? { path: effectivePath } : {}),
        depth: preview.depth,
        startLine: preview.startLine,
        endLine: preview.endLine,
        command: preview.command,
        session: preview.session,
        waitMs: preview.waitMs,
        script: preview.script,
        argv: preview.argv,
        stdin: preview.stdin,
        env: preview.env,
        timeoutMs: preview.timeoutMs,
        createIfMissing: preview.createIfMissing,
        previewContextLines: preview.previewContextLines,
        edits: preview.edits,
        editCount: preview.editCount,
        error,
      })
      return formatStructuredMarkdown(payload)
    }

    const triggerFirstTokenHaptic = (): void => {
      if (!firstTokenHapticsEnabled || hasTriggeredFirstTokenHaptic) {
        return
      }

      hasTriggeredFirstTokenHaptic = true
      vibrateInteraction()
    }

    const patchRoundSkillNode = (
      roundContext: LiveRoundContext,
      assistantId: string,
      token: string,
      patch: {
        actionKind?: SkillStepKind
        status?: 'running' | 'success' | 'error'
        root?: 'skill' | 'workspace' | 'home' | 'absolute'
        skill?: string
        path?: string
        depth?: number
        startLine?: number
        endLine?: number
        command?: string
        session?: string
        script?: string
        error?: string
        result?: string
      },
    ): void => {
      updateAssistantEvent(conversationId, assistantId, (event) => {
        const nextFlow = upsertAssistantFlowSkillNodeByToken(
          event.assistantFlow,
          token,
          patch,
          {
            createId,
            roundId: roundContext.roundId,
          },
        ).flow
        return applyAssistantFlowState(event, nextFlow)
      })

      if (!roundContext.skillKindByToken.has(token)) {
        roundContext.skillTokenOrder.push(token)
      }
      if (patch.actionKind) {
        roundContext.skillKindByToken.set(token, patch.actionKind)
      }

      appendObjectFlowLog(
        {
          event: 'assistant_flow_skill_patch',
          traceId,
          conversationId,
          assistantId,
          roundId: roundContext.roundId,
          token,
          patch: {
            ...patch,
            result:
              typeof patch.result === 'string' ? truncateDebugLogText(patch.result, 280) : patch.result,
            error: typeof patch.error === 'string' ? truncateDebugLogText(patch.error, 200) : patch.error,
          },
        },
        `flow-skill-patch:${assistantId}:${roundContext.roundId}:${token}:${patch.status ?? ''}:${patch.skill ?? ''}:${patch.script ?? ''}`,
      )
    }

    const clearRoundState = (roundContext: LiveRoundContext, assistantId: string): void => {
      clearAssistantFlowRoundState(conversationId, assistantId, roundContext.roundId)
      roundContext.resetTracking()
    }

    const markRoundSkillsAsError = (
      roundContext: LiveRoundContext,
      assistantId: string,
      message: string,
    ): void => {
      updateAssistantFlow(conversationId, assistantId, (flow) =>
        markAssistantFlowRoundError(flow, roundContext.roundId, message),
      )
      appendObjectFlowLog(
        {
          event: 'assistant_flow_round_error',
          traceId,
          conversationId,
          assistantId,
          roundId: roundContext.roundId,
          error: truncateDebugLogText(message, 200),
        },
        `flow-round-error:${assistantId}:${roundContext.roundId}:${message}`,
      )
    }

    const requestModelCompletion = async (
      assistantId: string,
      promptMessages: ApiMessage[],
      options?: {
        mode?: 'plain' | 'tagged'
        roundContext?: LiveRoundContext
      },
    ): Promise<CompletionResult> => {
      const mode = options?.mode ?? 'plain'
      const parseTags = mode === 'tagged'
      const roundContext = options?.roundContext
      const attemptLimit = Math.max(0, settingsSnapshot.maxModelRetryCount) + 1
      let lastError: unknown = null
      latestAssistantRawText = ''

      const applyStreamActionEvents = (events: SkillActionStreamEvent[]): void => {
        if (!roundContext) {
          return
        }

        for (const event of events) {
          const eventKind: SkillStepKind = event.tag
          roundContext.markHasVisibleFlow()
          const preview = event.preview
          patchRoundSkillNode(roundContext, assistantId, event.token, {
            actionKind: eventKind,
            status: event.type === 'close' && event.error ? 'error' : 'running',
            root:
              ((eventKind === 'read' || eventKind === 'edit') &&
                (preview.root === 'skill' ||
                  preview.root === 'workspace' ||
                  preview.root === 'home' ||
                  preview.root === 'absolute')) ||
              (eventKind === 'run' &&
                (preview.root === 'skill' ||
                  preview.root === 'workspace' ||
                  preview.root === 'home' ||
                  preview.root === 'absolute'))
                ? preview.root
                : undefined,
            skill:
              typeof preview.skill === 'string' && preview.skill.trim()
                ? preview.skill
                : event.type === 'open' &&
                    (eventKind === 'skill_call' ||
                      (eventKind === 'run' && preview.root === 'skill') ||
                      preview.root === 'skill')
                  ? '未命名技能'
                  : undefined,
            path:
              (eventKind === 'read' || eventKind === 'edit') && typeof preview.path === 'string'
                ? preview.path
                : undefined,
            depth: eventKind === 'read' ? preview.depth : undefined,
            startLine: eventKind === 'read' ? preview.startLine : undefined,
            endLine: eventKind === 'read' ? preview.endLine : undefined,
            command:
              eventKind === 'run' && typeof preview.command === 'string' ? preview.command : undefined,
            session:
              eventKind === 'run' && typeof preview.session === 'string' ? preview.session : undefined,
            script: eventKind === 'skill_call' && typeof preview.script === 'string' ? preview.script : undefined,
            error: event.type === 'close' ? event.error : undefined,
            result: formatLiveActionPreview(eventKind, preview, event.error),
          })
        }
      }

      const replayNonStreamRound = (completion: CompletionResult): void => {
        if (!parseTags || !roundContext) {
          return
        }

        const parser = createAgentStreamParser()
        const firstDelta = parser.push(completion.text)
        const finalDelta = parser.flush()
        const content = `${firstDelta.content}${finalDelta.content}`
        const reasoning = `${firstDelta.reasoning}${finalDelta.reasoning}`
        if (content || reasoning) {
          roundContext.markHasVisibleFlow()
          appendAssistantStreamDelta(conversationId, assistantId, {
            content,
            reasoning,
            roundId: roundContext.roundId,
          })
        }

        const events = [...firstDelta.actionEvents, ...finalDelta.actionEvents]
        if (events.length > 0) {
          flushQueuedAssistantStreamDelta()
          applyStreamActionEvents(events)
        }
      }

      for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
        if (attempt > 0) {
          if (roundContext) {
            clearRoundState(roundContext, assistantId)
          } else {
            resetAssistantStreamOutput(conversationId, assistantId)
          }
          latestAssistantRawText = ''
        }

        const streamParser = parseTags ? createAgentStreamParser() : null
        const flushStreamParser = (): void => {
          if (!streamParser) {
            return
          }
          const delta = streamParser.flush()
          if (delta.content || delta.reasoning) {
            roundContext?.markHasVisibleFlow()
            appendAssistantStreamDelta(conversationId, assistantId, {
              content: delta.content,
              reasoning: delta.reasoning,
              roundId: roundContext?.roundId,
            })
          }
          if (delta.actionEvents.length > 0) {
            flushQueuedAssistantStreamDelta()
            applyStreamActionEvents(delta.actionEvents)
          }
        }

        try {
          const completion = await requestStreamCompletion(
            settingsSnapshot,
            promptMessages,
            controller.signal,
            {
              onContent: (chunk) => {
                if (chunk.length > 0) {
                  triggerFirstTokenHaptic()
                }
                latestAssistantRawText += chunk

                if (!streamParser) {
                  appendAssistantStreamDelta(conversationId, assistantId, {
                    content: chunk,
                    roundId: roundContext?.roundId,
                  })
                  return
                }

                const delta = streamParser.push(chunk)
                if (delta.content || delta.reasoning) {
                  roundContext?.markHasVisibleFlow()
                  appendAssistantStreamDelta(conversationId, assistantId, {
                    content: delta.content,
                    reasoning: delta.reasoning,
                    roundId: roundContext?.roundId,
                  })
                }
                if (delta.actionEvents.length > 0) {
                  flushQueuedAssistantStreamDelta()
                  applyStreamActionEvents(delta.actionEvents)
                }
              },
              onReasoning: (chunk) => {
                if (chunk.length > 0) {
                  triggerFirstTokenHaptic()
                }

                appendAssistantStreamDelta(conversationId, assistantId, {
                  reasoning: chunk,
                  roundId: roundContext?.roundId,
                })
              },
            },
          )
          flushStreamParser()
          flushQueuedAssistantStreamDelta()
          return completion
        } catch (streamError) {
          flushStreamParser()
          flushQueuedAssistantStreamDelta()
          if (streamError instanceof DOMException && streamError.name === 'AbortError') {
            throw streamError
          }

          try {
            if (roundContext) {
              clearRoundState(roundContext, assistantId)
            } else {
              resetAssistantStreamOutput(conversationId, assistantId)
            }
            const nonStreamCompletion = await requestNonStreamCompletion(
              settingsSnapshot,
              promptMessages,
              controller.signal,
            )
            latestAssistantRawText = nonStreamCompletion.text
            replayNonStreamRound(nonStreamCompletion)
            flushQueuedAssistantStreamDelta()
            return nonStreamCompletion
          } catch (nonStreamError) {
            if (nonStreamError instanceof DOMException && nonStreamError.name === 'AbortError') {
              throw nonStreamError
            }
            lastError = nonStreamError
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error('模型调用失败')
    }

    try {
      if (!currentUserEvent || currentUserEvent.kind !== 'user_message') {
        throw new Error('当前对话无法定位本轮用户输入。')
      }

      if (responseMode === 'text') {
        const promptMessages = buildApiMessagesFromTranscript(historyTranscript, settingsSnapshot.systemPrompt)
        appendSkillRoundLog({
          event: 'round_input',
          traceId,
          round: 1,
          mode: 'plain-chat',
          promptMessages: normalizePromptMessagesForDebug(promptMessages),
        })
        const roundId = createId()
        const assistantId = createId()
        latestAssistantId = assistantId
        appendConversationTranscriptEvents(conversationId, [
          {
            kind: 'assistant_message',
            id: assistantId,
            turnId,
            roundId,
            createdAt: Date.now(),
            rawText: '',
            reasoning: '',
            model: settingsSnapshot.currentModel,
          },
        ])
        const completion = await requestModelCompletion(assistantId, promptMessages, { mode: 'plain' })
        appendSkillRoundLog({
          event: 'round_output',
          traceId,
          round: 1,
          mode: 'plain-chat',
          assistantText: truncateDebugLogText(completion.text),
          assistantReasoning: truncateDebugLogText(completion.reasoning ?? ''),
          usage: completion.usage
            ? {
                promptTokens: completion.usage.promptTokens,
                completionTokens: completion.usage.completionTokens,
                totalTokens: completion.usage.totalTokens,
              }
            : undefined,
        })
        applyAssistantResult(conversationId, assistantId, completion, promptMessages, {
          resolvedText: completion.text,
          preserveRawText: true,
        })
        return 'completed'
      }

      const systemPrompt = await buildSkillAgentSystemPrompt(
        settingsSnapshot,
        skillRecords,
        runtimeRecords,
        conversationId,
        historyTranscript,
      )
      const workingTranscript = [...historyTranscript]
      let finalCompletion: CompletionResult | null = null
      let finalCompletionDisplayText: string | undefined
      let executedRoundCount = 0
      let previousProgressFingerprint: string | null = null
      const appendHostMessage = (
        event: HostMessageTranscriptEvent,
        options?: {
          replacePreviousProtocolRetryReason?: string
        },
      ): void => {
        const replacePreviousProtocolRetryReason = options?.replacePreviousProtocolRetryReason
        const lastEvent = workingTranscript[workingTranscript.length - 1]
        const shouldReplacePreviousProtocolRetry =
          replacePreviousProtocolRetryReason &&
          lastEvent?.kind === 'host_message' &&
          lastEvent.category === 'protocol_retry' &&
          lastEvent.payload.reason === replacePreviousProtocolRetryReason

        if (shouldReplacePreviousProtocolRetry) {
          workingTranscript[workingTranscript.length - 1] = event
          updateConversationTranscript(conversationId, [...workingTranscript])
          return
        }

        appendConversationTranscriptEvents(conversationId, [event])
        workingTranscript.push(event)
      }

      const appendProtocolRetryMessage = (
        roundId: string,
        payload: {
          reason: string
          prompt: string
          displayText?: string
          repairs?: unknown
        },
      ): void => {
        appendHostMessage(
          {
            kind: 'host_message',
            id: createId(),
            turnId,
            roundId,
            createdAt: Date.now(),
            category: 'protocol_retry',
            payload,
          },
          {
            replacePreviousProtocolRetryReason: payload.reason,
          },
        )
      }

      for (let step = 0; ; step += 1) {
        if (controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        const promptMessages = buildApiMessagesFromTranscript(workingTranscript, systemPrompt)
        appendSkillRoundLog({
          event: 'round_input',
          traceId,
          round: step + 1,
          mode: 'skill-agent',
          blockCount: workingTranscript.length,
          promptMessages: normalizePromptMessagesForDebug(promptMessages),
        })
        executedRoundCount = step + 1
        const roundId = createId()
        const assistantId = createId()
        latestAssistantId = assistantId
        appendConversationTranscriptEvents(conversationId, [
          {
            kind: 'assistant_message',
            id: assistantId,
            turnId,
            roundId,
            createdAt: Date.now(),
            rawText: '',
            reasoning: '',
            model: settingsSnapshot.currentModel,
          },
        ])
        const roundContext: LiveRoundContext = {
          roundId,
          skillTokenOrder: [],
          skillKindByToken: new Map<string, SkillStepKind>(),
          hasVisibleFlow: false,
          markHasVisibleFlow: () => {
            roundContext.hasVisibleFlow = true
          },
          resetTracking: () => {
            roundContext.skillTokenOrder.length = 0
            roundContext.skillKindByToken.clear()
            roundContext.hasVisibleFlow = false
          },
        }

        const completion = await requestModelCompletion(assistantId, promptMessages, {
          mode: 'tagged',
          roundContext,
        })

        const protocolOutcome = normalizeSkillAgentProtocolResponse(completion.text)
        appendSkillRoundLog({
          event: 'round_output',
          traceId,
          round: step + 1,
          mode: 'skill-agent',
          assistantRaw: truncateDebugLogText(completion.text),
          assistantReasoning: truncateDebugLogText(completion.reasoning ?? ''),
          protocolKind: protocolOutcome.kind,
          assistantDisplayText: truncateDebugLogText(
            protocolOutcome.kind === 'final' ? protocolOutcome.finalText : protocolOutcome.displayText,
          ),
          repairs: protocolOutcome.repairs.map((repair) => repair.code),
          actions:
            protocolOutcome.kind === 'progress'
              ? protocolOutcome.actions.map((action) =>
            action.kind === 'read'
              ? {
                  kind: action.kind,
                  ...(action.path !== undefined ? { path: buildEnvVarPath(action.root, action.skill, action.path) } : {}),
                  depth: action.depth,
                  startLine: action.startLine,
                  endLine: action.endLine,
                }
              : action.kind === 'edit'
                ? {
                    kind: action.kind,
                    path: buildEnvVarPath(action.root, undefined, action.path),
                    createIfMissing: action.createIfMissing,
                    previewContextLines: action.previewContextLines,
                    edits: action.edits,
                  }
              : action.kind === 'run'
                ? {
                    kind: action.kind,
                    id: action.id,
                    command: action.command,
                    session: action.session,
                    waitMs: action.waitMs,
                  }
                : {
                    kind: action.kind,
                    id: action.id,
                    skill: action.skill,
                    script: action.script,
                    argv: action.argv ?? [],
                  },
                )
              : [],
        })
        const roundDisplayText =
          protocolOutcome.kind === 'final' ? protocolOutcome.finalText : protocolOutcome.displayText
        const roundExplanation = roundDisplayText.trim()
        const storedRawText =
          protocolOutcome.kind === 'progress' || protocolOutcome.kind === 'final'
            ? protocolOutcome.normalizedEnvelope
            : ''
        const normalizedReasoning = [completion.reasoning, protocolOutcome.reasoningText]
          .filter(Boolean)
          .join('\n\n')
          .trim()
        applyAssistantResult(
          conversationId,
          assistantId,
          completion,
          promptMessages,
          {
            resolvedText: roundDisplayText,
            storedRawText,
          },
        )

        workingTranscript.push({
          kind: 'assistant_message',
          id: assistantId,
          turnId,
          roundId,
          createdAt: Date.now(),
          rawText: storedRawText,
          reasoning: normalizedReasoning || undefined,
          model: settingsSnapshot.currentModel,
          usage: completion.usage,
          firstTokenLatencyMs: completion.firstTokenLatencyMs,
          totalTimeMs: completion.totalTimeMs,
        })

        if (roundContext.hasVisibleFlow) {
          appendAssistantFlowRoundDivider(conversationId, assistantId, roundId, roundExplanation)
        }

        if (protocolOutcome.kind === 'final') {
          finalCompletion = completion
          finalCompletionDisplayText = protocolOutcome.finalText
          break
        }

        if (protocolOutcome.kind === 'retry') {
          if (roundContext.skillTokenOrder.length > 0) {
            markRoundSkillsAsError(roundContext, assistantId, protocolOutcome.retryPrompt)
          }
          appendProtocolRetryMessage(roundId, {
            reason: protocolOutcome.retryReason,
            prompt: protocolOutcome.retryPrompt,
            displayText: protocolOutcome.displayText,
            repairs: protocolOutcome.repairs.map((repair) => repair.code),
          })
          previousProgressFingerprint = null
          continue
        }

        if (protocolOutcome.normalizedEnvelope === previousProgressFingerprint) {
          appendProtocolRetryMessage(roundId, {
            reason: 'repeated_progress',
            prompt:
              '上一轮与本轮的 `<progress>` 请求完全相同，宿主不会重复执行。请基于最新的 host_message 结果继续推进，重发一条新的合法顶层回复。',
            displayText: protocolOutcome.displayText,
            repairs: protocolOutcome.repairs.map((repair) => repair.code),
          })
          previousProgressFingerprint = null
          continue
        }

        previousProgressFingerprint = protocolOutcome.normalizedEnvelope

        for (let actionIndex = 0; actionIndex < protocolOutcome.actions.length; actionIndex += 1) {
          const action = protocolOutcome.actions[actionIndex]
          if (controller.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }

          if (action.kind === 'read') {
            const actionToken =
              roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-read-${actionIndex + 1}`
            const displayPath = resolveReadActionDisplayPath(action)
            patchRoundSkillNode(roundContext, assistantId, actionToken, {
              actionKind: 'read',
              root: action.root,
              skill: action.skill,
              path: displayPath,
              depth: action.depth,
              startLine: action.startLine,
              endLine: action.endLine,
              status: 'running',
              error: undefined,
            })

            try {
              const payload = await executeReadAction(action, conversationId)
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'read',
                status: 'success',
                error: undefined,
                result: formatSkillStepResult(serializeReadResultForHost(payload)),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: 'read_result',
                payload: {
                  request: serializeReadActionForHost({
                    root: action.root,
                    skill: action.skill,
                    path: displayPath,
                    depth: action.depth,
                    startLine: action.startLine,
                    endLine: action.endLine,
                  }),
                  result: serializeReadResultForHost(payload),
                },
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : '读取失败'
              const payload = {
                ...(displayPath !== undefined ? { path: buildEnvVarPath(action.root, action.skill, displayPath) } : {}),
                depth: action.depth,
                startLine: action.startLine,
                endLine: action.endLine,
                error: message,
              }
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'read',
                status: 'error',
                error: message,
                result: formatSkillStepResult(payload),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: 'read_error',
                payload: {
                  request: serializeReadActionForHost({
                    root: action.root,
                    skill: action.skill,
                    path: displayPath,
                    depth: action.depth,
                    startLine: action.startLine,
                    endLine: action.endLine,
                  }),
                  result: payload,
                },
              })
            }
            continue
          }

          if (action.kind === 'edit') {
            const actionToken =
              roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-edit-${actionIndex + 1}`
            patchRoundSkillNode(roundContext, assistantId, actionToken, {
              actionKind: 'edit',
              root: action.root,
              path: action.path,
              status: 'running',
              error: undefined,
            })

            try {
              const payload = await executeEditAction(action, conversationId)
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'edit',
                status: 'success',
                error: undefined,
                result: formatSkillStepResult(serializeEditResultForHost(payload)),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: 'edit_result',
                payload: {
                  request: serializeEditActionForHost(action),
                  result: serializeEditResultForHost(payload),
                },
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : '编辑失败'
              const payload = {
                ...serializeEditActionForHost(action),
                error: message,
              }
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'edit',
                status: 'error',
                error: message,
                result: formatSkillStepResult(payload),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: 'edit_error',
                payload: {
                  request: serializeEditActionForHost(action),
                  result: payload,
                },
              })
            }
            continue
          }

          if (action.kind === 'run') {
            const actionToken =
              roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-run-${actionIndex + 1}`
            const gatedAction = applyPermissionGatesToRun(action, settings.permissionToggles)
            let executableAction: RunAction

            try {
              executableAction = materializeRunAction(gatedAction)
            } catch (error) {
              const message = error instanceof Error ? error.message : 'run 执行失败'
              const payload = {
                id: gatedAction.id,
                command: gatedAction.command,
                session: gatedAction.session,
                error: message,
              }
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'run',
                root: gatedAction.root,
                skill: gatedAction.skill,
                command: gatedAction.command,
                session: gatedAction.session,
                status: 'error',
                error: message,
                result: formatSkillStepResult(payload),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: 'run_error',
                payload: {
                  request: serializeRunActionForHost(gatedAction),
                  result: payload,
                },
              })
              continue
            }

            patchRoundSkillNode(roundContext, assistantId, actionToken, {
              actionKind: 'run',
              root: executableAction.root,
              skill: executableAction.skill,
              command: executableAction.command,
              session: executableAction.session,
              status: 'running',
              error: undefined,
            })

            try {
              const execution = await executeRunAction(executableAction, conversationId)
              const payload = {
                id: executableAction.id,
                command: executableAction.command,
                session: execution.session,
                running: execution.running,
                stdout: execution.stdout,
                stderr: execution.stderr,
                exitCode: execution.exitCode,
                elapsedMs: Math.round(execution.elapsedMs),
                waitedMs: execution.waitedMs,
                resolvedCommand: execution.resolvedCommand,
                resolvedCwd: execution.resolvedCwd,
                inferredRuntime: execution.inferredRuntime,
                pid: execution.pid,
                startedAt: execution.startedAt,
                updatedAt: execution.updatedAt,
                completedAt: execution.completedAt,
              }
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'run',
                status: execution.running ? 'running' : execution.ok ? 'success' : 'error',
                error:
                  execution.running
                    ? undefined
                    : execution.ok
                      ? undefined
                      : execution.stderr.trim() || `退出码 ${execution.exitCode}`,
                result: formatSkillStepResult(payload),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: execution.ok ? 'run_result' : 'run_error',
                payload: {
                  request: serializeRunActionForHost(executableAction),
                  result: payload,
                },
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'run 执行失败'
              const payload = {
                id: executableAction.id,
                command: executableAction.command,
                session: executableAction.session,
                error: message,
              }
              patchRoundSkillNode(roundContext, assistantId, actionToken, {
                actionKind: 'run',
                status: 'error',
                error: message,
                result: formatSkillStepResult(payload),
              })
              appendHostMessage({
                kind: 'host_message',
                id: createId(),
                turnId,
                roundId,
                createdAt: Date.now(),
                category: 'run_error',
                payload: {
                  request: serializeRunActionForHost(executableAction),
                  result: payload,
                },
              })
            }
            continue
          }

          const actionToken =
            roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-skill-call-${actionIndex + 1}`
          const executableAction = applyPermissionGatesToSkillCall(action, settings.permissionToggles)
          patchRoundSkillNode(roundContext, assistantId, actionToken, {
            actionKind: 'skill_call',
            skill: action.skill,
            script: action.script,
            status: 'running',
            error: undefined,
          })

          try {
            const execution = await executeSkillCall(executableAction, conversationId)
            const payload = {
              ...parseActionExecutionPayload(executableAction, execution.stdout, execution.stderr),
              exitCode: execution.exitCode,
              elapsedMs: Math.round(execution.elapsedMs),
              resolvedCommand: execution.resolvedCommand,
              inferredRuntime: execution.inferredRuntime,
            }
            patchRoundSkillNode(roundContext, assistantId, actionToken, {
              actionKind: 'skill_call',
              status: execution.ok ? 'success' : 'error',
              error: execution.ok ? undefined : execution.stderr.trim() || `退出码 ${execution.exitCode}`,
              result: formatSkillStepResult(payload),
            })
            appendHostMessage({
              kind: 'host_message',
              id: createId(),
              turnId,
              roundId,
              createdAt: Date.now(),
              category: execution.ok ? 'skill_result' : 'skill_error',
              payload: {
                request: executableAction,
                result: payload,
              },
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'skill 执行失败'
            const payload = {
              id: action.id,
              skill: action.skill,
              script: action.script,
              error: message,
            }
            patchRoundSkillNode(roundContext, assistantId, actionToken, {
              actionKind: 'skill_call',
              status: 'error',
              error: message,
              result: formatSkillStepResult(payload),
            })
            appendHostMessage({
              kind: 'host_message',
              id: createId(),
              turnId,
              roundId,
              createdAt: Date.now(),
              category: 'skill_error',
              payload: {
                request: executableAction,
                result: payload,
              },
            })
          }
        }
      }

      if (!finalCompletion) {
        throw new Error('skill agent 未返回最终结果。')
      }

      appendSkillRoundLog({
        event: 'request_finalized',
        traceId,
        roundCount: executedRoundCount,
        finalAssistantText: truncateDebugLogText(finalCompletion.text),
        finalAssistantDisplayText:
          finalCompletionDisplayText !== undefined
            ? truncateDebugLogText(finalCompletionDisplayText)
            : undefined,
        finalReasoning: truncateDebugLogText(finalCompletion.reasoning ?? ''),
      })
      return 'completed'
    } catch (error) {
      flushQueuedAssistantStreamDelta()
      appendSkillRoundLog({
        event: 'request_error',
        traceId,
        aborted: error instanceof DOMException && error.name === 'AbortError',
        error: error instanceof Error ? truncateDebugLogText(error.message, 500) : '未知错误',
      })
      if (latestAssistantId) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          updateAssistantEvent(conversationId, latestAssistantId, (event) => ({
            ...event,
            rawText: latestAssistantRawText,
            error: '已停止生成，可点击重生继续。',
          }))
        } else {
          const message = error instanceof Error ? error.message : '未知错误'
          updateAssistantEvent(conversationId, latestAssistantId, (event) => ({
            ...event,
            rawText: latestAssistantRawText,
            error: `请求失败：${message}`,
          }))
          pushNotice(`请求失败：${message}`, 'error')
        }
      }
      return error instanceof DOMException && error.name === 'AbortError' ? 'aborted' : 'failed'
    } finally {
      flushQueuedAssistantStreamDelta()
    }
  }

  const processQueuedTurnExecutions = async (): Promise<void> => {
    if (processingTurnQueueRef.current) {
      return
    }

    processingTurnQueueRef.current = true
    setIsSending(true)

    try {
      for (;;) {
        const job = queuedTurnExecutionsRef.current.shift()
        if (!job) {
          break
        }

        const historyTranscript = job.historyTranscript ?? buildTurnHistoryTranscript(job.conversationId, job.turnId)
        if (!historyTranscript) {
          clearQueuedTurnExecutions()
          break
        }

        setActiveRequestConversationId(job.conversationId)
        const controller = new AbortController()
        setAbortController(controller)

        const outcome = await executeAssistantTurn(
          job.conversationId,
          historyTranscript,
          job.turnId,
          job.responseMode,
          controller,
        )

        setAbortController(null)

        if (outcome !== 'completed') {
          clearQueuedTurnExecutions()
          break
        }
      }
    } finally {
      processingTurnQueueRef.current = false
      setAbortController(null)
      setActiveRequestConversationId(null)
      const shouldRestart = queuedTurnExecutionsRef.current.length > 0
      if (!shouldRestart) {
        setIsSending(false)
      }
      if (shouldRestart) {
        void processQueuedTurnExecutions()
      }
    }
  }

  const enqueueTurnExecution = (job: TurnExecutionJob): void => {
    queuedTurnExecutionsRef.current.push(job)
    if (processingTurnQueueRef.current) {
      return
    }
    void processQueuedTurnExecutions()
  }

  const runObjectFlowDebugScenario = async (
    conversationId: string,
    _historyTranscript: TranscriptEvent[],
    turnId: string,
  ): Promise<void> => {
    const assistantId = createId()
    appendConversationTranscriptEvents(conversationId, [
      {
        kind: 'assistant_message',
        id: assistantId,
        turnId,
        createdAt: Date.now(),
        rawText: '',
        model: activeProviderRequestSettings?.currentModel ?? 'debug-object-flow',
      },
    ])
    setIsSending(true)

    const wait = (milliseconds: number): Promise<void> =>
      new Promise((resolve) => window.setTimeout(resolve, milliseconds))

    try {
      const roundId = createId()
      const token = 'debug-skill-1'

      appendAssistantStreamDelta(conversationId, assistantId, {
        content: '段落1（debug）\n\n',
        roundId,
      })
      flushQueuedAssistantStreamDelta()
      await wait(120)

      appendAssistantStreamDelta(conversationId, assistantId, {
        content: createSkillActionPlaceholder(token),
        roundId,
      })
      flushQueuedAssistantStreamDelta()
      updateAssistantEvent(conversationId, assistantId, (event) => {
        const nextFlow = upsertAssistantFlowSkillNodeByToken(
          event.assistantFlow,
          token,
          {
            actionKind: 'run',
            status: 'running',
            skill: 'device-info',
            script: 'scripts/get_device_info.internal',
            result: formatStructuredMarkdown({
              stage: 'open',
              kind: 'run',
              skill: 'device-info',
              script: 'scripts/get_device_info.internal',
            }),
          },
          {
            createId,
            roundId,
          },
        ).flow
        return applyAssistantFlowState(event, nextFlow)
      })
      await wait(120)

      appendAssistantStreamDelta(conversationId, assistantId, {
        content: '\n\n段落2（debug）',
        roundId,
      })
      flushQueuedAssistantStreamDelta()
      await wait(120)

      updateAssistantEvent(conversationId, assistantId, (event) => {
        const nextFlow = upsertAssistantFlowSkillNodeByToken(
          event.assistantFlow,
          token,
          {
            actionKind: 'run',
            status: 'success',
            result: formatStructuredMarkdown({
              stage: 'close',
              id: 'debug:run',
              skill: 'device-info',
              script: 'scripts/get_device_info.internal',
              exitCode: 0,
            }),
          },
          {
            createId,
            roundId,
          },
        ).flow
        return applyAssistantFlowState(event, nextFlow)
      })

      appendAssistantFlowRoundDivider(conversationId, assistantId, roundId)
      appendAssistantStreamDelta(conversationId, assistantId, { content: '\n\n段落3（debug）' })
      flushQueuedAssistantStreamDelta()
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!canSend || !activeConversation) {
      return
    }

    const maybeStartHomepageSendTransition = (): void => {
      if (!isHomepageEmptyState || typeof window === 'undefined') {
        return
      }

      const showcaseRect = homepageShowcaseRef.current?.getBoundingClientRect()
      const messageListRect = messageListRef.current?.getBoundingClientRect()
      const summaryRect = chatSummaryBarRef.current?.getBoundingClientRect()

      const resolvedShowcaseRect =
        showcaseRect && showcaseRect.width > 0 && showcaseRect.height > 0
          ? rectToSnapshot(showcaseRect)
          : messageListRect && messageListRect.width > 0 && messageListRect.height > 0
            ? rectToSnapshot(messageListRect)
            : createViewportRectSnapshot()

      setHomepageSendTransition({
        cover: resolvedDailyCover,
        showcaseRect: resolvedShowcaseRect,
        summaryRect:
          summaryRect && summaryRect.width > 0 && summaryRect.height > 0
            ? rectToSnapshot(summaryRect)
            : undefined,
        highlightStats: homepageHighlightStats,
        responseModeLabel: getResponseModeLabel(activeConversationResponseMode),
        summary: chatSummarySnapshot,
      })
    }

    const trimmedDraft = draft.trim()
    const normalizedDraftCommand = trimmedDraft.toLowerCase().replace(/\s+/g, '')
    const compactDraftCommand = normalizedDraftCommand.replace(/[^\w/:-]/g, '')
    const isDebugLogExportCommand =
      compactDraftCommand === '/debug-logs' ||
      compactDraftCommand === 'debug-logs' ||
      compactDraftCommand === 'debug_logs' ||
      compactDraftCommand === '/debug-log-export' ||
      compactDraftCommand === 'debug-log-export' ||
      compactDraftCommand === 'debug_log_export' ||
      compactDraftCommand === '/debug-log-dump' ||
      compactDraftCommand === 'debug-log-dump' ||
      compactDraftCommand === 'debug_log_dump'
    const isDebugLogClearCommand =
      compactDraftCommand === '/debug-clear-logs' ||
      compactDraftCommand === 'debug-clear-logs' ||
      compactDraftCommand === 'debug_clear_logs'
    const isObjectFlowDebugCommand =
      /debug[-_]?object[-_]?flow/i.test(trimmedDraft) ||
      compactDraftCommand.includes('debug-object-flow') ||
      compactDraftCommand.includes('debug_object_flow') ||
      compactDraftCommand.includes('/debug-object-flow') ||
      compactDraftCommand.includes('/debug_object_flow')

    if (isDebugLogClearCommand) {
      maybeStartHomepageSendTransition()
      clearDebugLogEntries(DEBUG_SKILL_ROUND_LOG_STORAGE_KEY)
      clearDebugLogEntries(DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY)
      lastSkillRoundLogKeyRef.current = ''
      lastObjectFlowLogKeyRef.current = ''
      const turnId = createId()
      appendConversationTranscriptEvents(activeConversation.id, [
        createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft)),
        createStaticAssistantEvent(
          turnId,
          '调试日志已清空。接下来可以运行真实 skill 测试，再用 /debug-log-export 导出两份日志。',
          activeProviderRequestSettings?.currentModel ?? 'debug-log',
        ),
      ])
      resetComposerState(activeConversation.id)
      return
    }

    if (isDebugLogExportCommand) {
      maybeStartHomepageSendTransition()
      const roundLogs = readDebugLogEntries(DEBUG_SKILL_ROUND_LOG_STORAGE_KEY)
      const objectLogs = readDebugLogEntries(DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY)
      const turnId = createId()
      appendConversationTranscriptEvents(activeConversation.id, [
        createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft)),
        createStaticAssistantEvent(
          turnId,
          buildDebugLogReportText(roundLogs, objectLogs),
          activeProviderRequestSettings?.currentModel ?? 'debug-log',
        ),
      ])
      resetComposerState(activeConversation.id)
      return
    }

    if (isObjectFlowDebugCommand) {
      maybeStartHomepageSendTransition()
      const turnId = createId()
      const userEvent = createUserMessageTranscriptEvent(
        turnId,
        Date.now(),
        buildUserTranscriptContent(trimmedDraft),
      )
      const historyTranscript = [...activeConversation.transcript, userEvent]
      appendConversationTranscriptEvents(activeConversation.id, [userEvent])
      resetComposerState(activeConversation.id)
      await runObjectFlowDebugScenario(activeConversation.id, historyTranscript, turnId)
      return
    }

    if (!ensureReadyToRequest()) {
      return
    }

    const outgoingImages = buildOutgoingImageAttachments(pendingImages)
    const turnId = createId()
    const userEvent = createUserMessageTranscriptEvent(
      turnId,
      Date.now(),
      buildUserTranscriptContent(trimmedDraft, outgoingImages),
    )
    const historyTranscript = [...activeConversation.transcript, userEvent]
    maybeStartHomepageSendTransition()
    appendConversationTranscriptEvents(activeConversation.id, [userEvent])
    resetComposerState(activeConversation.id)
    enqueueTurnExecution({
      conversationId: activeConversation.id,
      turnId,
      responseMode: activeConversationResponseMode,
      historyTranscript,
    })
  }

  const handleAppend = (): void => {
    if (
      !activeConversation ||
      activeConversationResponseMode !== 'tool' ||
      !isSending ||
      !isRunningInActiveConversation
    ) {
      return
    }

    const trimmedDraft = draft.trim()
    const outgoingImages = buildOutgoingImageAttachments(pendingImages)
    if (!trimmedDraft && outgoingImages.length === 0) {
      return
    }

    const turnId = createId()
    const userEvent = createUserMessageTranscriptEvent(
      turnId,
      Date.now(),
      buildUserTranscriptContent(trimmedDraft, outgoingImages),
    )
    appendConversationTranscriptEvents(activeConversation.id, [userEvent])
    resetComposerState(activeConversation.id)
    enqueueTurnExecution({
      conversationId: activeConversation.id,
      turnId,
      responseMode: activeConversationResponseMode,
    })
  }

  const stopGeneration = (): void => {
    clearQueuedTurnExecutions()
    abortController?.abort()
  }

  const fetchProviderModels = async (providerId: string): Promise<void> => {
    const provider = useSettingsStore.getState().settings.providers.find((item) => item.id === providerId)
    if (!provider) {
      return
    }

    if (!provider.apiBaseUrl.trim() || !provider.apiKey.trim()) {
      pushNotice('请先填写该服务商的 URL 和 API Key。', 'error')
      return
    }

    setIsFetchingModelsByProviderId((previous) => ({
      ...previous,
      [providerId]: true,
    }))
    try {
      const response = await fetch(buildApiUrl(provider.apiBaseUrl, '/models'), {
        headers: authHeaders(provider.apiKey),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

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
        const existing = new Map(currentProvider.models.map((model) => [model.id, model]))
        for (const modelId of incoming) {
          if (!existing.has(modelId)) {
            existing.set(modelId, { id: modelId, enabled: false })
          }
        }
        return {
          ...currentProvider,
          models: Array.from(existing.values()),
        }
      })

      setModelHealth((previous) => {
        const updated = { ...previous }
        for (const modelId of incoming) {
          const key = createProviderModelKey(providerId, modelId)
          if (!updated[key]) {
            updated[key] = 'untested'
          }
        }
        return updated
      })

      pushNotice(`已为 ${provider.name || '当前服务商'} 加载 ${incoming.length} 个模型。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '模型加载失败'
      pushNotice(`模型加载失败：${message}`, 'error')
    } finally {
      setIsFetchingModelsByProviderId((previous) => ({
        ...previous,
        [providerId]: false,
      }))
    }
  }

  const testProviderModel = async (providerId: string, modelId: string): Promise<void> => {
    const provider = useSettingsStore.getState().settings.providers.find((item) => item.id === providerId)
    if (!provider) {
      return
    }

    if (!provider.apiBaseUrl.trim() || !provider.apiKey.trim()) {
      pushNotice('请先填写该服务商的 URL 和 API Key。', 'error')
      return
    }

    const healthKey = createProviderModelKey(providerId, modelId)
    setModelHealth((previous) => ({ ...previous, [healthKey]: 'testing' }))
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

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      setModelHealth((previous) => ({ ...previous, [healthKey]: 'ok' }))
      pushNotice(`模型 ${modelId} 检测成功。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '检测失败'
      setModelHealth((previous) => ({ ...previous, [healthKey]: 'error' }))
      pushNotice(`模型 ${modelId} 检测失败：${message}`, 'error')
    }
  }

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    try {
      const attachments = await createImageAttachments(files)
      const prepared: PendingImageAttachment[] = attachments.map((attachment) => ({
        ...attachment,
        originalDataUrl: attachment.dataUrl,
        originalMimeType: attachment.mimeType,
        compressionRate: 0,
      }))
      setPendingImages((previous) => [...previous, ...prepared])
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片读取失败'
      pushNotice(message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  const removePendingImage = (imageId: string): void => {
    delete pendingImageCompressionTaskIdRef.current[imageId]
    setPendingImages((previous) => previous.filter((image) => image.id !== imageId))
  }

  const updatePendingImageCompression = (imageId: string, compressionRate: number): void => {
    const normalizedRate = Math.max(0, Math.min(100, Math.round(compressionRate)))
    const target = pendingImages.find((image) => image.id === imageId)
    if (!target) {
      return
    }

    setPendingImages((previous) =>
      previous.map((image) =>
        image.id === imageId
          ? {
              ...image,
              compressionRate: normalizedRate,
            }
          : image,
      ),
    )

    const taskId = (pendingImageCompressionTaskIdRef.current[imageId] ?? 0) + 1
    pendingImageCompressionTaskIdRef.current[imageId] = taskId
    void (async () => {
      const compressed = await compressImageDataUrl({
        dataUrl: target.originalDataUrl,
        mimeType: target.originalMimeType,
        compressionRate: normalizedRate,
      })
      if (pendingImageCompressionTaskIdRef.current[imageId] !== taskId) {
        return
      }
      setPendingImages((previous) =>
        previous.map((image) =>
          image.id === imageId
            ? {
                ...image,
                dataUrl: compressed.dataUrl,
                mimeType: compressed.mimeType,
                size: compressed.size,
              }
            : image,
        ),
      )
    })().catch((error) => {
      if (pendingImageCompressionTaskIdRef.current[imageId] !== taskId) {
        return
      }
      const message = error instanceof Error ? error.message : '图片压缩失败'
      pushNotice(message, 'error')
    })
  }

  const beginEdit = (message: ChatMessage): void => {
    setEditingMessageId(message.id)
    setEditingText(message.text)
  }

  const cancelEdit = (): void => {
    setEditingMessageId(null)
    setEditingText('')
  }

  const saveAssistantEdit = (): void => {
    if (!editingMessageId || !activeConversation) {
      return
    }
    const nextText = editingText.trim()
    if (!nextText) {
      pushNotice('内容不能为空。', 'error')
      return
    }
    const target = activeMessages.find((message) => message.id === editingMessageId && message.role === 'assistant')
    if (!target) {
      cancelEdit()
      return
    }

    let inserted = false
    const replacement = createStaticAssistantEvent(
      target.turnId,
      nextText,
      activeProviderRequestSettings?.currentModel,
    )
    const nextTranscript = activeConversation.transcript.flatMap((event) => {
      if (event.turnId !== target.turnId) {
        return [event]
      }
      if (event.kind === 'user_message') {
        inserted = true
        return [event, replacement]
      }
      return []
    })

    if (!inserted) {
      cancelEdit()
      return
    }

    updateConversationTranscript(activeConversation.id, nextTranscript)
    cancelEdit()
  }

  const saveUserEdit = async (resend: boolean): Promise<void> => {
    if (!editingMessageId || !activeConversation) {
      return
    }
    const nextText = editingText.trim()
    if (!nextText) {
      pushNotice('内容不能为空。', 'error')
      return
    }

    const target = activeMessages.find((message) => message.id === editingMessageId && message.role === 'user')
    if (!target) {
      cancelEdit()
      return
    }

    const userEvent = activeConversation.transcript.find(
      (event): event is UserMessageTranscriptEvent => event.kind === 'user_message' && event.id === editingMessageId,
    )
    if (!userEvent) {
      cancelEdit()
      return
    }

    const existingImages = userEvent.content
      .filter((part): part is Extract<TranscriptContentPart, { type: 'image' }> => part.type === 'image')
      .map((part) => part.image)
    const updatedUserEvent: UserMessageTranscriptEvent = {
      ...userEvent,
      content: buildUserTranscriptContent(nextText, existingImages),
    }

    if (!resend) {
      const nextTranscript = activeConversation.transcript.map((event) =>
        event.kind === 'user_message' && event.id === editingMessageId ? updatedUserEvent : event,
      )
      updateConversationTranscript(activeConversation.id, nextTranscript)
      cancelEdit()
      return
    }

    if (isSending) {
      pushNotice('请先停止当前生成。', 'error')
      return
    }

    if (!ensureReadyToRequest()) {
      return
    }

    const nextTranscript: TranscriptEvent[] = []
    for (const event of activeConversation.transcript) {
      if (event.kind === 'user_message' && event.id === editingMessageId) {
        nextTranscript.push(updatedUserEvent)
        break
      }
      nextTranscript.push(event)
    }

    cancelEdit()
    updateConversationTranscript(activeConversation.id, nextTranscript)
    enqueueTurnExecution({
      conversationId: activeConversation.id,
      turnId: updatedUserEvent.turnId,
      responseMode: activeConversationResponseMode,
      historyTranscript: nextTranscript,
    })
  }

  const regenerate = async (assistantId: string): Promise<void> => {
    if (!activeConversation || isSending) {
      if (isSending) {
        pushNotice('请先停止当前生成。', 'error')
      }
      return
    }

    const target = activeMessages.find((message) => message.id === assistantId && message.role === 'assistant')
    if (!target) {
      return
    }

    const userEventIndex = activeConversation.transcript.findIndex(
      (event) => event.kind === 'user_message' && event.turnId === target.turnId,
    )
    if (userEventIndex < 0) {
      pushNotice('无法定位该回答对应的用户输入。', 'error')
      return
    }

    const historyTranscript = activeConversation.transcript.slice(0, userEventIndex + 1)
    updateConversationTranscript(activeConversation.id, historyTranscript)
    enqueueTurnExecution({
      conversationId: activeConversation.id,
      turnId: target.turnId,
      responseMode: activeConversationResponseMode,
      historyTranscript,
    })
  }

  const copyMessageText = async (text: string): Promise<void> => {
    const copied = await copyTextToClipboard(text)
    if (copied) {
      pushNotice('已复制到剪贴板。', 'success')
    } else {
      pushNotice('复制失败，请检查剪贴板权限。', 'error')
    }
  }

  const clearTitleTransitionTimers = useCallback((): void => {
    if (titleTransitionAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(titleTransitionAnimationFrameRef.current)
      titleTransitionAnimationFrameRef.current = null
    }
    if (titleTransitionTimerRef.current !== null) {
      window.clearTimeout(titleTransitionTimerRef.current)
      titleTransitionTimerRef.current = null
    }
  }, [])

  const playTitleTransition = useCallback((nextTransition: TitleTransitionState): void => {
    clearTitleTransitionTimers()
    setTitleTransition(nextTransition)
    titleTransitionAnimationFrameRef.current = window.requestAnimationFrame(() => {
      titleTransitionAnimationFrameRef.current = null
      setTitleTransition((previous) => (previous ? { ...previous, playing: true } : previous))
      titleTransitionTimerRef.current = window.setTimeout(() => {
        setTitleTransition(null)
        titleTransitionTimerRef.current = null
      }, TITLE_EDIT_TRANSITION_MS)
    })
  }, [clearTitleTransitionTimers])

  const stopRenameConversationImmediately = useCallback((): void => {
    titleTransitionPrepRef.current = null
    clearTitleTransitionTimers()
    setTitleTransition(null)
    setIsEditingTitle(false)
    setTitleDraft('')
  }, [clearTitleTransitionTimers])

  const clearMessageListInteractionTimer = useCallback((): void => {
    if (messageListInteractionTimerRef.current !== null) {
      window.clearTimeout(messageListInteractionTimerRef.current)
      messageListInteractionTimerRef.current = null
    }
  }, [])

  const clearProgrammaticMessageListScrollTracking = useCallback((): void => {
    if (messageListProgrammaticScrollAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(messageListProgrammaticScrollAnimationFrameRef.current)
      messageListProgrammaticScrollAnimationFrameRef.current = null
    }
    messageListProgrammaticScrollRef.current = false
  }, [])

  const cancelMessageListSmoothScroll = useCallback((): void => {
    if (messageListSmoothScrollAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(messageListSmoothScrollAnimationFrameRef.current)
      messageListSmoothScrollAnimationFrameRef.current = null
    }
    messageListSmoothScrollInProgressRef.current = false
  }, [])

  const getMessageListScrollMetrics = useCallback(
    (
      messageList?: HTMLElement | null,
    ): MessageListScrollMetrics & {
      atBottom: boolean
    } => {
      const target = messageList ?? messageListRef.current
      if (!target) {
        return {
          bottomOffset: 0,
          viewportHeight: 0,
          atBottom: true,
        }
      }

      const viewportHeight = Math.max(0, target.clientHeight)
      const bottomOffset = Math.max(0, target.scrollHeight - target.scrollTop - viewportHeight)
      return {
        bottomOffset,
        viewportHeight,
        atBottom: bottomOffset <= MESSAGE_LIST_BOTTOM_THRESHOLD_PX,
      }
    },
    [],
  )

  const syncMessageListScrollMetrics = useCallback(
    (
      messageList?: HTMLElement | null,
    ): MessageListScrollMetrics & {
      atBottom: boolean
    } => {
      const next = getMessageListScrollMetrics(messageList)
      setMessageListScrollMetrics((previous) =>
        previous.bottomOffset === next.bottomOffset && previous.viewportHeight === next.viewportHeight
          ? previous
          : {
              bottomOffset: next.bottomOffset,
              viewportHeight: next.viewportHeight,
            },
      )
      return next
    },
    [getMessageListScrollMetrics],
  )

  const isMessageListAtBottom = useCallback((): boolean => {
    return getMessageListScrollMetrics().atBottom
  }, [getMessageListScrollMetrics])

  const trackProgrammaticMessageListScroll = useCallback(
    (maxDurationMs: number): void => {
      clearProgrammaticMessageListScrollTracking()
      messageListProgrammaticScrollRef.current = true
      const startedAt = window.performance.now()

      const tick = (): void => {
        const elapsedMs = window.performance.now() - startedAt
        const metrics = getMessageListScrollMetrics()
        if (metrics.atBottom || elapsedMs >= maxDurationMs) {
          clearProgrammaticMessageListScrollTracking()
          syncMessageListScrollMetrics()
          return
        }

        messageListProgrammaticScrollAnimationFrameRef.current = window.requestAnimationFrame(tick)
      }

      messageListProgrammaticScrollAnimationFrameRef.current = window.requestAnimationFrame(tick)
    },
    [
      clearProgrammaticMessageListScrollTracking,
      getMessageListScrollMetrics,
      syncMessageListScrollMetrics,
    ],
  )

  const scrollMessageListToBottom = useCallback((): void => {
    if (messageListSmoothScrollInProgressRef.current) {
      return
    }

    const messageList = messageListRef.current
    if (!messageList) {
      return
    }

    cancelMessageListSmoothScroll()
    trackProgrammaticMessageListScroll(MESSAGE_LIST_AUTO_SCROLL_MAX_MS)
    setMessageListScrollMetrics({
      bottomOffset: 0,
      viewportHeight: Math.max(0, messageList.clientHeight),
    })

    if (typeof messageList.scrollTo === 'function') {
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: 'auto',
      })
      return
    }

    messageList.scrollTop = messageList.scrollHeight
  }, [cancelMessageListSmoothScroll, trackProgrammaticMessageListScroll])

  const smoothScrollMessageListToBottom = useCallback(
    (
      options?: {
        enableAutoFollowOnComplete?: boolean
      },
    ): void => {
    const messageList = messageListRef.current
    if (!messageList) {
      return
    }

    cancelMessageListSmoothScroll()
    clearProgrammaticMessageListScrollTracking()
    messageListProgrammaticScrollRef.current = true
    messageListSmoothScrollInProgressRef.current = true
    setMessageListScrollMetrics({
      bottomOffset: 0,
      viewportHeight: Math.max(0, messageList.clientHeight),
    })

    let previousTimestamp = window.performance.now()

    const animate = (timestamp: number): void => {
      const currentMessageList = messageListRef.current
      if (!currentMessageList) {
        cancelMessageListSmoothScroll()
        clearProgrammaticMessageListScrollTracking()
        return
      }

      const deltaMs = Math.max(1, timestamp - previousTimestamp)
      previousTimestamp = timestamp

      const targetScrollTop = Math.max(
        0,
        currentMessageList.scrollHeight - currentMessageList.clientHeight,
      )
      const remainingDistance = Math.max(0, targetScrollTop - currentMessageList.scrollTop)

      if (remainingDistance <= 1) {
        currentMessageList.scrollTop = targetScrollTop
        cancelMessageListSmoothScroll()
        clearProgrammaticMessageListScrollTracking()
        syncMessageListScrollMetrics(currentMessageList)
        if (options?.enableAutoFollowOnComplete) {
          setIsAutoFollowEnabled(true)
        }
        return
      }

      const nextStep = resolveMessageListSmoothScrollStep({
        remainingDistance,
        deltaMs,
        viewportHeight: currentMessageList.clientHeight,
      })

      currentMessageList.scrollTop = Math.min(targetScrollTop, currentMessageList.scrollTop + nextStep)
      messageListSmoothScrollAnimationFrameRef.current = window.requestAnimationFrame(animate)
    }

    messageListSmoothScrollAnimationFrameRef.current = window.requestAnimationFrame(animate)
    },
    [
      cancelMessageListSmoothScroll,
      clearProgrammaticMessageListScrollTracking,
      syncMessageListScrollMetrics,
    ],
  )

  const beginMessageListInteraction = useCallback((): void => {
    cancelMessageListSmoothScroll()
    clearProgrammaticMessageListScrollTracking()
    clearMessageListInteractionTimer()
    messageListUserInteractingRef.current = true
  }, [
    cancelMessageListSmoothScroll,
    clearMessageListInteractionTimer,
    clearProgrammaticMessageListScrollTracking,
  ])

  const scheduleMessageListInteractionEnd = useCallback((): void => {
    clearMessageListInteractionTimer()
    messageListInteractionTimerRef.current = window.setTimeout(() => {
      messageListInteractionTimerRef.current = null
      messageListUserInteractingRef.current = false

      if (isMessageListAtBottom()) {
        setIsAutoFollowEnabled(true)
        scrollMessageListToBottom()
      }
    }, MESSAGE_LIST_INTERACTION_IDLE_MS)
  }, [clearMessageListInteractionTimer, isMessageListAtBottom, scrollMessageListToBottom])

  const handleMessageListScroll = useCallback(
    (event: UIEvent<HTMLElement>): void => {
      if (messageListProgrammaticScrollRef.current) {
        return
      }

      const metrics = syncMessageListScrollMetrics(event.currentTarget)

      beginMessageListInteraction()
      setIsAutoFollowEnabled((previous) => (previous === metrics.atBottom ? previous : metrics.atBottom))
      scheduleMessageListInteractionEnd()
    },
    [beginMessageListInteraction, scheduleMessageListInteractionEnd, syncMessageListScrollMetrics],
  )

  const handleMessageListPointerDownCapture = useCallback((): void => {
    beginMessageListInteraction()
  }, [beginMessageListInteraction])

  const handleMessageListPointerUpCapture = useCallback((): void => {
    scheduleMessageListInteractionEnd()
  }, [scheduleMessageListInteractionEnd])

  const handleMessageListPointerCancelCapture = useCallback((): void => {
    scheduleMessageListInteractionEnd()
  }, [scheduleMessageListInteractionEnd])

  const handleMessageListWheelCapture = useCallback(
    (): void => {
      beginMessageListInteraction()
      scheduleMessageListInteractionEnd()
    },
    [beginMessageListInteraction, scheduleMessageListInteractionEnd],
  )

  const handleScrollToBottomButtonClick = useCallback((): void => {
    clearMessageListInteractionTimer()
    messageListUserInteractingRef.current = false
    smoothScrollMessageListToBottom({
      enableAutoFollowOnComplete: true,
    })
  }, [clearMessageListInteractionTimer, smoothScrollMessageListToBottom])

  const switchConversation = (conversationId: string): void => {
    setActiveConversationId(conversationId)
    hydrateConversationById(conversationId)
    closeDrawer()
    closeModelMenu()
    setDeleteModeEnabled(false)
    closeDeleteDialog()
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
  }

  const clearConversationGestureTimer = (): void => {
    const gesture = conversationSwipeStartRef.current
    const longPressTimerId = gesture?.longPressTimerId ?? null
    if (longPressTimerId !== null && gesture) {
      window.clearTimeout(longPressTimerId)
      gesture.longPressTimerId = null
    }
  }

  const resetConversationSwipe = (): void => {
    clearConversationGestureTimer()
    conversationSwipeStartRef.current = null
    setSwipingConversationId(null)
    setSwipeOffsetX(0)
  }

  const toggleDeleteMode = (): void => {
    setDeleteModeEnabled((previous) => !previous)
  }

  const extendDeleteConfirmGrace = (): void => {
    const deleteConfirmGraceMs = Math.max(0, settings.deleteConfirmGraceSeconds) * 1000
    deleteConfirmBypassUntilRef.current =
      deleteConfirmGraceMs > 0 ? Date.now() + deleteConfirmGraceMs : 0
  }

  const deleteConversation = (conversationId: string): void => {
    let deletedActiveConversation = false
    let nextActiveConversationId: string | null = null

    void deleteConversationStorage(conversationId).catch((error) => {
      const message = error instanceof Error ? error.message : '删除对话工作区失败'
      pushNotice(`删除对话工作区失败：${message}`, 'error')
    })

    const dlg = useUIStore.getState().deleteDialog
    if (dlg?.type === 'conversation' && dlg.targetId === conversationId) {
      closeDeleteDialog()
    }
    setDraftsByConversation((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, conversationId)) {
        return previous
      }
      const next = { ...previous }
      delete next[conversationId]
      return next
    })

    setConversationsState((previous) => {
      const exists = previous.some((conversation) => conversation.id === conversationId)
      if (!exists) {
        return previous
      }

      deletedActiveConversation = previous.some(
        (conversation) => conversation.id === conversationId && conversation.id === activeConversationId,
      )
      const remaining = previous.filter((conversation) => conversation.id !== conversationId)
      if (remaining.some((conversation) => conversation.id === activeConversationId)) {
        return remaining
      }

      const fallbackConversation =
        [...remaining].sort((left, right) => right.updatedAt - left.updatedAt)[0] ??
        createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
      nextActiveConversationId = fallbackConversation.id
      return remaining.length > 0 ? remaining : [fallbackConversation]
    })

    if (nextActiveConversationId) {
      setActiveConversationId(nextActiveConversationId)
    }
    if (deletedActiveConversation) {
      pendingImageCompressionTaskIdRef.current = {}
      setPendingImages([])
      cancelEdit()
      stopRenameConversationImmediately()
    }
    pushNotice('对话已删除。', 'success')
  }

  const closeDeleteDialog = useCallback((): void => {
    useUIStore.getState().closeDeleteDialog()
  }, [])

  const confirmDeleteConversation = (): void => {
    if (!deleteDialogConversationId) {
      return
    }

    extendDeleteConfirmGrace()
    const conversationId = deleteDialogConversationId
    closeDeleteDialog()
    deleteConversation(conversationId)
  }

  const confirmDeleteProvider = (): void => {
    if (!deleteDialogProviderId) {
      return
    }

    const providerId = deleteDialogProviderId
    closeDeleteDialog()
    deleteProvider(providerId)
  }

  const confirmDeleteSkill = (): void => {
    if (!deleteDialogSkillId) {
      return
    }

    const skillId = deleteDialogSkillId
    closeDeleteDialog()
    void deleteSkillById(skillId)
  }

  const confirmDeleteRuntime = (): void => {
    if (!deleteDialogRuntimeId) {
      return
    }

    const runtimeId = deleteDialogRuntimeId
    closeDeleteDialog()
    void deleteRuntimeById(runtimeId)
  }

  const requestDeleteConversation = (conversationId: string): void => {
    const now = Date.now()
    if (now <= deleteConfirmBypassUntilRef.current) {
      extendDeleteConfirmGrace()
      deleteConversation(conversationId)
      return
    }

    openDeleteDialog({ type: 'conversation', targetId: conversationId })
  }

  const handleConversationPointerDown = (
    conversationId: string,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    resetConversationSwipe()
    event.currentTarget.setPointerCapture(event.pointerId)

    const pointerId = event.pointerId
    const longPressTimerId = window.setTimeout(() => {
      const gesture = conversationSwipeStartRef.current
      if (!gesture || gesture.conversationId !== conversationId || gesture.pointerId !== pointerId) {
        return
      }

      gesture.longPressTriggered = true
      gesture.thresholdReached = false
      clearConversationGestureTimer()
      ignoreNextConversationClickRef.current = conversationId
      setSwipingConversationId(null)
      setSwipeOffsetX(0)
      if (settings.deleteModeHapticsEnabled) {
        vibrateInteraction()
      }
      toggleDeleteMode()
    }, LONG_PRESS_DELETE_MODE_MS)

    conversationSwipeStartRef.current = {
      conversationId,
      pointerId,
      x: event.clientX,
      y: event.clientY,
      thresholdReached: false,
      longPressTriggered: false,
      longPressTimerId,
    }
  }

  const handleConversationPointerMove = (
    conversationId: string,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const started = conversationSwipeStartRef.current
    if (!started || started.conversationId !== conversationId || started.pointerId !== event.pointerId) {
      return
    }

    if (started.longPressTriggered) {
      return
    }

    const deltaX = event.clientX - started.x
    const deltaY = event.clientY - started.y
    const movedBeyondLongPressTolerance =
      Math.abs(deltaX) > LONG_PRESS_MOVE_TOLERANCE_PX || Math.abs(deltaY) > LONG_PRESS_MOVE_TOLERANCE_PX

    if (movedBeyondLongPressTolerance) {
      clearConversationGestureTimer()
    }

    const horizontalDominant = Math.abs(deltaX) > Math.abs(deltaY) * 1.1
    if (!horizontalDominant) {
      if (swipingConversationId === conversationId) {
        setSwipeOffsetX(0)
      }
      return
    }

    event.preventDefault()
    const nextOffset = clamp(deltaX, -SWIPE_DELETE_MAX_OFFSET_PX, SWIPE_DELETE_MAX_OFFSET_PX)
    const reachedThreshold = Math.abs(deltaX) >= SWIPE_DELETE_TOGGLE_THRESHOLD_PX

    if (settings.deleteModeHapticsEnabled && reachedThreshold && !started.thresholdReached) {
      vibrateInteraction()
    }

    started.thresholdReached = reachedThreshold
    setSwipingConversationId(conversationId)
    setSwipeOffsetX(nextOffset)
  }

  const handleConversationPointerUp = (
    conversationId: string,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const started = conversationSwipeStartRef.current
    if (!started || started.conversationId !== conversationId || started.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    clearConversationGestureTimer()

    if (started.longPressTriggered) {
      ignoreNextConversationClickRef.current = conversationId
      resetConversationSwipe()
      return
    }

    const deltaX = event.clientX - started.x
    const deltaY = event.clientY - started.y
    const isSwipeDelete =
      Math.abs(deltaX) >= SWIPE_DELETE_TOGGLE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY) * 1.1

    if (isSwipeDelete) {
      ignoreNextConversationClickRef.current = conversationId
      toggleDeleteMode()
    }

    resetConversationSwipe()
  }

  const handleConversationPointerCancel = (): void => {
    resetConversationSwipe()
  }

  const handleConversationClick = (conversationId: string): void => {
    if (ignoreNextConversationClickRef.current === conversationId) {
      ignoreNextConversationClickRef.current = null
      return
    }
    switchConversation(conversationId)
  }

  const toggleConversationGroup = (groupId: string): void => {
    useUIStore.getState().toggleConversationGroup(groupId)
  }

  const createNewConversation = (): void => {
    const existingPlaceholder = conversations.find((conversation) =>
      conversation.storageLoadState === 'hydrated' &&
      isTranscriptConversationWorkspacePlaceholder(conversation, draftsByConversation[conversation.id] ?? ''),
    )
    const nextConversation =
      existingPlaceholder ?? createConversation([], useSettingsStore.getState().settings.defaultResponseMode)

    if (!existingPlaceholder) {
      setConversationsState((previous) => [nextConversation, ...previous])
    }

    setActiveConversationId(nextConversation.id)
    closeDrawer()
    closeModelMenu()
    setDeleteModeEnabled(false)
    closeDeleteDialog()
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
  }

  const toggleReasoning = (messageId: string): void => {
    useUIStore.getState().toggleReasoning(messageId)
  }

  const toggleSkillResult = (stepId: string): void => {
    useUIStore.getState().toggleSkillResult(stepId)
  }

  const focusTitleInput = useCallback((): void => {
    const input = titleInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const selectionEnd = input.value.length
    input.setSelectionRange(selectionEnd, selectionEnd)
  }, [])

  const beginRenameConversation = (): void => {
    if (!activeConversation || titleTransition || titleTransitionPrepRef.current) {
      return
    }

    const sourceTitleRect = snapshotRect(titleTextRef.current)
    const sourceTriggerRect = snapshotRect(titleRenameButtonRef.current)
    if (sourceTitleRect && sourceTriggerRect) {
      titleTransitionPrepRef.current = {
        phase: 'opening',
        titleText: activeConversation.title,
        sourceTitleRect,
        sourceTriggerRect,
      }
    }

    setTitleDraft(activeConversation.title)
    setIsEditingTitle(true)
  }

  const cancelRenameConversation = (): void => {
    if (!isEditingTitle || titleTransition || titleTransitionPrepRef.current) {
      return
    }

    const sourceTitleRect = snapshotRect(titleInputRef.current)
    const sourceTriggerRect = snapshotRect(titleActionsRef.current)
    if (sourceTitleRect && sourceTriggerRect) {
      titleTransitionPrepRef.current = {
        phase: 'closing',
        titleText: activeConversation?.title ?? titleDraft,
        sourceTitleRect,
        sourceTriggerRect,
      }
    }

    setIsEditingTitle(false)
    setTitleDraft('')
  }

  const saveRenameConversation = (): void => {
    if (!activeConversation || titleTransition || titleTransitionPrepRef.current) {
      return
    }
    const nextTitle = titleDraft.trim()
    if (!nextTitle) {
      pushNotice('对话标题不能为空。', 'error')
      return
    }

    const sourceTitleRect = snapshotRect(titleInputRef.current)
    const sourceTriggerRect = snapshotRect(titleActionsRef.current)
    if (sourceTitleRect && sourceTriggerRect) {
      titleTransitionPrepRef.current = {
        phase: 'closing',
        titleText: nextTitle,
        sourceTitleRect,
        sourceTriggerRect,
      }
    }

    updateConversationTitle(activeConversation.id, nextTitle, true)
    setIsEditingTitle(false)
    setTitleDraft('')
  }

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    const applyTheme = (): void => {
      const resolvedTheme =
        settings.themeMode === 'system' ? (mediaQuery?.matches ? 'dark' : 'light') : settings.themeMode
      root.setAttribute('data-theme', resolvedTheme)
    }

    applyTheme()
    if (settings.themeMode !== 'system' || !mediaQuery) {
      return
    }

    const handleSystemThemeChange = (): void => {
      applyTheme()
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange)
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }

    mediaQuery.addListener(handleSystemThemeChange)
    return () => mediaQuery.removeListener(handleSystemThemeChange)
  }, [settings.themeMode])

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-glass-blur', `${settings.chatBlurPx}px`)
  }, [settings.chatBlurPx])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        if (!storageWarningShownRef.current) {
          storageWarningShownRef.current = true
          setNotice({ text: '本地存储空间不足，设置可能不会被完整保存。', type: 'error' })
        }
        console.warn('Failed to persist settings', error)
      }
    }, SETTINGS_PERSIST_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [settings])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await loadChatIndex()
        if (cancelled) {
          return
        }

        const existingConversationIds = new Set(useChatStore.getState().conversations.map((conversation) => conversation.id))
        const nextConversations = [
          ...useChatStore.getState().conversations,
          ...loaded.conversations
            .filter((conversation) => !existingConversationIds.has(conversation.id))
            .map((conversation) => createSummaryConversation(conversation)),
        ]
        const nextDrafts = draftsByConversationRef.current
        const nextActiveConversationId =
          activeConversationIdRef.current ||
          nextConversations[0]?.id ||
          ''
        const nextPersistState = buildPersistChatState(
          nextConversations,
          nextDrafts,
          nextActiveConversationId,
        )
        chatStateSignatureRef.current = getChatStatePersistenceSignature(nextPersistState)
        startTransition(() => {
          setConversationsState(nextConversations)
          setHistoryStats(loaded.historyStats)
          setChatStateLoadError(null)
          setChatStateLoaded(true)
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        const message = error instanceof Error ? error.message : '未知错误'
        setChatStateLoadError(`聊天记录加载失败：${message}`)
        setNotice({ text: '历史对话索引加载失败，已暂停自动保存以避免覆盖现有记录。', type: 'error' })
        console.warn('Failed to load chat state', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [setConversationsState])

  const hydrateConversationById = useCallback(
    (conversationId: string): void => {
      if (!chatStateLoaded) {
        return
      }

      const targetConversation =
        useChatStore.getState().conversations.find((conversation) => conversation.id === conversationId) ?? null
      if (
        !targetConversation ||
        (targetConversation.storageLoadState !== 'summary' &&
          targetConversation.storageLoadState !== 'error')
      ) {
        return
      }

      setConversationsState((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                storageLoadState: 'hydrating',
                storageLoadError: undefined,
              }
            : conversation,
        ),
      )

      void (async () => {
        try {
          const loaded = await loadConversationState(conversationId)
          if (!loaded) {
            throw new Error('未找到该历史对话')
          }
          if (!useChatStore.getState().conversations.some((conversation) => conversation.id === conversationId)) {
            return
          }

          startTransition(() => {
            setConversationsState((previous) =>
              previous.map((conversation) =>
                conversation.id === conversationId
                  ? toHydratedConversation(loaded.conversation, loaded.draftText)
                  : conversation,
              ),
            )
            setDraftsByConversation((previous) => {
              const nextDraft = loaded.draftText
              if (!nextDraft.trim()) {
                if (!Object.prototype.hasOwnProperty.call(previous, conversationId)) {
                  return previous
                }
                const next = { ...previous }
                delete next[conversationId]
                return next
              }
              if (previous[conversationId] === nextDraft) {
                return previous
              }
              return {
                ...previous,
                [conversationId]: nextDraft,
              }
            })
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : '未知错误'
          startTransition(() => {
            setConversationsState((previous) =>
              previous.map((conversation) =>
                conversation.id === conversationId
                  ? {
                      ...conversation,
                      storageLoadState: 'error',
                      storageLoadError: message,
                    }
                  : conversation,
              ),
            )
          })
          console.warn('Failed to hydrate conversation', error)
        }
      })()
    },
    [chatStateLoaded, setConversationsState],
  )

  useEffect(() => {
    if (!chatStateLoaded) {
      return
    }

    const pendingLoads: Array<{
      conversationId: string
      messageId: string
      imageId: string
      storageKey: string
      mimeType: string
    }> = []

    for (const conversation of conversations) {
      for (const event of conversation.transcript) {
        if (event.kind !== 'user_message') {
          continue
        }
        for (const part of event.content) {
          if (part.type !== 'image') {
            continue
          }
          const image = part.image
          if (!image.storageKey || image.dataUrl.trim().length > 0) {
            continue
          }
          if (hydratingImageKeysRef.current.has(image.storageKey)) {
            continue
          }
          pendingLoads.push({
            conversationId: conversation.id,
            messageId: event.id,
            imageId: image.id,
            storageKey: image.storageKey,
            mimeType: image.mimeType,
          })
        }
      }
    }

    if (pendingLoads.length === 0) {
      return
    }

    let cancelled = false
    for (const item of pendingLoads) {
      hydratingImageKeysRef.current.add(item.storageKey)
    }

    void (async () => {
      try {
        const hydrated = await Promise.all(
          pendingLoads.map(async (item) => ({
            ...item,
            dataUrl: await loadStoredAttachmentDataUrl(item.storageKey, item.mimeType),
          })),
        )
        if (cancelled) {
          return
        }
        const resolved = hydrated.filter(
          (item): item is typeof item & { dataUrl: string } => typeof item.dataUrl === 'string' && item.dataUrl.length > 0,
        )
        if (resolved.length === 0) {
          return
        }
        startTransition(() => {
          setConversationsState((previous) =>
            previous.map((conversation) => {
              const nextTranscript = conversation.transcript.map((event) => {
                if (event.kind !== 'user_message') {
                  return event
                }
                const matchedImages = resolved.filter(
                  (item) => item.conversationId === conversation.id && item.messageId === event.id,
                )
                if (matchedImages.length === 0) {
                  return event
                }
                return {
                  ...event,
                  content: event.content.map((part) => {
                    if (part.type !== 'image') {
                      return part
                    }
                    const matched = matchedImages.find((item) => item.imageId === part.image.id)
                    return matched
                      ? {
                          type: 'image' as const,
                          image: {
                            ...part.image,
                            dataUrl: matched.dataUrl,
                          },
                        }
                      : part
                  }),
                }
              })
              return {
                ...conversation,
                transcript: nextTranscript,
              }
            }),
          )
        })
      } finally {
        for (const item of pendingLoads) {
          hydratingImageKeysRef.current.delete(item.storageKey)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [chatStateLoaded, conversations, setConversationsState])

  useEffect(() => {
    if (!chatStateLoaded) {
      return
    }

    const nextState = buildPersistChatState(
      conversations,
      draftsByConversation,
      activeConversationId,
    )
    const nextSignature = getChatStatePersistenceSignature(nextState)
    if (nextSignature === chatStateSignatureRef.current) {
      return
    }

    const taskId = conversationPersistTaskIdRef.current + 1
    conversationPersistTaskIdRef.current = taskId
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const persisted = await persistChatState(nextState)
          if (conversationPersistTaskIdRef.current !== taskId) {
            return
          }
          const nextConversationsWithStorageKeys = applyAssignedImageStorageKeys(
            conversations,
            persisted.assignedImageStorageKeys,
          )
          const normalizedState = buildPersistChatState(
            nextConversationsWithStorageKeys,
            draftsByConversation,
            activeConversationId,
          )

          chatStateSignatureRef.current = getChatStatePersistenceSignature(normalizedState)

          if (nextConversationsWithStorageKeys !== conversations) {
            startTransition(() => {
              setConversationsState(nextConversationsWithStorageKeys)
            })
          }
        } catch (error) {
          if (!storageWarningShownRef.current) {
            storageWarningShownRef.current = true
            setNotice({ text: '聊天记录持久化失败，请稍后重试。', type: 'error' })
          }
          console.warn('Failed to persist conversations', error)
        }
      })()
    }, CHAT_STATE_PERSIST_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [chatStateLoaded, conversations, draftsByConversation, activeConversationId, setConversationsState])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined
    }

    const root = document.documentElement
    root.style.setProperty('--native-top-inset', Capacitor.getPlatform() === 'android' ? '28px' : '0px')

    return () => {
      root.style.removeProperty('--native-top-inset')
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const root = document.documentElement
    const body = document.body
    const coverImageUrl = resolvedDailyCover?.imageUrl?.trim() ?? ''

    if (shouldShowHomepageBackground) {
      body.classList.add('homepage-empty-active')
      if (coverImageUrl) {
        root.style.setProperty('--homepage-body-cover-image', `url("${coverImageUrl}")`)
      } else {
        root.style.removeProperty('--homepage-body-cover-image')
      }
    } else {
      body.classList.remove('homepage-empty-active')
      root.style.removeProperty('--homepage-body-cover-image')
    }

    return () => {
      body.classList.remove('homepage-empty-active')
      root.style.removeProperty('--homepage-body-cover-image')
    }
  }, [resolvedDailyCover?.imageUrl, shouldShowHomepageBackground])

  useEffect(() => {
    void refreshExtensions()
  }, [pushNotice, refreshExtensions])

  useEffect(() => {
    if (!notice) {
      return undefined
    }
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (imageViewerMounted || !imageViewer) {
      return
    }
    setImageViewer(null)
  }, [imageViewer, imageViewerMounted])

  useEffect(() => {
    if (!imageViewerMounted || typeof document === 'undefined') {
      return undefined
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [imageViewerMounted])

  useEffect(() => {
    let isDisposed = false
    let listenerHandle: { remove: () => Promise<void> } | null = null

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (imageViewerMounted) {
        closeImageViewer()
        return
      }
      if (
        deleteDialogConversationId ||
        deleteDialogProviderId ||
        deleteDialogSkillId ||
        deleteDialogRuntimeId
      ) {
        closeDeleteDialog()
        return
      }
      if (modelMenuMounted) {
        closeModelMenu()
        return
      }
      if (settingsMounted) {
        handleSettingsBack()
        return
      }
      if (drawerMounted) {
        closeDrawer()
        return
      }
      if (canGoBack) {
        window.history.back()
        return
      }
      void CapacitorApp.exitApp()
    }).then((handle) => {
      if (isDisposed) {
        void handle.remove()
        return
      }
      listenerHandle = handle
    })

    return () => {
      isDisposed = true
      if (listenerHandle) {
        void listenerHandle.remove()
      }
    }
  }, [
    closeImageViewer,
    closeDrawer,
    closeDeleteDialog,
    closeModelMenu,
    deleteDialogConversationId,
    deleteDialogProviderId,
    deleteDialogSkillId,
    deleteDialogRuntimeId,
    drawerMounted,
    handleSettingsBack,
    imageViewerMounted,
    modelMenuMounted,
    settingsMounted,
  ])

  useLayoutEffect(() => {
    const prepared = titleTransitionPrepRef.current
    if (!prepared) {
      return
    }

    if (prepared.phase === 'opening') {
      const titleEndRect = snapshotRect(titleInputRef.current)
      const actionsEndRect = snapshotRect(titleActionsRef.current)

      if (!titleEndRect || !actionsEndRect) {
        titleTransitionPrepRef.current = null
        return
      }

      const offset = getTravelOffset(prepared.sourceTriggerRect, actionsEndRect)
      playTitleTransition({
        phase: 'opening',
        titleText: prepared.titleText,
        titleStartRect: prepared.sourceTitleRect,
        titleEndRect,
        penStartRect: prepared.sourceTriggerRect,
        penEndRect: shiftRect(prepared.sourceTriggerRect, offset.x, offset.y),
        actionsStartRect: shiftRect(actionsEndRect, -offset.x, -offset.y),
        actionsEndRect,
        playing: false,
      })
      titleTransitionPrepRef.current = null
      return
    }

    const titleEndRect = snapshotRect(titleTextRef.current)
    const penEndRect = snapshotRect(titleRenameButtonRef.current)
    if (!titleEndRect || !penEndRect) {
      titleTransitionPrepRef.current = null
      return
    }

    const offset = getTravelOffset(penEndRect, prepared.sourceTriggerRect)
    playTitleTransition({
      phase: 'closing',
      titleText: prepared.titleText,
      titleStartRect: prepared.sourceTitleRect,
      titleEndRect,
      penStartRect: shiftRect(penEndRect, offset.x, offset.y),
      penEndRect,
      actionsStartRect: prepared.sourceTriggerRect,
      actionsEndRect: shiftRect(prepared.sourceTriggerRect, -offset.x, -offset.y),
      playing: false,
    })
    titleTransitionPrepRef.current = null
  }, [isEditingTitle, activeConversation?.id, activeConversation?.title, playTitleTransition])

  useEffect(() => {
    if (!isEditingTitle || titleTransition || titleTransitionPrepRef.current) {
      return
    }
    focusTitleInput()
  }, [focusTitleInput, isEditingTitle, titleTransition, activeConversationId])

  useEffect(
    () => () => {
      clearTitleTransitionTimers()
    },
    [clearTitleTransitionTimers],
  )

  useEffect(
    () => () => {
      clearMessageListInteractionTimer()
    },
    [clearMessageListInteractionTimer],
  )

  useEffect(
    () => () => {
      clearProgrammaticMessageListScrollTracking()
    },
    [clearProgrammaticMessageListScrollTracking],
  )

  useEffect(
    () => () => {
      cancelMessageListSmoothScroll()
    },
    [cancelMessageListSmoothScroll],
  )

  useEffect(() => {
    pendingMessageListBottomResetRef.current = true
    clearMessageListInteractionTimer()
    clearProgrammaticMessageListScrollTracking()
    cancelMessageListSmoothScroll()
    messageListUserInteractingRef.current = false
    setMessageListScrollMetrics({
      bottomOffset: 0,
      viewportHeight: 0,
    })
    setIsAutoFollowEnabled(true)
  }, [
    activeConversationId,
    cancelMessageListSmoothScroll,
    clearMessageListInteractionTimer,
    clearProgrammaticMessageListScrollTracking,
  ])

  useLayoutEffect(() => {
    if (messageListUserInteractingRef.current) {
      return
    }

    if (messageListSmoothScrollInProgressRef.current) {
      return
    }

    if (pendingMessageListBottomResetRef.current) {
      scrollMessageListToBottom()
      pendingMessageListBottomResetRef.current = false
      return
    }

    if (!isAutoFollowEnabled) {
      return
    }

    scrollMessageListToBottom()
  }, [
    activeChatScrollInsets.bottom,
    activeChatScrollInsets.top,
    activeConversationId,
    activeMessages,
    isAutoFollowEnabled,
    isSending,
    scrollMessageListToBottom,
  ])

  useLayoutEffect(() => {
    if (messageListProgrammaticScrollRef.current) {
      return
    }

    syncMessageListScrollMetrics()
  }, [activeConversationId, activeMessages, isSending, syncMessageListScrollMetrics])

  useLayoutEffect(() => {
    if (!hasActiveMessages) {
      setActiveChatScrollInsets((previous) =>
        previous.top === 0 && previous.bottom === 0 ? previous : { top: 0, bottom: 0 },
      )
      return
    }

    const syncActiveChatScrollInsets = (): void => {
      const messageList = messageListRef.current
      const chatContentStack = chatContentStackRef.current
      const chatHeader = chatHeaderRef.current
      const summaryBar = chatSummaryBarRef.current
      const footer = composerFooterRef.current
      if (!messageList || !chatContentStack || !chatHeader || !summaryBar || !footer) {
        return
      }

      const messageListRect = messageList.getBoundingClientRect()
      const headerRect = chatHeader.getBoundingClientRect()
      const summaryRect = summaryBar.getBoundingClientRect()
      const footerRect = footer.getBoundingClientRect()
      const chatEqualMargin = Number.parseFloat(
        window.getComputedStyle(messageList).getPropertyValue('--chat-equal-margin'),
      )
      const equalMarginInset = Number.isFinite(chatEqualMargin) ? chatEqualMargin : 0
      const topChromeBottom = Math.max(headerRect.bottom, summaryRect.bottom)
      const topInset = Math.max(0, Math.round(topChromeBottom - messageListRect.top + equalMarginInset))
      const bottomInset = Math.max(0, Math.round(messageListRect.bottom - footerRect.top))
      const visibleContentHeight = Math.max(0, Math.round(messageList.clientHeight - bottomInset))
      const contentHeightWithoutInsets = Math.max(
        0,
        Math.round(chatContentStack.scrollHeight - activeChatScrollInsets.top - activeChatScrollInsets.bottom),
      )
      const shouldReserveBottomInset = contentHeightWithoutInsets + topInset > visibleContentHeight + 1
      const nextTop = topInset
      const nextBottom = shouldReserveBottomInset ? bottomInset : 0

      setActiveChatScrollInsets((previous) =>
        previous.top === nextTop && previous.bottom === nextBottom
          ? previous
          : {
              top: nextTop,
              bottom: nextBottom,
            },
      )
    }

    syncActiveChatScrollInsets()

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            syncActiveChatScrollInsets()
          })

    if (resizeObserver) {
      const observedElements = [
        messageListRef.current,
        chatContentStackRef.current,
        chatHeaderRef.current,
        chatSummaryBarRef.current,
        composerFooterRef.current,
      ].filter((element): element is HTMLElement => element !== null)
      observedElements.forEach((element) => resizeObserver.observe(element))
    } else {
      window.addEventListener('resize', syncActiveChatScrollInsets)
    }

    return () => {
      resizeObserver?.disconnect()
      if (!resizeObserver) {
        window.removeEventListener('resize', syncActiveChatScrollInsets)
      }
    }
  }, [
    activeChatScrollInsets.bottom,
    activeChatScrollInsets.top,
    activeConversationId,
    activeMessages,
    hasActiveMessages,
    isSending,
    pendingImages.length,
  ])

  useEffect(() => {
    if (shouldShowScrollToBottomButton) {
      showScrollToBottomButton()
      return
    }

    hideScrollToBottomButton()
  }, [hideScrollToBottomButton, shouldShowScrollToBottomButton, showScrollToBottomButton])

  useEffect(() => {
    const handleResize = (): void => {
      syncMessageListScrollMetrics()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [syncMessageListScrollMetrics])

  useEffect(() => {
    if (conversations.length === 0) {
      const fallback = createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
      setConversationsState([fallback])
      setActiveConversationId(fallback.id)
      return
    }

    if (!conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id)
    }
  }, [conversations, activeConversationId, setConversationsState])

  useEffect(() => {
    if (!deleteDialog) {
      return
    }

    const { type, targetId } = deleteDialog
    const exists =
      type === 'conversation' ? conversations.some((c) => c.id === targetId)
      : type === 'provider' ? settings.providers.some((p) => p.id === targetId)
      : type === 'skill' ? skillRecords.some((s) => s.id === targetId)
      : type === 'runtime' ? runtimeRecords.some((r) => r.id === targetId)
      : true

    if (!exists) {
      closeDeleteDialog()
    }
  }, [deleteDialog, conversations, settings.providers, skillRecords, runtimeRecords, closeDeleteDialog])

  useEffect(() => {
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
    closeModelMenu()
  }, [activeConversationId, closeModelMenu, stopRenameConversationImmediately])

  useEffect(() => {
    if (drawerMounted) {
      return
    }

    const gesture = conversationSwipeStartRef.current
    const longPressTimerId = gesture?.longPressTimerId ?? null
    if (longPressTimerId !== null) {
      window.clearTimeout(longPressTimerId)
    }
    conversationSwipeStartRef.current = null
    setSwipingConversationId(null)
    setSwipeOffsetX(0)
    setDeleteModeEnabled(false)
    closeDeleteDialog()
  }, [drawerMounted])

  useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (!modelMenuRef.current) {
        return
      }
      const target = event.target as Node
      if (!modelMenuRef.current.contains(target)) {
        closeModelMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [closeModelMenu])

  useEffect(() => {
    setCollapsedConversationGroups((previous) => {
      let changed = false
      const next: Record<string, boolean> = {}

      for (const group of conversationGroups) {
        if (Object.prototype.hasOwnProperty.call(previous, group.id)) {
          next[group.id] = previous[group.id]
          continue
        }
        next[group.id] = false
        changed = true
      }

      const previousKeys = Object.keys(previous)
      const nextKeys = Object.keys(next)
      if (!changed && previousKeys.length === nextKeys.length) {
        let same = true
        for (const key of nextKeys) {
          if (previous[key] !== next[key]) {
            same = false
            break
          }
        }
        if (same) {
          return previous
        }
      }

      return next
    })
  }, [conversationGroups])

  useEffect(() => {
    hasAutoCollapsedConversationGroupsRef.current = false
  }, [settings.autoCollapseConversations])

  useLayoutEffect(() => {
    if (!settingsVisible) {
      return
    }

    const settingsPage = settingsPageRef.current
    if (!settingsPage) {
      return
    }

    const nextScrollTop = settingsScrollByViewRef.current[settingsView] ?? 0
    const frameId = window.requestAnimationFrame(() => {
      if (settingsPageRef.current === settingsPage) {
        settingsPage.scrollTop = nextScrollTop
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [settingsView, settingsVisible])

  useLayoutEffect(() => {
    if (!drawerVisible) {
      return
    }

    const conversationList = conversationListRef.current
    if (!conversationList) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (conversationListRef.current === conversationList) {
        conversationList.scrollTop = drawerScrollTopRef.current
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [drawerVisible])

  useEffect(() => {
    if (!drawerVisible || !settings.autoCollapseConversations || hasAutoCollapsedConversationGroupsRef.current) {
      return
    }

    const conversationList = conversationListRef.current
    if (!conversationList) {
      return
    }

    let secondFrameId = 0
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const listRect = conversationList.getBoundingClientRect()
        const nextCollapsedByGroup: Record<string, boolean> = {}

        for (const group of conversationGroups) {
          const groupElement = conversationGroupElementRefs.current[group.id]
          if (!groupElement) {
            nextCollapsedByGroup[group.id] = false
            continue
          }

          const itemElements = Array.from(
            groupElement.querySelectorAll<HTMLElement>('[data-conversation-item="true"]'),
          )
          const hasFullyVisibleItem = itemElements.some((itemElement) => {
            const itemRect = itemElement.getBoundingClientRect()
            return itemRect.top >= listRect.top && itemRect.bottom <= listRect.bottom
          })
          nextCollapsedByGroup[group.id] = !hasFullyVisibleItem
        }

        hasAutoCollapsedConversationGroupsRef.current = true
        setCollapsedConversationGroups((previous) => {
          let changed = false
          const next: Record<string, boolean> = {}

          for (const group of conversationGroups) {
            const nextValue = nextCollapsedByGroup[group.id] ?? false
            next[group.id] = nextValue
            if (previous[group.id] !== nextValue) {
              changed = true
            }
          }

          return changed ? next : previous
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      if (secondFrameId !== 0) {
        window.cancelAnimationFrame(secondFrameId)
      }
    }
  }, [conversationGroups, drawerVisible, settings.autoCollapseConversations])

  const renderComposerTools = ({
    className = 'composer-tools',
  }: {
    className?: string
  } = {}) => (
    <div className={className}>
      <div className="model-picker composer-model-picker homepage-model-picker" ref={modelMenuRef}>
        <button
          type="button"
          className="model-trigger composer-model-trigger is-editorial-chat-shell"
          onClick={() => (modelMenuVisible ? closeModelMenu() : openModelMenu())}
        >
          <span className="model-trigger-label">
            {buildHomepageModelTriggerLabel(settings.currentModel, activeConversationResponseMode)}
          </span>
          <span className={`arrow ${modelMenuVisible ? 'open' : ''}`}>▾</span>
        </button>

        {modelMenuMounted ? (
          <div
            className={`model-popover composer-model-popover homepage-model-popover frosted-surface ${
              modelMenuVisible ? 'is-open' : 'is-closing'
            }`}
            style={{ top: 'auto', bottom: 'calc(100% + 8px)', transformOrigin: 'center bottom' }}
            onTransitionEnd={(event) => {
              if (!modelMenuVisible && event.target === event.currentTarget) {
                useUIStore.getState().setModelMenuVisibility(false, false)
              }
            }}
          >
            {enabledModelOptions.length === 0 ? (
              <div className="model-popover-empty">
                <p>暂无模型</p>
                <button
                  type="button"
                  className="tiny-button"
                  onClick={() => {
                    closeModelMenu()
                    openSettings()
                    navigateSettingsView('providers')
                  }}
                >
                  去设置
                </button>
              </div>
            ) : (
              enabledModelsByProvider.map((provider) => (
                <div key={provider.providerId} className="model-provider-group">
                  <div className="conversation-group-divider model-provider-divider">
                    <span className="conversation-group-label">{provider.providerName || '未命名服务商'}</span>
                    <span className="conversation-group-dash" aria-hidden="true" />
                  </div>

                  {provider.models.map((model) => (
                    <button
                      key={createProviderModelKey(provider.providerId, model.id)}
                      type="button"
                      className={`model-option ${
                        settings.currentProviderId === provider.providerId &&
                        settings.currentModel === model.id
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => {
                        selectCurrentModel(provider.providerId, model.id)
                        closeModelMenu()
                      }}
                    >
                      {model.id}
                    </button>
                  ))}
                </div>
              ))
            )}

            {enabledModelOptions.length > 0 ? (
              <div className="homepage-model-mode-footer">
                <span className="homepage-model-mode-label">Response mode</span>
                <div className="homepage-model-mode-actions" role="group" aria-label="选择首页响应模式">
                  <button
                    type="button"
                    className={`homepage-model-mode-button ${
                      activeConversationResponseMode === 'tool' ? 'active' : ''
                    }`}
                    disabled={activeConversationModeLocked || !activeConversation || isComposerLocked}
                    onClick={() => {
                      if (!activeConversation || activeConversationModeLocked || isComposerLocked) {
                        return
                      }
                      updateConversationResponseMode(activeConversation.id, 'tool')
                      updateSetting('defaultResponseMode', 'tool')
                      closeModelMenu()
                    }}
                  >
                    技能模式
                  </button>
                  <button
                    type="button"
                    className={`homepage-model-mode-button ${
                      activeConversationResponseMode === 'text' ? 'active' : ''
                    }`}
                    disabled={activeConversationModeLocked || !activeConversation || isComposerLocked}
                    onClick={() => {
                      if (!activeConversation || activeConversationModeLocked || isComposerLocked) {
                        return
                      }
                      updateConversationResponseMode(activeConversation.id, 'text')
                      updateSetting('defaultResponseMode', 'text')
                      closeModelMenu()
                    }}
                  >
                    文本模式
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="icon-button"
        aria-label="选择图片"
        disabled={isComposerLocked}
        onClick={() => fileInputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="3.75"
            y="4.75"
            width="16.5"
            height="14.5"
            rx="2.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="8.8" cy="9.7" r="1.45" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M4.8 16.5l3.9-3.9a1.1 1.1 0 0 1 1.56 0l2 2a1.1 1.1 0 0 0 1.56 0l1.7-1.7a1.1 1.1 0 0 1 1.56 0l2.06 2.06"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        className="icon-button"
        aria-label="拍照"
        disabled={isComposerLocked}
        onClick={() => {
          if (isComposerLocked) {
            return
          }
          if (!settings.permissionToggles.camera) {
            pushNotice('请先在权限设置中开启相机权限。', 'error')
            return
          }
          cameraInputRef.current?.click()
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 6.5 9.1 4.9h5.8L16 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="3.5"
            y="6.5"
            width="17"
            height="12"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
    </div>
  )

  const renderComposerFooter = (): ReactNode => (
    <footer ref={composerFooterRef} className="composer is-editorial-chat-shell">
      {scrollToBottomButtonMounted ? (
        <button
          type="button"
          className={`icon-button composer-scroll-bottom-button ${
            scrollToBottomButtonVisible ? 'is-open' : 'is-closing'
          }`}
          onClick={handleScrollToBottomButtonClick}
          aria-label="回到底部"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 5.5v11.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="m7.5 13.3 4.5 4.9 4.5-4.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      <div className="composer-panel">
        {pendingImages.length > 0 ? (
          <div className="pending-image-strip">
            {pendingImages.map((image) => (
              <div key={image.id} className="pending-image-item">
                <button
                  type="button"
                  className="pending-image-preview"
                  onClick={() => openImageViewer(buildPendingImageViewerKey(image.id), image)}
                  aria-label={`查看图片 ${image.name}`}
                >
                  <img src={image.dataUrl} alt={image.name} />
                </button>
                <button
                  type="button"
                  className="pending-image-remove-button"
                  onClick={() => removePendingImage(image.id)}
                  aria-label={`移除图片 ${image.name}`}
                >
                  ×
                </button>
                <div className="pending-image-controls">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={image.compressionRate}
                    onChange={(event) =>
                      updatePendingImageCompression(image.id, Number(event.target.value))
                    }
                    aria-label={`压缩率 ${image.name}`}
                  />
                  <span>{image.compressionRate}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer-row">
          <ChatInputBox
            ref={composerInputRef}
            className="chat-input-box composer-input"
            value={draft}
            onChange={(event) => {
              if (!activeConversation) {
                return
              }
              updateConversationDraft(activeConversation.id, event.target.value)
            }}
            placeholder={isComposerLocked ? '请先等待历史对话载入完成' : '输入消息'}
            maxHeight={188}
            disabled={isComposerLocked}
          />

          {isSending ? (
            canAppendWhileSending ? (
              <button type="button" className="composer-send-button" onClick={handleAppend}>
                追加
              </button>
            ) : (
              <button
                type="button"
                className="composer-send-button danger-button"
                onClick={stopGeneration}
              >
                停止
              </button>
            )
          ) : (
            <button
              type="button"
              className="composer-send-button"
              disabled={!canSend}
              onClick={() => void handleSend()}
            >
              发送
            </button>
          )}
        </div>

        {renderComposerTools()}
      </div>
    </footer>
  )

  const renderPromptEditorPanel = (props: {
    isOpen: boolean
    onToggle: () => void
    title: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    helperText?: string
    actionLabel?: string
    onAction?: () => void
    actionDisabled?: boolean
  }) => <PromptEditorPanel {...props} />

  const renderSettingsSectionHeading = (props: { label: string; title?: string; copy?: ReactNode }) => (
    <SettingsSectionHeading {...props} />
  )

  const renderSettingsMiniSwitch = (enabled: boolean) => (
    <span className={`settings-mini-switch ${enabled ? 'is-on' : ''}`} aria-hidden="true" />
  )

  const formatToggleStateLabel = (enabled: boolean): string => (enabled ? '已开启' : '已关闭')

  const renderInfoPromptToggleCard = (props: {
    cardKey: string
    definition: InfoPromptDefinition
    description: string
    statusText?: string
    checked: boolean
    onChange: (enabled: boolean) => void
    actionLabel?: string
    onAction?: () => void
    actionDisabled?: boolean
  }) => <SettingsInfoPromptToggleCard {...props} />

  const renderDailyCoverSettings = () => (
    <DailyCoverSettingsComponent
      resolvedDailyCover={resolvedDailyCover}
      settings={settings.dailyCover}
      onUpdate={(key: keyof DailyCoverSettings, value: string | boolean) =>
        updateDailyCoverSetting(key, value as DailyCoverSettings[typeof key])
      }
    />
  )

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
      onTest={handleTestRuntime}
      onSetDefault={handleSetDefaultRuntime}
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

  const renderSettingsPage = () => {
    const showBack = settingsView !== 'main'
    let pageChrome = {
      eyebrow: 'Settings',
      title: '动话设置',
      copy: '保持你现在的设置信息架构，只把它从“功能堆叠”变成“章节清楚的长表面”。',
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
          copy: '安装、启用、配置和删除都保留；只是把“工具清单”从厚卡片改成更清楚的长列表。',
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

  return (
    <div
      className={`app-shell chat-page-shell ${isHomepageEmptyState ? 'is-homepage-empty' : ''} ${
        hasActiveMessages ? 'has-active-messages' : ''
      } ${homepageSendTransition ? 'is-homepage-send-transition-active' : ''}`}
      style={appShellStyle}
    >
      {shouldShowHomepageBackground ? (
        <div className={`homepage-empty-background ${resolvedDailyCover ? 'has-cover' : 'is-fallback'}`} aria-hidden="true" />
      ) : null}

      {shouldShowChatBackground ? <div className="chat-active-background" aria-hidden="true" /> : null}

      {homepageSendTransition ? (
        <HomepageSendTransition
          transition={homepageSendTransition}
          numberFormatter={numberFormatter}
          onAnimationEnd={() => setHomepageSendTransition(null)}
        />
      ) : null}

      {titleTransition ? <TitleTransition transition={titleTransition} /> : null}

      <div className="app-shell-content">
        <ChatHeader
          chatHeaderRef={chatHeaderRef}
          titleTextRef={titleTextRef}
          titleRenameButtonRef={titleRenameButtonRef}
          titleInputRef={titleInputRef}
          titleActionsRef={titleActionsRef}
          isEditingTitle={isEditingTitle}
          titleDraft={titleDraft}
          titleTransition={titleTransition}
          activeConversation={activeConversation}
          displayConversationTitle={displayConversationTitle}
          shouldShowTitleRenameButton={shouldShowTitleRenameButton}
          themeMode={settings.themeMode}
          openDrawer={openDrawer}
          setTitleDraft={setTitleDraft}
          saveRenameConversation={saveRenameConversation}
          cancelRenameConversation={cancelRenameConversation}
          beginRenameConversation={beginRenameConversation}
          onThemeToggle={(nextMode) => updateSetting('themeMode', nextMode)}
        />

        <ChatSummaryBar ref={chatSummaryBarRef} summary={chatSummarySnapshot} numberFormatter={numberFormatter} />

        {notice ? <NoticeBanner notice={notice} /> : null}

        <>
          <main
            key={activeConversationId}
            ref={messageListRef}
            className="message-list page-transition"
            onScroll={handleMessageListScroll}
            onPointerDownCapture={handleMessageListPointerDownCapture}
            onPointerUpCapture={handleMessageListPointerUpCapture}
            onPointerCancelCapture={handleMessageListPointerCancelCapture}
            onWheelCapture={handleMessageListWheelCapture}
          >
            <div
              className={`chat-content-frame ${isHomepageEmptyState ? 'is-homepage-empty' : 'has-active-messages'}`}
            >
              <div
                ref={chatContentStackRef}
                className={`chat-content-stack ${isHomepageEmptyState ? 'is-homepage-empty' : 'has-active-messages'}`}
              >
                {hasActiveMessages ? (
                  <ChatScrollPlaceholder heightPx={activeChatScrollInsets.top} position="top" />
                ) : null}

                {isActiveConversationLoadError ? (
                  <section className="empty-state">
                    <h2>历史对话加载失败</h2>
                    <p className="empty-state-line">
                      {activeConversation?.storageLoadError ?? chatStateLoadError ?? '未知错误'}
                    </p>
                    <button
                      type="button"
                      className="tiny-button"
                      onClick={() => {
                        if (!activeConversation) {
                          return
                        }
                        hydrateConversationById(activeConversation.id)
                      }}
                    >
                      重试加载
                    </button>
                  </section>
                ) : isActiveConversationLoading ? (
                  <section className="empty-state">
                    <h2>{displayConversationTitle}</h2>
                    <p className="empty-state-line">正在载入这段历史对话…</p>
                  </section>
                ) : activeMessages.length === 0 ? (
                  showCloudAuthOnHomepage ? (
                    <CloudAuthForm
                      initialMode={isCloudAuthRegisterMode ? 'register' : 'login'}
                      onAuthSuccess={() => {
                        setCloudAuthMode('none')
                        setAuthVersion(v => v + 1)
                      }}
                    />
                  ) : (
                    <NewConversationShowcase
                      rootRef={homepageShowcaseRef}
                      cover={resolvedDailyCover}
                      highlightStats={homepageHighlightStats}
                      responseModeLabel={getResponseModeLabel(activeConversationResponseMode)}
                    />
                  )
                ) : null}

                {!isActiveConversationLoadError && !isActiveConversationLoading ? activeMessages.map((message) => {
          const editing = editingMessageId === message.id
          const textValue = message.text.trim()
          const hasReasoning = Boolean(message.reasoning?.trim())
          const assistantFlow = message.role === 'assistant' ? message.assistantFlow ?? [] : []
          const hasAssistantFlow = assistantFlow.length > 0
          const isAssistantLoading =
            message.role === 'assistant' && !message.error && !textValue && !hasReasoning && !hasAssistantFlow
          const displayText =
            textValue ||
            (message.role === 'assistant' && !isAssistantLoading ? '（模型未返回文本内容）' : '')
          const displayTextSanitized =
            message.role === 'assistant' ? stripSkillParsingHintLines(displayText) : displayText
          const shouldRenderText =
            displayTextSanitized.length > 0 || (message.role === 'user' && !(message.images?.length ?? 0))
          const renderSkillStepEntry = (step: AssistantFlowSkillNode, key: string) => {
            const hasResult = Boolean(step.result?.trim())
            const resultOpen = openSkillResultByStep[step.id] === true
            const targetLabel = formatSkillStepTarget(step)

            return (
              <div key={key} className="skill-step-entry">
                <div className={`skill-step-card is-${step.status}`}>
                  <div className="skill-step-meta">
                    <span className="skill-step-target" title={targetLabel}>
                      {targetLabel}
                    </span>
                    <span className="skill-step-status">{formatSkillStepStatus(step.status)}</span>
                  </div>
                  {step.explanation ? (
                    <div className="markdown-content skill-step-content">
                      <MarkdownMessage text={step.explanation} />
                    </div>
                  ) : null}
                  {hasResult ? (
                    <section className={`skill-step-result-panel ${resultOpen ? 'is-open' : ''}`}>
                      <button
                        type="button"
                        className="skill-step-result-toggle"
                        onClick={() => toggleSkillResult(step.id)}
                      >
                        <span>返回信息</span>
                        <span className={`arrow ${resultOpen ? 'open' : ''}`}>▾</span>
                      </button>
                      <div className="skill-step-result-body">
                        <div className="markdown-content skill-step-result-content">
                          <MarkdownMessage text={step.result ?? ''} />
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {step.error ? <p className="message-error skill-step-error">{step.error}</p> : null}
                </div>
              </div>
            )
          }

          return (
            <article key={message.id} className={`message-card ${message.role}`}>
              <div className="message-meta">
                {message.role === 'user' ? (
                  <span>YOU</span>
                ) : (
                  <span className="message-model">
                    Assistant · {message.model ?? '未标记模型'}
                  </span>
                )}
              </div>

              {!editing && (message.images?.some((image) => image.dataUrl.trim().length > 0) ?? false) ? (
                <div className="image-grid">
                  {message.images
                    ?.filter((image) => image.dataUrl.trim().length > 0)
                    .map((image) => (
                      <figure key={image.id} className="image-item">
                        <button
                          type="button"
                          className="image-item-button"
                          onClick={() => openImageViewer(buildMessageImageViewerKey(message.id, image.id), image)}
                          aria-label={`查看图片 ${image.name}`}
                        >
                          <img src={image.dataUrl} alt={image.name} />
                        </button>
                      </figure>
                    ))}
                </div>
              ) : null}

              {editing ? (
                <div className="editor">
                  <ChatInputBox
                    className="chat-input-box composer-input editor-message-input"
                    radiusMode="card"
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    maxHeight={260}
                  />
                  <div className="editor-actions">
                    {message.role === 'assistant' ? (
                      <>
                        <button type="button" className="tiny-button" onClick={saveAssistantEdit}>
                          保存
                        </button>
                        <button type="button" className="tiny-button ghost-button" onClick={cancelEdit}>
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="tiny-button" onClick={() => void saveUserEdit(false)}>
                          仅修改
                        </button>
                        <button type="button" className="tiny-button" onClick={() => void saveUserEdit(true)}>
                          修改并重发
                        </button>
                        <button type="button" className="tiny-button ghost-button" onClick={cancelEdit}>
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {settings.showReasoning && hasReasoning ? (
                    <section
                      className={`reasoning-panel ${openReasoningByMessage[message.id] ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="reasoning-toggle"
                        onClick={() => toggleReasoning(message.id)}
                      >
                        <span>思考过程</span>
                        <span className={`arrow ${openReasoningByMessage[message.id] ? 'open' : ''}`}>
                          ▾
                        </span>
                      </button>
                      <div className="reasoning-body">
                        <div className="markdown-content reasoning-content">
                          <MarkdownMessage text={message.reasoning ?? ''} />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {isAssistantLoading ? (
                    <div className="assistant-loading" aria-label="模型输出中">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {message.role === 'assistant' && hasAssistantFlow ? (
                    <div className="assistant-inline-flow">
                      {assistantFlow.map((node, index) => {
                        if (node.kind === 'divider') {
                          return <div key={node.id} className="assistant-round-divider" aria-hidden="true" />
                        }

                        if (node.kind === 'text') {
                          const segmentText = stripSkillParsingHintLines(node.text)
                          if (!segmentText.trim()) {
                            return null
                          }
                          return (
                            <div key={node.id} className="markdown-content">
                              <MarkdownMessage text={segmentText} />
                            </div>
                          )
                        }

                        return renderSkillStepEntry(node, `inline-step-${message.id}-${node.id}-${index}`)
                      })}
                    </div>
                  ) : shouldRenderText ? (
                    <div className="markdown-content">
                      <MarkdownMessage text={displayTextSanitized} />
                    </div>
                  ) : null}

                  {message.error ? <p className="message-error">{message.error}</p> : null}

                  {message.role === 'assistant' && message.usage ? (
                    <div className="metric-row">
                      {message.usageEstimated ? <span className="metric-tag">估算值</span> : null}
                      <span className="metric-tag">输入Token {message.usage.promptTokens}</span>
                      <span className="metric-tag">输出Token {message.usage.completionTokens}</span>
                      <span className="metric-tag">总Token {message.usage.totalTokens}</span>
                      {message.usage.reasoningTokens !== undefined ? (
                        <span className="metric-tag">思考Token {message.usage.reasoningTokens}</span>
                      ) : null}
                      <span className="metric-tag">
                        首Token延迟 {formatMs(message.firstTokenLatencyMs)}
                      </span>
                      <span className="metric-tag">总耗时 {formatMs(message.totalTimeMs)}</span>
                    </div>
                  ) : null}

                  <div className="message-actions">
                    <button
                      type="button"
                      className="message-action-button"
                      onClick={() => void copyMessageText(message.text)}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="message-action-button"
                      onClick={() => beginEdit(message)}
                    >
                      编辑
                    </button>
                    {message.role === 'assistant' ? (
                      <button
                        type="button"
                        className="message-action-button"
                        onClick={() => void regenerate(message.id)}
                      >
                        重试
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          )
              }) : null}

                {hasActiveMessages ? (
                  <ChatScrollPlaceholder heightPx={activeChatScrollInsets.bottom} position="bottom" />
                ) : null}
              </div>
              </div>
            </main>

          {renderComposerFooter()}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => void handleImageSelect(event)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => void handleImageSelect(event)}
          />
          <input
            ref={skillArchiveInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => void handleSkillArchiveSelect(event)}
          />
          <input
            ref={runtimeArchiveInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => void handleRuntimeArchiveSelect(event)}
          />
        </>
      </div>

      {drawerMounted ? (
        <div
          className={`drawer-overlay ${drawerVisible ? 'is-open' : 'is-closing'}`}
          onClick={closeDrawer}
        >
          <aside
            className="drawer-panel drawer-panel--editorial frosted-surface"
            onClick={(event) => event.stopPropagation()}
            onTransitionEnd={(event) => {
              if (!drawerVisible && event.target === event.currentTarget) {
                useUIStore.getState().setDrawerVisibility(false, false)
              }
            }}
          >
            <div className="drawer-header drawer-header--editorial">
              <h2>动话</h2>
            </div>

            <div
              ref={conversationListRef}
              className="conversation-list drawer-conversation-list"
              onScroll={(event) => {
                drawerScrollTopRef.current = event.currentTarget.scrollTop
              }}
            >
              {conversationGroups.map((group) => {
                const collapsed = collapsedConversationGroups[group.id] ?? false
                return (
                  <section
                    key={group.id}
                    ref={(node) => {
                      conversationGroupElementRefs.current[group.id] = node
                    }}
                    className="conversation-group drawer-conversation-group"
                  >
                    <button
                      type="button"
                      className={`drawer-group-heading ${collapsed ? 'is-collapsed' : ''}`}
                      aria-expanded={!collapsed}
                      aria-label={collapsed ? '展开分组' : '收起分组'}
                      onClick={() => toggleConversationGroup(group.id)}
                    >
                      <span className="drawer-group-heading-label">
                        {formatDrawerGroupLabel(group.labelTime)}
                      </span>
                    </button>

                    <div className={`conversation-group-content drawer-group-content ${collapsed ? 'is-collapsed' : ''}`}>
                      <div className="conversation-group-content-inner drawer-group-content-inner">
                        {group.conversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className={`conversation-item-row drawer-conversation-item-row ${
                              deleteModeEnabled ? 'delete-mode' : ''
                            } ${
                              swipingConversationId === conversation.id ? 'is-swiping' : ''
                            }`}
                            style={
                              swipingConversationId === conversation.id
                                ? { transform: `translate3d(${swipeOffsetX}px, 0, 0)` }
                                : undefined
                            }
                          >
                            <button
                              type="button"
                              data-conversation-item="true"
                              className={`conversation-item drawer-conversation-item ${
                                conversation.id === activeConversationId ? 'active' : ''
                              } ${swipingConversationId === conversation.id ? 'is-swiping' : ''}`}
                              onPointerDown={(event) => handleConversationPointerDown(conversation.id, event)}
                              onPointerMove={(event) => handleConversationPointerMove(conversation.id, event)}
                              onPointerUp={(event) => handleConversationPointerUp(conversation.id, event)}
                              onPointerCancel={handleConversationPointerCancel}
                              onClick={() => {
                                if (deleteModeEnabled) {
                                  requestDeleteConversation(conversation.id)
                                  return
                                }
                                handleConversationClick(conversation.id)
                              }}
                            >
                              <span className="conversation-item-title drawer-conversation-item-title">
                                {conversation.title}
                              </span>
                              <div className="conversation-item-times drawer-conversation-item-times">
                                <span className="conversation-item-time drawer-conversation-item-time">
                                  创建：{dateFormatter.format(conversation.createdAt)}
                                </span>
                                <span className="drawer-conversation-item-time-separator" aria-hidden="true">
                                  ·
                                </span>
                                <span className="conversation-item-time drawer-conversation-item-time">
                                  更新：{dateFormatter.format(conversation.updatedAt)}
                                </span>
                              </div>
                            </button>

                            <button
                              type="button"
                              className="conversation-delete-button"
                              aria-label={`删除 ${conversation.title}`}
                              onClick={() => requestDeleteConversation(conversation.id)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M9 4.75h6M5.75 7h12.5M8.25 7l.65 10.1a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9L15.75 7M10.25 10v5.25M13.75 10v5.25"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="drawer-footer drawer-footer--editorial">
              <button
                type="button"
                className="drawer-action-button drawer-action-button--editorial drawer-settings-button"
                aria-label="打开设置"
                onClick={openSettingsFromDrawer}
              >
                <span>设置</span>
              </button>
              <button
                type="button"
                className="drawer-action-button drawer-action-button--editorial drawer-new-chat-button"
                aria-label="新增对话"
                onClick={createNewConversation}
              >
                <span>新增对话</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {imageViewerMounted && imageViewer ? (
        <ImageViewer
          items={imageViewer.items}
          initialIndex={imageViewer.initialIndex}
          visible={imageViewerVisible}
          onClose={closeImageViewer}
        />
      ) : null}

      {deleteDialogConversation ? (
        <DeleteConfirmDialog
          entityName={deleteDialogConversation.title}
          showGraceHint
          graceSeconds={settings.deleteConfirmGraceSeconds}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteConversation}
        />
      ) : null}

      {deleteDialogProvider ? (
        <DeleteConfirmDialog
          entityName={deleteDialogProvider.name.trim() || '未命名服务商'}
          hint="该服务商下的接口配置、模型列表和参数覆盖都会一并删除。"
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteProvider}
        />
      ) : null}

      {deleteDialogSkill ? (
        <DeleteConfirmDialog
          entityName={deleteDialogSkill.frontmatter.name || deleteDialogSkill.id}
          hint="该 skill 的配置文件与启用状态都会一起移除。若它覆盖了同名内置 skill，删除后将回退到内置版本。"
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteSkill}
        />
      ) : null}

      {deleteDialogRuntime ? (
        <DeleteConfirmDialog
          entityName={deleteDialogRuntime.displayName || deleteDialogRuntime.id}
          hint="删除后，依赖该运行时的 skill 执行可能失败；如果它当前是默认运行时，也会失去默认指向。"
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteRuntime}
        />
      ) : null}

      {showUpdateDialog && pendingUpdate && !updatingNow ? (
        <UpdateDialog
          update={pendingUpdate}
          onCancel={() => setShowUpdateDialog(false)}
          onInstall={handleInstallUpdate}
        />
      ) : null}

      {settingsMounted ? (
        <div className={`settings-screen ${settingsVisible ? 'is-open' : 'is-closing'}`}>
          {renderSettingsPage()}
        </div>
      ) : null}
    </div>
  )
}

export default App
