// Shared types for ActiChat state stores.
// Types that originate in App.tsx are re-defined here to avoid circular imports.
// As components are extracted, more types will migrate here.

import type { ImageViewerItem } from '../components/ImageViewer'
import type { RequestSettings } from '../services/chat-api'
import type { ChatStorageConversationSummary, ChatStorageHistoryStats } from '../services/chat-storage'
import type {
  ProjectedConversationMessage,
  TranscriptConversation,
  TranscriptConversationResponseMode,
  TranscriptEvent,
  TranscriptImageAttachment,
  TranscriptTokenUsage,
} from '../services/chat-transcript'
import type { DailyCoverSettings, ResolvedDailyCover } from '../services/daily-cover'
import type { HomepageHighlightStat } from '../services/homepage-highlights'
import type { InfoPromptSettingKey } from '../services/skills/info-system-prompts'
import type { JsonObjectValue } from '../components/SkillConfigJsonEditor'
import type { AssistantFlowSkillKind } from '../utils/assistant-flow'

// ── Re-exports for convenience ──
export type {
  RequestSettings,
  ChatStorageConversationSummary,
  ChatStorageHistoryStats,
  ProjectedConversationMessage,
  TranscriptConversation,
  TranscriptConversationResponseMode,
  TranscriptEvent,
  TranscriptImageAttachment,
  TranscriptTokenUsage,
  DailyCoverSettings,
  ResolvedDailyCover,
  HomepageHighlightStat,
  InfoPromptSettingKey,
  JsonObjectValue,
  AssistantFlowSkillKind,
  ImageViewerItem,
}

// ── Theme ──
export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_MODE_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
] satisfies Array<{ value: ThemeMode; label: string }>

export const DAILY_COVER_API_METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
] as const

// ── Model health ──
export type ModelHealth = 'untested' | 'testing' | 'ok' | 'error'

// ── Prompt setting keys ──
export type TagPromptSettingKey =
  | 'topLevelTagSystemPrompt'
  | 'generalTagSystemPrompt'
  | 'readSystemPrompt'
  | 'skillCallSystemPrompt'
  | 'editSystemPrompt'

export type DeprecatedPromptSettingKey = 'deprecatedTagPrompts'

export type GlobalPromptSettingKey = 'systemPrompt' | TagPromptSettingKey
export type ProviderPromptSettingKey = GlobalPromptSettingKey
export type ProviderBooleanSettingKey = InfoPromptSettingKey

export type ProviderNumericSettingKey =
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'presencePenalty'
  | 'frequencyPenalty'
  | 'maxModelRetryCount'

// ── Provider ──
export interface ProviderModel {
  id: string
  enabled: boolean
}

export interface ProviderConfig {
  id: string
  name: string
  apiBaseUrl: string
  apiKey: string
  models: ProviderModel[]
  systemPrompt?: string
  topLevelTagSystemPrompt?: string
  generalTagSystemPrompt?: string
  readSystemPrompt?: string
  skillCallSystemPrompt?: string
  editSystemPrompt?: string
  deviceInfoPromptEnabled?: boolean
  workspaceInfoPromptEnabled?: boolean
  temperature?: number
  topP?: number
  maxTokens?: number
  presencePenalty?: number
  frequencyPenalty?: number
  maxModelRetryCount?: number
}

// ── Image ──
export type ImageAttachment = TranscriptImageAttachment

export interface PendingImageAttachment extends ImageAttachment {
  originalDataUrl: string
  originalMimeType: string
  compressionRate: number
}

export interface ImageViewerState {
  items: ImageViewerItem[]
  initialIndex: number
}

// ── Chat ──
export type TokenUsage = TranscriptTokenUsage
export type SkillStepKind = AssistantFlowSkillKind
export type ChatMessage = ProjectedConversationMessage
export type ConversationData = TranscriptConversation
export type ConversationResponseMode = TranscriptConversationResponseMode
export type ConversationLoadState = 'hydrated' | 'summary' | 'hydrating' | 'error'

export interface Conversation extends ConversationData {
  storageLoadState: ConversationLoadState
  storedSummary: ChatStorageConversationSummary
  storageLoadError?: string
}

export interface ConversationGroup {
  id: string
  labelTime: number
  conversations: Conversation[]
}

export type ConversationDrafts = Record<string, string>

export interface LoadedChatState {
  conversations: Conversation[]
  activeConversationId: string
  draftsByConversation: ConversationDrafts
  historyStats: ChatStorageHistoryStats
}

// ── Permissions ──
export type AppPermissionKey = 'location' | 'camera' | 'microphone' | 'notifications'
export type PermissionToggles = Record<AppPermissionKey, boolean>

export const PERMISSION_LABELS: Record<AppPermissionKey, string> = {
  location: '定位',
  camera: '相机',
  microphone: '麦克风',
  notifications: '通知',
}

// ── Settings ──
export interface AppSettings {
  systemPrompt: string
  topLevelTagSystemPrompt: string
  generalTagSystemPrompt: string
  readSystemPrompt: string
  skillCallSystemPrompt: string
  editSystemPrompt: string
  deviceInfoPromptEnabled: boolean
  workspaceInfoPromptEnabled: boolean
  deprecatedTagPrompts: string
  promptVersions: Record<string, number>
  themeMode: ThemeMode
  defaultResponseMode: ConversationResponseMode
  temperature: number
  topP: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  showReasoning: boolean
  deleteModeHapticsEnabled: boolean
  firstTokenHapticsEnabled: boolean
  providers: ProviderConfig[]
  currentProviderId: string
  currentModel: string
  deleteConfirmGraceSeconds: number
  conversationGroupGapMinutes: number
  chatBlurPx: number
  autoCollapseConversations: boolean
  emptyStateStatsMinConversations: number
  maxModelRetryCount: number
  permissionToggles: PermissionToggles
  dailyCover: DailyCoverSettings
  actiNetModels: ProviderModel[]
  otherProvidersEnabled: boolean
  actiNetAdvancedModelsEnabled: boolean
}

// ── Numeric settings ──
export type NumericSettingKey =
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'presencePenalty'
  | 'frequencyPenalty'
  | 'deleteConfirmGraceSeconds'
  | 'conversationGroupGapMinutes'
  | 'chatBlurPx'
  | 'emptyStateStatsMinConversations'
  | 'maxModelRetryCount'

export type NumericSettingDrafts = Record<NumericSettingKey, string>
export type ProviderNumericSettingDrafts = Record<ProviderNumericSettingKey, string>

// ── UI ──
export interface Notice {
  type: 'success' | 'error' | 'info'
  text: string
}

export interface RectSnapshot {
  left: number
  top: number
  width: number
  height: number
}

export interface ChatSummarySnapshot {
  rounds: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCount: number
}

export interface HomepageSendTransitionState {
  cover: ResolvedDailyCover | null
  showcaseRect: RectSnapshot
  summaryRect?: RectSnapshot
  highlightStats: HomepageHighlightStat[]
  responseModeLabel: string
  summary: ChatSummarySnapshot
}

export type TitleTransitionPhase = 'opening' | 'closing'

export interface PendingTitleTransition {
  phase: TitleTransitionPhase
  titleText: string
  sourceTitleRect: RectSnapshot
  sourceTriggerRect: RectSnapshot
}

export interface TitleTransitionState {
  phase: TitleTransitionPhase
  titleText: string
  titleStartRect: RectSnapshot
  titleEndRect: RectSnapshot
  penStartRect: RectSnapshot
  penEndRect: RectSnapshot
  actionsStartRect: RectSnapshot
  actionsEndRect: RectSnapshot
  playing: boolean
}

export interface CompletionResult {
  text: string
  reasoning: string
  usage?: TokenUsage
  firstTokenLatencyMs: number
  totalTimeMs: number
}

export interface TurnExecutionJob {
  conversationId: string
  turnId: string
  responseMode: ConversationResponseMode
  historyTranscript?: TranscriptEvent[]
}

export type TurnExecutionOutcome = 'completed' | 'aborted' | 'blocked' | 'failed'

export interface MessageListScrollMetrics {
  bottomOffset: number
  viewportHeight: number
}

export interface ActiveProviderRequestSettings extends RequestSettings {
  providerId: string
  providerName: string
  systemPrompt: string
  topLevelTagSystemPrompt: string
  generalTagSystemPrompt: string
  readSystemPrompt: string
  skillCallSystemPrompt: string
  editSystemPrompt: string
  deviceInfoPromptEnabled: boolean
  workspaceInfoPromptEnabled: boolean
  maxModelRetryCount: number
}

export interface EnabledModelOption {
  providerId: string
  providerName: string
  modelId: string
}

export type SettingsView =
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

export type PromptEditorKey = GlobalPromptSettingKey
export type TagPromptEditorKey = PromptEditorKey | DeprecatedPromptSettingKey

// ── Unified delete dialog ──
export interface DeleteDialogState {
  type: 'conversation' | 'provider' | 'skill' | 'runtime'
  targetId: string
}

// ── Constants ──
export const SETTINGS_STORAGE_KEY = 'chatroom.settings.v1'
export const DEFAULT_DELETE_CONFIRM_GRACE_SECONDS = 30
export const DEFAULT_CONVERSATION_GROUP_GAP_MINUTES = 30
export const DEFAULT_AUTO_COLLAPSE_CONVERSATIONS = true
export const DEFAULT_EMPTY_STATE_STATS_MIN_CONVERSATIONS = 3
export const DEFAULT_CHAT_BLUR_PX = 18
export const SWIPE_DELETE_TOGGLE_THRESHOLD_PX = 72
export const SWIPE_DELETE_MAX_OFFSET_PX = 96
export const LONG_PRESS_DELETE_MODE_MS = 520
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10
export const DRAWER_TO_SETTINGS_OPEN_DELAY_MS = 220
export const SETTINGS_PERSIST_DEBOUNCE_MS = 320
export const CHAT_STATE_PERSIST_DEBOUNCE_MS = 1200
export const HOMEPAGE_SEND_TRANSITION_DURATION_MS = 920
export const DEFAULT_RESPONSE_MODE: ConversationResponseMode = 'tool'

export const EMPTY_HISTORY_STATS: ChatStorageHistoryStats = {
  totalConversationCount: 0,
  totalMessageCount: 0,
  totalPhotoCount: 0,
  totalTokenCount: 0,
  totalToolCallCount: 0,
}
