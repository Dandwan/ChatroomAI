import {
  startTransition,
  useCallback,
  type CSSProperties,
  type PointerEvent,
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
  type TranscriptContentPart,
  type TranscriptEvent,
  type UserMessageTranscriptEvent,
} from './services/chat-transcript'

import { isNativeRuntimeAvailable } from './services/skills/native-runtime'
import ChatScrollPlaceholder from './components/ChatScrollPlaceholder'
import DeleteConfirmationLayer from './components/DeleteConfirmationLayer'
import AppDrawer from './components/AppDrawer'
import NoticeBanner from './components/NoticeBanner'
import ChatSummaryBar from './components/ChatSummaryBar'
import ChatHeader from './components/ChatHeader'
import ImageViewer from './components/ImageViewer'
import { SettingsPage } from './views/SettingsPage'
import { HomepageView } from './views/HomepageView'
import { ComposerView } from './views/ComposerView'
import { ChatView } from './views/ChatView'
import { AppShell } from './views/AppShell'
import { isCloudLoggedIn } from './services/cloud-auth'
import type { UpdateInfo } from './services/app-update'
import { useCloudAuth } from './hooks/useCloudAuth'
import { useUpdates } from './hooks/useUpdates'
import { useConversation } from './hooks/useConversation'
import { useExtensions } from './hooks/useExtensions'
import { useSettings } from './hooks/useSettings'
import { usePermissions } from './hooks/usePermissions'
import UpdateDialog from './components/UpdateDialog'
import { getEffectiveActiNetModels } from './services/actinet-models'
import HomepageSendTransition from './components/HomepageSendTransition'
import TitleTransition from './components/TitleTransition'
import {
  getLocalDateKey,
  resolveBundledDailyCover,
  resolveDailyCover,
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
  type AssistantFlowNode,
} from './utils/assistant-flow'
import {
  buildHistoryStatsFromSummaries,
  deleteConversationStorage,
} from './services/chat-storage'
import type {
  AppSettings,
  ChatSummarySnapshot,
  CompletionResult,
  ChatMessage,
  Conversation,
  ConversationDrafts,
  ConversationGroup,
  LoadedChatState,
  MessageListScrollMetrics,
  Notice,
  PendingTitleTransition,
  PromptEditorKey,
  SettingsView,
  TagPromptEditorKey,
  TitleTransitionState,
  TurnExecutionJob,
} from './state/types'
import {
  HOMEPAGE_SEND_TRANSITION_DURATION_MS,
  SETTINGS_STORAGE_KEY,
  SWIPE_DELETE_TOGGLE_THRESHOLD_PX,
  SWIPE_DELETE_MAX_OFFSET_PX,
  LONG_PRESS_DELETE_MODE_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
  DRAWER_TO_SETTINGS_OPEN_DELAY_MS,
  SETTINGS_PERSIST_DEBOUNCE_MS,
} from './state/types'
import { useUIStore } from './state/ui-store'
import { useExtensionsStore } from './state/extensions-store'
import { useAssistant } from './hooks/useAssistant'
import { createStaticAssistantEvent, buildUserTranscriptContent } from './hooks/useAssistant'
import { useChatUI } from './hooks/useChatUI'
import { useChatStore } from './state/chat-store'
import { useSettingsStore } from './state/settings-store'
import './App.css'
import './styles/app-editorial-redesign.css'

import {
  DEBUG_SKILL_ROUND_LOG_STORAGE_KEY,
  DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY,
  truncateDebugLogText,
  appendDebugLogEntry,
} from './utils/app-debug'
import {
  numberFormatter,
  createId,
  clamp,
  formatCompactCount,
  getResponseModeLabel,
} from './utils/app-formatting'

import {
  createConversation,
  createInitialChatState,
  createProviderNumericSettingDrafts,
  extractThinkBlocks,
  getEnabledModelOptions,
  getTravelOffset,
  isPersistedConversationSummary,
  loadSettings,
  ACTINET_PROVIDER_ID,
  ACTINET_PROVIDER_NAME,
  hasConversationStarted,
  MESSAGE_LIST_AUTO_SCROLL_MAX_MS,
  MESSAGE_LIST_BOTTOM_THRESHOLD_PX,
  MESSAGE_LIST_INTERACTION_IDLE_MS,
  MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR,
  createNumericSettingDrafts,
  resolveConversationResponseMode,
  resolveMessageListSmoothScrollStep,
  shiftRect,
  snapshotRect,
  TITLE_EDIT_TRANSITION_MS,
  toConversationSummary,
  vibrateInteraction,
  withConversationRecordTranscript,
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
  const numericSettingDrafts = useSettingsStore((s) => s.numericSettingDrafts)
  void numericSettingDrafts; // E1
  const providerNumericSettingDrafts = useSettingsStore((s) => s.providerNumericSettingDrafts)
  void providerNumericSettingDrafts; // E1
  const setProviderNumericSettingDrafts = useSettingsStore((s) => s.setProviderNumericSettingDrafts)

  // ── Chat store ──
  const conversations = useChatStore((s) => s.conversations)
  const setConversations = useChatStore((s) => s.setConversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId)
  const draftsByConversation = useChatStore((s) => s.draftsByConversation)
  const setDraftsByConversation = useChatStore((s) => s.setDraftsByConversation)
  const historyStats = useChatStore((s) => s.historyStats)
  const chatStateLoadError = useChatStore((s) => s.chatStateLoadError)
  const chatStateLoaded = useChatStore((s) => s.chatStateLoaded)
  const pendingImages = useChatStore((s) => s.pendingImages)
  const setPendingImages = useChatStore((s) => s.setPendingImages)
  const pendingImageCompressionTaskIdRef = useRef<Record<string, number>>({})

  // ── Chat UI (delegated to useChatUI hook) ──
  const {
    openDrawer, closeDrawer, drawerMounted, drawerVisible,
    openModelMenu, closeModelMenu, modelMenuMounted,
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
  void manualModelDraft; // E1
  const setManualModelDraft = useUIStore((s) => s.setManualModelDraft)
  const providerModelSearch = useUIStore((s) => s.providerModelSearch)
  const setProviderModelSearch = useUIStore((s) => s.setProviderModelSearch)
  const isFetchingModelsByProviderId = useUIStore((s) => s.isFetchingModelsByProviderId)
  void isFetchingModelsByProviderId; // E1
  const setIsFetchingModelsByProviderId = useUIStore((s) => s.setIsFetchingModelsByProviderId)
  void setIsFetchingModelsByProviderId;

  // ── UI store: prompt editors ──
  const openPromptEditors = useUIStore((s) => s.openPromptEditors)
  void openPromptEditors; // E1
  const openProviderPromptEditors = useUIStore((s) => s.openProviderPromptEditors)
  void openProviderPromptEditors; // E1
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
  const activeConversationIdRef = useRef(initialStateRef.current.activeConversationId)
  const draftsByConversationRef = useRef<ConversationDrafts>(initialStateRef.current.draftsByConversation)
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

  const nativeRuntimeAvailable = isNativeRuntimeAvailable()
  void nativeRuntimeAvailable; // E1

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
  void filteredProviderModels; // E1

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
  const perms = usePermissions(pushNotice)
  const conv = useConversation(initialStateRef, pushNotice)
  const {
    skillRecords,
    runtimeRecords,
    isLoadingExtensions,
    isInstallingSkillArchive,
    isInstallingRuntimeArchive,
    skillConfigTargetId,
    skillConfigDraft,
    skillConfigValue,
    skillConfigRawError,
    isLoadingSkillConfig,
    isSavingSkillConfig,
    modelHealth,
    skillConfigTarget,
    handleSkillArchiveSelect,
    handleRuntimeArchiveSelect,
    handleSetSkillEnabled,
    handleSetRuntimeEnabled,
    handleSetDefaultRuntime,
    handleTestRuntime,
    handleSkillConfigDraftChange,
    applySkillConfigValue,
    formatSkillConfigDraft,
    openSkillConfigEditor,
    saveSkillConfig,
    deleteSkillById,
    deleteRuntimeById,
    requestDeleteSkill,
    requestDeleteRuntime,
    refreshExtensions,
    setModelHealth,
  } = useExtensions(pushNotice, openDeleteDialog)
  void skillConfigTargetId; void setModelHealth; void modelHealth; // E1
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
    requestDeleteProvider,
    setProviderModelEnabled,
    addManualProviderModel,
    selectCurrentModel,
    resetProviderDetailState,
    updateSetting,
    updateDailyCoverSetting,
    resetPromptToDefault,
    fetchProviderModels,
    testProviderModel,
    activeProviderRequestSettings,
  } = useSettings(pushNotice, openDeleteDialog)
  void applySettingsUpdate; void updateProviderById;

  // ── Relay ActiNetSettings custom events as pushNotice ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type: 'success' | 'error' | 'info'; text: string } | undefined
      if (detail) pushNotice(detail.text, detail.type)
    }
    window.addEventListener('actinet-notice', handler)
    return () => window.removeEventListener('actinet-notice', handler)
  }, [pushNotice])

  const togglePromptEditor = useCallback((key: TagPromptEditorKey): void => {
    useUIStore.getState().togglePromptEditor(key)
  }, [])

  const toggleProviderPromptEditor = useCallback((key: PromptEditorKey): void => {
    useUIStore.getState().toggleProviderPromptEditor(key)
  }, [])

  const openSettingsHome = useCallback((): void => {
    navigateSettingsView('main')
    resetProviderDetailState()
    useExtensionsStore.getState().setSkillConfigTargetId(null)
    useExtensionsStore.getState().setSkillConfigDraft('')
    useExtensionsStore.getState().setSkillConfigValue({})
    useExtensionsStore.getState().setSkillConfigRawError(null)
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
    useExtensionsStore.getState().setSkillConfigTargetId(null)
    useExtensionsStore.getState().setSkillConfigDraft('')
    useExtensionsStore.getState().setSkillConfigValue({})
    useExtensionsStore.getState().setSkillConfigRawError(null)
    closeSettings()
  }, [closeSettings, rememberSettingsScrollPosition, resetProviderDetailState])

  const handleSettingsBack = useCallback((): void => {
    if (settingsView === 'skill-config') {
      rememberSettingsScrollPosition()
      navigateSettingsView('skills')
      useExtensionsStore.getState().setSkillConfigTargetId(null)
      useExtensionsStore.getState().setSkillConfigDraft('')
      useExtensionsStore.getState().setSkillConfigValue({})
      useExtensionsStore.getState().setSkillConfigRawError(null)
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
  void toggleProviderPromptEditor; // E1
  void togglePromptEditor; // E1

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

  // ── Message editing ──
  const beginEdit = useCallback((message: ChatMessage): void => {
    setEditingMessageId(message.id)
    setEditingText(message.text)
  }, [setEditingMessageId, setEditingText])

  const saveAssistantEdit = useCallback((): void => {
    if (!editingMessageId || !activeConversation) return
    const nextText = editingText.trim()
    if (!nextText) { pushNotice('内容不能为空。', 'error'); return }
    const target = activeMessages.find((m) => m.id === editingMessageId && m.role === 'assistant')
    if (!target) { cancelEdit(); return }
    let inserted = false
    const replacement = createStaticAssistantEvent(
      target.turnId, nextText,
      activeProviderRequestSettings?.currentModel,
    )
    const nextTranscript = activeConversation.transcript.flatMap((event) => {
      if (event.turnId !== target.turnId) return [event]
      if (event.kind === 'user_message') { inserted = true; return [event, replacement] }
      return []
    })
    if (!inserted) { cancelEdit(); return }
    conv.updateConversationTranscript(activeConversation.id, nextTranscript)
    cancelEdit()
  }, [editingMessageId, activeConversation, editingText, activeMessages, activeProviderRequestSettings, cancelEdit, pushNotice])

  const saveUserEdit = useCallback(async (resend: boolean): Promise<void> => {
    if (!editingMessageId || !activeConversation) return
    const nextText = editingText.trim()
    if (!nextText) { pushNotice('内容不能为空。', 'error'); return }
    const target = activeMessages.find((m) => m.id === editingMessageId && m.role === 'user')
    if (!target) { cancelEdit(); return }
    const userEvent = activeConversation.transcript.find(
      (e): e is UserMessageTranscriptEvent => e.kind === 'user_message' && e.id === editingMessageId,
    )
    if (!userEvent) { cancelEdit(); return }
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
      conv.updateConversationTranscript(activeConversation.id, nextTranscript)
      cancelEdit()
      return
    }
    if (isSending) { pushNotice('请先停止当前生成。', 'error'); return }
    const nextTranscript = activeConversation.transcript.map((event) =>
      event.kind === 'user_message' && event.id === editingMessageId ? updatedUserEvent : event,
    )
    conv.updateConversationTranscript(activeConversation.id, nextTranscript)
    cancelEdit()
    handleSend()
  }, [editingMessageId, activeConversation, editingText, activeMessages, isSending, cancelEdit, handleSend, pushNotice])

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
    conv.hydrateConversationById(conversationId)
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

  // conversation effects (image hydration, persist) now handled by useConversation hook

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
  // ── Composer rendering extracted to views/ComposerView.tsx (Phase E3) ──
  // ── Settings rendering extracted to views/SettingsPage.tsx (Phase E1) ──

  return (
    <AppShell
      isHomepageEmptyState={isHomepageEmptyState}
      hasActiveMessages={hasActiveMessages}
      homepageSendTransition={homepageSendTransition}
      appShellStyle={appShellStyle}
      shouldShowHomepageBackground={shouldShowHomepageBackground}
      resolvedDailyCover={resolvedDailyCover}
      shouldShowChatBackground={shouldShowChatBackground}
      onHomepageTransitionEnd={() => setHomepageSendTransition(null)}
      transitionElements={
        <>
          {homepageSendTransition ? (
            <HomepageSendTransition
              transition={homepageSendTransition}
              numberFormatter={numberFormatter}
              onAnimationEnd={() => setHomepageSendTransition(null)}
            />
          ) : null}
          {titleTransition ? <TitleTransition transition={titleTransition} /> : null}
        </>
      }
      headerElement={
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
      }
      summaryElement={
        <ChatSummaryBar ref={chatSummaryBarRef} summary={chatSummarySnapshot} numberFormatter={numberFormatter} />
      }
      noticeElement={notice ? <NoticeBanner notice={notice} /> : null}
      contentElement={
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

                <HomepageView
                  isActiveConversationLoadError={isActiveConversationLoadError}
                  isActiveConversationLoading={isActiveConversationLoading}
                  activeMessagesLength={activeMessages.length}
                  activeConversation={activeConversation}
                  chatStateLoadError={chatStateLoadError ?? null}
                  hydrateConversationById={conv.hydrateConversationById}
                  displayConversationTitle={displayConversationTitle}
                  showCloudAuthOnHomepage={showCloudAuthOnHomepage}
                  isCloudAuthRegisterMode={isCloudAuthRegisterMode}
                  setCloudAuthMode={setCloudAuthMode}
                  setAuthVersion={setAuthVersion}
                  homepageShowcaseRef={homepageShowcaseRef}
                  resolvedDailyCover={resolvedDailyCover}
                  homepageHighlightStats={homepageHighlightStats}
                  getResponseModeLabel={getResponseModeLabel}
                  activeConversationResponseMode={activeConversationResponseMode}
                />

                {!isActiveConversationLoadError && !isActiveConversationLoading ? (
                  <ChatView
                    activeMessages={activeMessages}
                    settings={settings}
                    providers={settings.providers}
                    toggleReasoning={toggleReasoning}
                    toggleSkillResult={toggleSkillResult}
                    copyMessageText={copyMessageText}
                    beginEdit={beginEdit}
                    saveAssistantEdit={saveAssistantEdit}
                    saveUserEdit={saveUserEdit}
                    cancelEdit={cancelEdit}
                    regenerate={regenerate}
                    openImageViewer={openImageViewer}
                  />
                ) : null}

                {hasActiveMessages ? (
                  <ChatScrollPlaceholder heightPx={activeChatScrollInsets.bottom} position="bottom" />
                ) : null}
              </div>
              </div>
            </main>
        </>
      }
      composerElement={
        <ComposerView
          draft={draft}
          activeConversation={activeConversation}
          activeConversationResponseMode={activeConversationResponseMode}
          activeConversationModeLocked={activeConversationModeLocked}
          isComposerLocked={conv.isComposerLocked}
          canSend={conv.canSend}
          canAppendWhileSending={conv.canAppendWhileSending}
          pendingImages={pendingImages}
          enabledModelOptions={enabledModelOptions}
          enabledModelsByProvider={enabledModelsByProvider}
          scrollToBottomButtonMounted={scrollToBottomButtonMounted}
          scrollToBottomButtonVisible={scrollToBottomButtonVisible}
          isSending={isSending}
          model={{
            openModelMenu,
            closeModelMenu,
            selectCurrentModel,
            updateSetting,
            openSettings,
            navigateSettingsView,
            updateConversationResponseMode: conv.updateConversationResponseMode,
          }}
          actions={{
            handleSend,
            handleAppend,
            stopGeneration: assistant.stopGeneration,
            handleImageSelect,
            handleScrollToBottomButtonClick,
            pushNotice,
            removePendingImage: conv.removePendingImage,
            updatePendingImageCompression: conv.updatePendingImageCompression,
            updateConversationDraft: conv.updateConversationDraft,
            openImageViewer,
          }}
          refs={{
            modelMenuRef,
            composerFooterRef,
            composerInputRef,
            fileInputRef,
            cameraInputRef,
          }}
        />
      }
      fileInputElements={
        <>
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
      }
      drawerElement={
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
      }
      imageViewerElement={
        imageViewerMounted && imageViewer ? (
          <ImageViewer
            items={imageViewer.items}
            initialIndex={imageViewer.initialIndex}
            visible={imageViewerVisible}
            onClose={closeImageViewer}
          />
        ) : null
      }
      deleteConfirmationElement={
        <DeleteConfirmationLayer
          confirmDeleteConversation={confirmDeleteConversation}
          confirmDeleteProvider={confirmDeleteProvider}
          confirmDeleteSkill={confirmDeleteSkill}
          confirmDeleteRuntime={confirmDeleteRuntime}
        />
      }
      updateDialogElement={
        updates.showUpdateDialog && updates.pendingUpdate && !updates.updatingNow ? (
          <UpdateDialog
            update={updates.pendingUpdate}
            onCancel={() => updates.dismissUpdateDialog()}
            onInstall={updates.handleInstallUpdate}
          />
        ) : null
      }
      settingsElement={
        settingsMounted ? (
          <div className={`settings-screen ${settingsVisible ? 'is-open' : 'is-closing'}`}>
            <SettingsPage
              resolvedDailyCover={resolvedDailyCover}
              cloudLoggedIn={cloudLoggedIn}
              setCloudAuthMode={setCloudAuthMode}
              navigation={{
                navigateSettingsView,
                handleSettingsBack,
                closeSettingsPanel,
                openProviderDetail,
              }}
              updateSetting={updateSetting}
              updateDailyCoverSetting={updateDailyCoverSetting}
              resetPromptToDefault={resetPromptToDefault}
              handleNumericSettingChange={handleNumericSettingChange}
              finalizeNumericSettingDraft={finalizeNumericSettingDraft}
              handleProviderNumericSettingChange={handleProviderNumericSettingChange}
              finalizeProviderNumericSettingDraft={finalizeProviderNumericSettingDraft}
              addProvider={addProvider}
              deleteProvider={deleteProvider}
              requestDeleteProvider={requestDeleteProvider}
              updateProviderField={updateProviderField}
              setProviderModelEnabled={setProviderModelEnabled}
              addManualProviderModel={addManualProviderModel}
              selectCurrentModel={selectCurrentModel}
              resetProviderDetailState={resetProviderDetailState}
              fetchProviderModels={fetchProviderModels}
              testProviderModel={testProviderModel}
              updateProviderPromptOverride={updateProviderPromptOverride}
              clearProviderPromptOverride={clearProviderPromptOverride}
              updateProviderInfoPromptOverride={updateProviderInfoPromptOverride}
              clearProviderInfoPromptOverride={clearProviderInfoPromptOverride}
              updateProviderById={updateProviderById}
              skillRecords={skillRecords}
              runtimeRecords={runtimeRecords}
              isLoadingExtensions={isLoadingExtensions}
              isInstallingSkillArchive={isInstallingSkillArchive}
              isInstallingRuntimeArchive={isInstallingRuntimeArchive}
              skillConfigTargetId={skillConfigTargetId}
              skillConfigDraft={skillConfigDraft}
              skillConfigValue={skillConfigValue}
              skillConfigRawError={skillConfigRawError}
              isLoadingSkillConfig={isLoadingSkillConfig}
              isSavingSkillConfig={isSavingSkillConfig}
              skillConfigTarget={skillConfigTarget}
              handleSkillArchiveSelect={handleSkillArchiveSelect}
              handleRuntimeArchiveSelect={handleRuntimeArchiveSelect}
              handleSetSkillEnabled={handleSetSkillEnabled}
              handleSetRuntimeEnabled={handleSetRuntimeEnabled}
              handleSetDefaultRuntime={handleSetDefaultRuntime}
              handleTestRuntime={handleTestRuntime}
              handleSkillConfigDraftChange={handleSkillConfigDraftChange}
              applySkillConfigValue={applySkillConfigValue}
              formatSkillConfigDraft={formatSkillConfigDraft}
              openSkillConfigEditor={openSkillConfigEditor}
              saveSkillConfig={saveSkillConfig}
              requestDeleteSkill={requestDeleteSkill}
              requestDeleteRuntime={requestDeleteRuntime}
              refreshExtensions={refreshExtensions}
              requestingPermissionByKey={perms.requestingPermissionByKey}
              handlePermissionToggle={perms.handlePermissionToggle}
              handleManualUpdateCheck={updates.handleManualUpdateCheck}
              pushNotice={pushNotice}
              skillArchiveInputRef={skillArchiveInputRef}
              runtimeArchiveInputRef={runtimeArchiveInputRef}
              settingsPageRef={settingsPageRef}
              onSettingsScroll={onSettingsScroll}
            />
          </div>
        ) : null
      }
    />
  )
}

export default App
