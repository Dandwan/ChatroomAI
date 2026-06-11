import {
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
import type { ApiMessage } from './services/chat-api'
import {
  isTranscriptConversationWorkspacePlaceholder,
  projectConversationMessages,
  type AssistantMessageTranscriptEvent,
  type TranscriptEvent,
} from './services/chat-transcript'
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
  INFO_PROMPT_DEFINITIONS,
  type InfoPromptDefinition,
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
  RuntimeRecord,
} from './services/skills/types'
import ChatInputBox from './components/ChatInputBox'
import MarkdownMessage from './components/MarkdownMessage'
import ChatScrollPlaceholder from './components/ChatScrollPlaceholder'
import DeleteConfirmationLayer from './components/DeleteConfirmationLayer'
import AppDrawer from './components/AppDrawer'
import NoticeBanner from './components/NoticeBanner'
import ChatSummaryBar from './components/ChatSummaryBar'
import ChatHeader from './components/ChatHeader'
import ImageViewer from './components/ImageViewer'
import NewConversationShowcase from './components/NewConversationShowcase'
import CloudAuthForm from './components/CloudAuthForm'
import { isCloudLoggedIn, getStoredCloudAuth, clearCloudAuth } from './services/cloud-auth'
import type { UpdateInfo } from './services/app-update'
import { useCloudAuth } from './hooks/useCloudAuth'
import { useUpdates } from './hooks/useUpdates'
import { useConversation } from './hooks/useConversation'
import { useExtensions } from './hooks/useExtensions'
import { useSettings } from './hooks/useSettings'
import { usePermissions } from './hooks/usePermissions'
import UpdateDialog from './components/UpdateDialog'
import ThinkingPhrase from './components/ThinkingPhrase'
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
  type AssistantFlowNode,
  type AssistantFlowSkillNode,
} from './utils/assistant-flow'
import {
  buildHistoryStatsFromSummaries,
  deleteConversationStorage,
  getChatStatePersistenceSignature,
  loadChatIndex,
  loadConversationState,
  loadStoredAttachmentDataUrl,
  persistChatState,
} from './services/chat-storage'
import { createProviderModelKey, modelHealthLabel } from './utils/model-utils'
import { stripSkillParsingHintLines } from './utils/text-utils'
import { formatMs } from './utils/time-utils'
import type {
  AppSettings,
  ChatSummarySnapshot,
  CompletionResult,
  Conversation,
  ConversationDrafts,
  ConversationGroup,
  ConversationResponseMode,
  GlobalPromptSettingKey,
  LoadedChatState,
  MessageListScrollMetrics,
  ModelHealth,
  Notice,
  NumericSettingKey,
  PendingTitleTransition,
  PromptEditorKey,
  ProviderBooleanSettingKey,
  ProviderConfig,
  ProviderNumericSettingKey,
  ProviderPromptSettingKey,
  SettingsView,
  TagPromptEditorKey,
  TitleTransitionState,
  TurnExecutionJob,
} from './state/types'
import {
  CHAT_STATE_PERSIST_DEBOUNCE_MS,
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
} from './state/types'
import { useUIStore } from './state/ui-store'
import { useExtensionsStore } from './state/extensions-store'
import { useAssistant } from './hooks/useAssistant'
import { useChatUI } from './hooks/useChatUI'
import { useChatStore } from './state/chat-store'
import { useSettingsStore } from './state/settings-store'
import './App.css'
import './styles/app-editorial-redesign.css'

import {
  buildMessageImageViewerKey,
  buildPendingImageViewerKey,
  applyAssignedImageStorageKeys,
} from './utils/app-images'

import {
  DEBUG_SKILL_ROUND_LOG_STORAGE_KEY,
  DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY,
  truncateDebugLogText,
  appendDebugLogEntry,
} from './utils/app-debug'
import {
  numberFormatter,
  createId,
  isJsonObjectRecord,
  formatJsonObject,
  parseSkillConfigDraft,
  clamp,
  formatCompactCount,
  getResponseModeLabel,
  buildHomepageModelTriggerLabel,
} from './utils/app-formatting'

import {
  createConversation,
  createInitialChatState,
  createProviderConfig,
  createProviderNameCandidate,
  createProviderNumericSettingDrafts,
  createSummaryConversation,
  DEFAULT_SETTINGS,
  ensureValidCurrentModelSelection,
  extractThinkBlocks,
  getEnabledModelOptions,
  getTravelOffset,
  isPersistedConversationSummary,
  loadSettings,
  ACTINET_PROVIDER_ID,
  ACTINET_PROVIDER_NAME,
  hasConversationStarted,
  MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS,
  MESSAGE_LIST_AUTO_SCROLL_MAX_MS,
  MESSAGE_LIST_BOTTOM_THRESHOLD_PX,
  MESSAGE_LIST_INTERACTION_IDLE_MS,
  MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR,
  buildPersistChatState,
  createNumericSettingDrafts,
  normalizeNumericSettingDraft,
  NUMERIC_SETTING_DEFAULTS,
  PROVIDER_NUMERIC_LIMITS,
  PROMPT_DEFAULTS,
  resolveConversationResponseMode,
  resolveMessageListSmoothScrollStep,
  resolveProviderRequestSettings,
  shiftRect,
  snapshotRect,
  TITLE_EDIT_TRANSITION_MS,
  toConversationSummary,
  toHydratedConversation,
  vibrateInteraction,
  withConversationRecordResponseMode,
  withConversationRecordTranscript,
  normalizeProviderPromptOverride,
} from './utils/app-module'
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

  // ── Chat UI (delegated to useChatUI hook) ──
  const {
    openDrawer, closeDrawer, drawerMounted, drawerVisible,
    openModelMenu, closeModelMenu, modelMenuMounted, modelMenuVisible,
    openSettings, closeSettings, settingsMounted, settingsVisible,
    openImageViewer, closeImageViewer, imageViewerMounted, imageViewerVisible,
    showScrollToBottomButton, hideScrollToBottomButton,
    scrollToBottomButtonMounted, scrollToBottomButtonVisible,
    copyTextToClipboard,
    openDeleteDialog,
  } = useChatUI()
  void copyTextToClipboard;

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
  void setIsFetchingModelsByProviderId;

  // ── UI store: prompt editors ──
  const openPromptEditors = useUIStore((s) => s.openPromptEditors)
  const openProviderPromptEditors = useUIStore((s) => s.openProviderPromptEditors)
  const setOpenProviderPromptEditors = useUIStore((s) => s.setOpenProviderPromptEditors)

  // ── UI store: delete / edit / notice / sending ──
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
  void setIsSending;
  const activeRequestConversationId = useUIStore((s) => s.activeRequestConversationId)
  const setActiveRequestConversationId = useUIStore((s) => s.setActiveRequestConversationId)
  void setActiveRequestConversationId;

  // ── UI store: drawer ──
  const setCollapsedConversationGroups = useUIStore((s) => s.setCollapsedConversationGroups)
  const swipingConversationId = useUIStore((s) => s.swipingConversationId)
  const setSwipingConversationId = useUIStore((s) => s.setSwipingConversation)
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

  const assistant = useAssistant()
  const [resolvedDailyCover, setResolvedDailyCover] = useState<ResolvedDailyCover | null>(() =>
    resolveBundledDailyCover(getLocalDateKey()),
  )
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  void abortController; void setAbortController;

	// ── Updates (delegated to useUpdates hook) ──
	const updates = useUpdates()

	// Startup auth logic extracted to useCloudAuth hook

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
  void processingTurnQueueRef;

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
  void appendSkillRoundLog;

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
  const hasProviders = settings.providers.length > 0

  // ── Cloud auth (extracted to useCloudAuth hook) ──
  const {
    cloudLoggedIn,
    setCloudAuthMode,
    showCloudAuthOnHomepage,
    isCloudAuthRegisterMode,
    setAuthVersion,
  } = useCloudAuth({
    hasOtherProviders: hasProviders && settings.otherProvidersEnabled,
    isHomepageEmptyState,
    onUpdateFound: (update: UpdateInfo) => {
      updates.onUpdateFound(update)
    },
  })
  // showCloudAuthOnHomepage & isCloudAuthRegisterMode now from useCloudAuth hook
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

  // ── Permissions (delegated to usePermissions hook) ──
  const conv = useConversation(initialStateRef)
  const ext = useExtensions(pushNotice, openDeleteDialog)
  const {
    applySettingsUpdate,
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
    setProviderModelEnabled,
    addManualProviderModel,
    selectCurrentModel,
    resetProviderDetailState,
    updateSetting,
    updateDailyCoverSetting,
    activeProviderRequestSettings,
  } = useSettings(pushNotice, openDeleteDialog)

  // ── Relay ActiNetSettings custom events as pushNotice ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: 'success' | 'error' | 'info'; text: string } | undefined
      if (detail) pushNotice(detail.text, detail.type)
    }
    window.addEventListener('actinet-notice', handler)
    return () => window.removeEventListener('actinet-notice', handler)
  }, [pushNotice])

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
  void updateConversationTranscript;

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
  void resetComposerState;

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
  void buildTurnHistoryTranscript;

  const clearQueuedTurnExecutions = useCallback((): void => {
    queuedTurnExecutionsRef.current = []
  }, [])
  void clearQueuedTurnExecutions;

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
  void appendConversationTranscriptEvents;

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
  void appendAssistantFlowRoundDivider;

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
  void clearAssistantFlowRoundState;

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
  void appendAssistantStreamDelta;

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
  void resetAssistantStreamOutput;

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
  void ensureReadyToRequest;

  const applyAssistantResult = (
    conversationId: string,
    assistantId: string,
    result: CompletionResult,
    _promptMessages: ApiMessage[],
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
    const usage = result.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
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
  void applyAssistantResult;

  // ── Delegated to useAssistant hook ──
  const {
    executeAssistantTurn,
    handleSend,
    handleAppend,
    handleImageSelect,
    cancelEdit,
    regenerate,
    copyMessageText,
  } = assistant
  void executeAssistantTurn;


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
            onClick={() => void updates.handleManualUpdateCheck()}
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
      requestingPermissionByKey={perms.requestingPermissionByKey}
      onToggle={perms.handlePermissionToggle}
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
            message.role === 'assistant' && !message.error && !textValue && !hasAssistantFlow
          const displayText = textValue
          const displayTextSanitized =
            message.role === 'assistant' ? stripSkillParsingHintLines(displayText) : displayText
          const shouldRenderText =
            displayTextSanitized.length > 0 || (message.role === 'user' && !(message.images?.length ?? 0))
          const isMessageTrulyEmpty =
            message.role === 'assistant' &&
            !isAssistantLoading &&
            !textValue &&
            !hasReasoning &&
            !hasAssistantFlow &&
            !message.error

          const resolveEmptyResponseProvider = (): { isActiNet: boolean; providerName: string } => {
            const modelId = message.model
            if (modelId) {
              const actiNetModels = getEffectiveActiNetModels()
              if (actiNetModels.some((m) => m.id === modelId)) {
                return { isActiNet: true, providerName: ACTINET_PROVIDER_NAME }
              }
              for (const provider of settings.providers) {
                if (provider.models.some((m) => m.id === modelId)) {
                  return { isActiNet: false, providerName: provider.name }
                }
              }
            }
            return { isActiNet: true, providerName: ACTINET_PROVIDER_NAME }
          }
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

                  {isAssistantLoading ? <ThinkingPhrase createdAt={message.createdAt} /> : null}

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
                  ) : isMessageTrulyEmpty ? (() => {
                    const pi = resolveEmptyResponseProvider()
                    return (
                      <div className="empty-response-notice">
                        {pi.isActiNet ? (
                          <>似乎......没有任何响应<br />稍安勿躁，ActiNet服务将很快恢复，如有不便敬请谅解！</>
                        ) : (
                          <>似乎......没有任何响应<br />请检查{pi.providerName}服务商提供的服务是否正常。</>
                        )}
                      </div>
                    )
                  })() : null}

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

            <AppDrawer
        conversationListRef={conversationListRef}
        conversationGroupElementRefs={conversationGroupElementRefs}
        drawerScrollTopRef={drawerScrollTopRef}
        conversationGroups={conversationGroups}
        closeDrawer={closeDrawer}
        toggleConversationGroup={toggleConversationGroup}
        handleConversationPointerDown={handleConversationPointerDown}
        handleConversationPointerMove={handleConversationPointerMove}
        handleConversationPointerUp={handleConversationPointerUp}
        handleConversationPointerCancel={handleConversationPointerCancel}
        handleConversationClick={handleConversationClick}
        requestDeleteConversation={requestDeleteConversation}
        openSettingsFromDrawer={openSettingsFromDrawer}
        createNewConversation={createNewConversation}
      />

      {imageViewerMounted && imageViewer ? (
        <ImageViewer
          items={imageViewer.items}
          initialIndex={imageViewer.initialIndex}
          visible={imageViewerVisible}
          onClose={closeImageViewer}
        />
      ) : null}

      <DeleteConfirmationLayer
        confirmDeleteConversation={confirmDeleteConversation}
        confirmDeleteProvider={confirmDeleteProvider}
        confirmDeleteSkill={confirmDeleteSkill}
        confirmDeleteRuntime={confirmDeleteRuntime}
      />

      {updates.showUpdateDialog && updates.pendingUpdate && !updates.updatingNow ? (
        <UpdateDialog
          update={updates.pendingUpdate}
          onCancel={() => updates.dismissUpdateDialog()}
          onInstall={updates.handleInstallUpdate}
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
