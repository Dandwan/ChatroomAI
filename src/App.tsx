import {
  type CSSProperties,
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
  type TranscriptContentPart,
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
  createAssistantTextFlow,
} from './utils/assistant-flow'
import {
  buildHistoryStatsFromSummaries,
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
  Notice,
  SettingsView,
  TurnExecutionJob,
} from './state/types'
import {
  HOMEPAGE_SEND_TRANSITION_DURATION_MS,
  SETTINGS_STORAGE_KEY,
  SETTINGS_PERSIST_DEBOUNCE_MS,
} from './state/types'
import { useUIStore } from './state/ui-store'
import { useExtensionsStore } from './state/extensions-store'
import { useAssistant } from './hooks/useAssistant'
import { createStaticAssistantEvent, buildUserTranscriptContent } from './hooks/useAssistant'
import { useAssistantStream } from './hooks/useAssistantStream'
import { useTitleTransition } from './hooks/useTitleTransition'
import { useMessageListScroll } from './hooks/useMessageListScroll'
import { useSettingsNavigation } from './hooks/useSettingsNavigation'
import { useConversationDrawer } from './hooks/useConversationDrawer'
import { useDeleteConfirmation } from './hooks/useDeleteConfirmation'
import { useChatUI } from './hooks/useChatUI'
import { useChatStore } from './state/chat-store'
import { useSettingsStore } from './state/settings-store'
import './App.css'
import './styles/app-editorial-redesign.css'

import {
  numberFormatter,
  createId,
  formatCompactCount,
  getResponseModeLabel,
} from './utils/app-formatting'

import {
  createConversation,
  createInitialChatState,
  createProviderNumericSettingDrafts,
  extractThinkBlocks,
  getEnabledModelOptions,
  isPersistedConversationSummary,
  loadSettings,
  ACTINET_PROVIDER_ID,
  ACTINET_PROVIDER_NAME,
  hasConversationStarted,
  MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR,
  createNumericSettingDrafts,
  resolveConversationResponseMode,
  toConversationSummary,
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

  const modelMenuRef = useRef<HTMLDivElement | null>(null)

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
  } = useChatUI({ modelMenuRef })
  void copyTextToClipboard;

  // ── UI store: settings navigation ──
  const settingsView = useUIStore((s) => s.settingsView)
  const providerDetailTargetId = useUIStore((s) => s.providerDetailTargetId)
  const manualModelDraft = useUIStore((s) => s.manualModelDraft)
  void manualModelDraft; // E1
  const providerModelSearch = useUIStore((s) => s.providerModelSearch)
  const isFetchingModelsByProviderId = useUIStore((s) => s.isFetchingModelsByProviderId)
  void isFetchingModelsByProviderId; // E1
  const setIsFetchingModelsByProviderId = useUIStore((s) => s.setIsFetchingModelsByProviderId)
  void setIsFetchingModelsByProviderId;

  // ── UI store: prompt editors ──
  const openPromptEditors = useUIStore((s) => s.openPromptEditors)
  void openPromptEditors; // E1
  const openProviderPromptEditors = useUIStore((s) => s.openProviderPromptEditors)
  void openProviderPromptEditors; // E1

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
  const setSwipingConversationId = useUIStore((s) => s.setSwipingConversation)
  const setSwipeOffsetX = useUIStore((s) => s.setSwipeOffsetX)

  // ── UI store: scroll ──
  const messageListScrollMetrics = useUIStore((s) => s.messageListScrollMetrics)
  const activeChatScrollInsets = useUIStore((s) => s.activeChatScrollInsets); void activeChatScrollInsets

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
  const processingTurnQueueRef = useRef(false)
  void processingTurnQueueRef;

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

  const assistantStream = useAssistantStream({ updateAssistantEvent: conv.updateAssistantEvent })

  const titleHook = useTitleTransition({
    titleTextRef,
    titleRenameButtonRef,
    titleInputRef,
    titleActionsRef,
    activeConversation: conv.activeConversation,
    activeConversationId,
    pushNotice,
    updateConversationTitle: conv.updateConversationTitle,
  })

  const messageListScroll = useMessageListScroll({
    messageListRef,
    chatContentStackRef,
    chatHeaderRef,
    chatSummaryBarRef,
    composerFooterRef,
    showScrollToBottomButton,
    hideScrollToBottomButton,
    activeConversationId,
    activeMessages,
    hasActiveMessages,
    isSending,
    pendingImagesLength: pendingImages.length,
  })

  const settingsNav = useSettingsNavigation({
    settingsPageRef,
    settingsScrollByViewRef,
    openSettings,
    closeSettings,
    closeDrawer,
  })

  const drawer = useConversationDrawer({
    conversationListRef,
    conversationGroupElementRefs,
    pushNotice,
    closeDrawer,
    closeModelMenu,
    closeDeleteDialog: () => useUIStore.getState().closeDeleteDialog(),
    openDeleteDialog,
    cancelEdit: assistant.cancelEdit,
    stopRenameConversationImmediately: titleHook.stopRenameConversationImmediately,
    openSettingsFromDrawer: settingsNav.openSettingsFromDrawer,
    activeConversationId,
    conversations: conv.conversations,
    conversationGroups: conv.conversationGroups,
    drawerVisible,
    autoCollapseConversations: settings.autoCollapseConversations,
    hydrateConversationById: conv.hydrateConversationById,
    deleteConfirmBypassUntilRef,
    pendingImageCompressionTaskIdRef,
    setActiveConversationId,
    setConversationsState,
    setDraftsByConversation,
    setPendingImages,
    settings: { deleteModeHapticsEnabled: settings.deleteModeHapticsEnabled, deleteConfirmGraceSeconds: settings.deleteConfirmGraceSeconds },
  })

  const deleteConfirm = useDeleteConfirmation({
    openDeleteDialog,
    deleteConversation: drawer.deleteConversation,
    deleteProvider,
    deleteSkillById,
    deleteRuntimeById,
    conversations: conv.conversations,
    providers: settings.providers,
    skillRecords: useExtensionsStore.getState().skillRecords,
    runtimeRecords: useExtensionsStore.getState().runtimeRecords,
    settings: { deleteConfirmGraceSeconds: settings.deleteConfirmGraceSeconds },
    deleteConfirmBypassUntilRef,
  })

  const ensureReadyToRequest = (): boolean => {
    if (!activeProviderRequestSettings) {
      pushNotice('请先选择已启用模型。', 'error')
      if (enabledModelOptions.length === 0) {
        openSettings()
        settingsNav.navigateSettingsView('providers')
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
      settingsNav.openProviderDetail(activeProviderRequestSettings.providerId)
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
    assistantStream.flushQueuedAssistantStreamDelta()
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
          const normalizedFlow = nextFlow && nextFlow.length > 0 ? nextFlow : undefined
          const nextEvent = normalizedFlow === event.assistantFlow ? event : { ...event, assistantFlow: normalizedFlow }
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





  const toggleReasoning = (messageId: string): void => {
    useUIStore.getState().toggleReasoning(messageId)
  }

  const toggleSkillResult = (stepId: string): void => {
    useUIStore.getState().toggleSkillResult(stepId)
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
        deleteConfirm.closeDeleteDialog()
        return
      }
      if (modelMenuMounted) {
        closeModelMenu()
        return
      }
      if (settingsMounted) {
        settingsNav.handleSettingsBack()
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
    deleteConfirm.closeDeleteDialog,
    closeModelMenu,
    deleteDialogConversationId,
    deleteDialogProviderId,
    deleteDialogSkillId,
    deleteDialogRuntimeId,
    drawerMounted,
    settingsNav.handleSettingsBack,
    imageViewerMounted,
    modelMenuMounted,
    settingsMounted,
  ])

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
      deleteConfirm.closeDeleteDialog()
    }
  }, [deleteDialog, conversations, settings.providers, skillRecords, runtimeRecords, deleteConfirm.closeDeleteDialog])

  useEffect(() => {
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
    cancelEdit()
    titleHook.stopRenameConversationImmediately()
    closeModelMenu()
  }, [activeConversationId, closeModelMenu, titleHook.stopRenameConversationImmediately])

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
    deleteConfirm.closeDeleteDialog()
  }, [drawerMounted])

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
          {titleHook.titleTransition ? <TitleTransition transition={titleHook.titleTransition} /> : null}
        </>
      }
      headerElement={
        <ChatHeader
          chatHeaderRef={chatHeaderRef}
          titleTextRef={titleTextRef}
          titleRenameButtonRef={titleRenameButtonRef}
          titleInputRef={titleInputRef}
          titleActionsRef={titleActionsRef}
          isEditingTitle={titleHook.isEditingTitle}
          titleDraft={titleHook.titleDraft}
          titleTransition={titleHook.titleTransition}
          activeConversation={activeConversation}
          displayConversationTitle={displayConversationTitle}
          shouldShowTitleRenameButton={shouldShowTitleRenameButton}
          themeMode={settings.themeMode}
          openDrawer={openDrawer}
          setTitleDraft={titleHook.setTitleDraft}
          saveRenameConversation={titleHook.saveRenameConversation}
          cancelRenameConversation={titleHook.cancelRenameConversation}
          beginRenameConversation={titleHook.beginRenameConversation}
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
            onScroll={messageListScroll.onScroll}
            onPointerDownCapture={messageListScroll.onPointerDownCapture}
            onPointerUpCapture={messageListScroll.onPointerUpCapture}
            onPointerCancelCapture={messageListScroll.onPointerCancelCapture}
            onWheelCapture={messageListScroll.onWheelCapture}
          >
            <div
              className={`chat-content-frame ${isHomepageEmptyState ? 'is-homepage-empty' : 'has-active-messages'}`}
            >
              <div
                ref={chatContentStackRef}
                className={`chat-content-stack ${isHomepageEmptyState ? 'is-homepage-empty' : 'has-active-messages'}`}
              >
                {hasActiveMessages ? (
                  <ChatScrollPlaceholder heightPx={messageListScroll.activeChatScrollInsets.top} position="top" />
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
                  <ChatScrollPlaceholder heightPx={messageListScroll.activeChatScrollInsets.bottom} position="bottom" />
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
            navigateSettingsView: settingsNav.navigateSettingsView,
            updateConversationResponseMode: conv.updateConversationResponseMode,
          }}
          actions={{
            handleSend,
            handleAppend,
            stopGeneration: assistant.stopGeneration,
            handleImageSelect,
            handleScrollToBottomButtonClick: messageListScroll.handleScrollToBottomButtonClick,
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
          toggleConversationGroup={drawer.toggleConversationGroup}
          handleConversationPointerDown={drawer.handleConversationPointerDown}
          handleConversationPointerMove={drawer.handleConversationPointerMove}
          handleConversationPointerUp={drawer.handleConversationPointerUp}
          handleConversationPointerCancel={drawer.handleConversationPointerCancel}
          handleConversationClick={drawer.handleConversationClick}
          requestDeleteConversation={deleteConfirm.requestDeleteConversation}
          openSettingsFromDrawer={settingsNav.openSettingsFromDrawer}
          createNewConversation={drawer.createNewConversation}
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
          confirmDeleteConversation={deleteConfirm.confirmDeleteConversation}
          confirmDeleteProvider={deleteConfirm.confirmDeleteProvider}
          confirmDeleteSkill={deleteConfirm.confirmDeleteSkill}
          confirmDeleteRuntime={deleteConfirm.confirmDeleteRuntime}
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
                navigateSettingsView: settingsNav.navigateSettingsView,
                handleSettingsBack: settingsNav.handleSettingsBack,
                closeSettingsPanel: settingsNav.closeSettingsPanel,
                openProviderDetail: settingsNav.openProviderDetail,
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
              onSettingsScroll={settingsNav.onSettingsScroll}
            />
          </div>
        ) : null
      }
    />
  )
}

export default App
