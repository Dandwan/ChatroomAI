/**
 * 对话管理 hook — 提取自 App.tsx（D1 阶段）
 *
 * 使用 Zustand stores 管理对话状态、CRUD、水合和持久化。
 * 所有状态通过 stores 共享，效果和回调独立于 App 组件。
 */
import {
  startTransition,
  useCallback,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import {
  isTranscriptConversationWorkspacePlaceholder,
  projectConversationMessages,
  type AssistantMessageTranscriptEvent,
  type TranscriptEvent,
} from '../services/chat-transcript'
import type {
  ChatSummarySnapshot,
  Conversation,
  ConversationDrafts,
  ConversationGroup,
  ConversationResponseMode,
  LoadedChatState,
} from '../state/types'
import {
  CHAT_STATE_PERSIST_DEBOUNCE_MS,
  SWIPE_DELETE_TOGGLE_THRESHOLD_PX,
  SWIPE_DELETE_MAX_OFFSET_PX,
  LONG_PRESS_DELETE_MODE_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
} from '../state/types'
import { useUIStore } from '../state/ui-store'
import { useChatStore } from '../state/chat-store'
import { useSettingsStore } from '../state/settings-store'
import {
  buildHistoryStatsFromSummaries,
  deleteConversationStorage,
  getChatStatePersistenceSignature,
  loadChatIndex,
  loadConversationState,
  loadStoredAttachmentDataUrl,
  persistChatState,
} from '../services/chat-storage'
import { applyAssignedImageStorageKeys } from '../utils/app-images'
import { compressImageDataUrl } from '../utils/images'
import { numberFormatter, formatCompactCount } from '../utils/app-formatting'
import {
  selectHomepageHighlights,
  type HomepageHighlightStat,
} from '../services/homepage-highlights'
import {
  createConversation,
  createSummaryConversation,
  buildPersistChatState,
  resolveConversationResponseMode,
  toConversationSummary,
  toHydratedConversation,
  withConversationRecordResponseMode,
  withConversationRecordTranscript,
  hasConversationStarted,
  isPersistedConversationSummary,
  vibrateInteraction,
} from '../utils/app-module'

export function useConversation(
  initialStateRef: React.MutableRefObject<LoadedChatState | null>,
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void,
) {
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

  const settings = useSettingsStore((s) => s.settings)

  const drawerMounted = useUIStore((s) => s.drawerMounted)
  const drawerVisible = useUIStore((s) => s.drawerVisible)
  const isSending = useUIStore((s) => s.isSending)
  const activeRequestConversationId = useUIStore((s) => s.activeRequestConversationId)

  // ── Refs ──
  const pendingImageCompressionTaskIdRef = useRef<Record<string, number>>({})
  const conversationPersistTaskIdRef = useRef(0)
  const chatStateSignatureRef = useRef('')
  const activeConversationIdRef = useRef(initialStateRef.current!.activeConversationId)
  const draftsByConversationRef = useRef<ConversationDrafts>(initialStateRef.current!.draftsByConversation)
  const hydratingImageKeysRef = useRef<Set<string>>(new Set())

  // ── setConversationsState ──
  const setConversationsState = useCallback(
    (nextState: Conversation[] | ((previous: Conversation[]) => Conversation[])): void => {
      const next = typeof nextState === 'function'
        ? (nextState as (p: Conversation[]) => Conversation[])(useChatStore.getState().conversations)
        : nextState
      setConversations(next)
    },
    [setConversations],
  )

  useEffect(() => { activeConversationIdRef.current = activeConversationId }, [activeConversationId])
  useEffect(() => { draftsByConversationRef.current = draftsByConversation }, [draftsByConversation])

  // ── Computed values ──
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? null,
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

  const projectedMessagesByConversationId = useMemo(
    () => new Map(conversations.map((c) => [c.id, projectConversationMessages(c)])),
    [conversations],
  )
  const activeMessages = useMemo(
    () => (activeConversation ? projectedMessagesByConversationId.get(activeConversation.id) ?? [] : []),
    [activeConversation, projectedMessagesByConversationId],
  )
  const conversationSummariesById = useMemo(
    () => new Map(conversations.map((c) => [c.id, toConversationSummary(c, draftsByConversation[c.id] ?? '')])),
    [conversations, draftsByConversation],
  )
  const currentHistoryStats = useMemo(
    () => buildHistoryStatsFromSummaries(
      Array.from(conversationSummariesById.values()).filter((s) => isPersistedConversationSummary(s)),
    ),
    [conversationSummariesById],
  )
  const effectiveHistoryStats = chatStateLoaded ? currentHistoryStats : historyStats
  const hasActiveMessages = activeMessages.length > 0
  const isHomepageEmptyState = activeConversation?.storageLoadState === 'hydrated' && activeMessages.length === 0

  const draft = activeConversation ? draftsByConversation[activeConversation.id] ?? '' : ''
  const visibleConversations = useMemo(
    () => conversations.filter((c) =>
      c.storageLoadState !== 'hydrated' || !isTranscriptConversationWorkspacePlaceholder(c, draftsByConversation[c.id] ?? ''),
    ),
    [conversations, draftsByConversation],
  )
  const sortedConversations = useMemo(
    () => [...visibleConversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [visibleConversations],
  )
  const conversationGroups = useMemo<ConversationGroup[]>(() => {
    const gapMs = Math.max(0, settings.conversationGroupGapMinutes) * 60 * 1000
    const groups: ConversationGroup[] = []
    for (const c of sortedConversations) {
      const lastGroup = groups[groups.length - 1]
      const prev = lastGroup?.conversations[lastGroup.conversations.length - 1]
      if (!prev || prev.updatedAt - c.updatedAt > gapMs) {
        groups.push({ id: c.id, labelTime: c.updatedAt, conversations: [c] })
      } else {
        lastGroup.conversations.push(c)
      }
    }
    return groups.map((g) => ({ ...g, id: g.conversations.map((c) => c.id).join('|') }))
  }, [sortedConversations, settings.conversationGroupGapMinutes])

  const isRunningInActiveConversation = activeConversation !== null && activeRequestConversationId !== null && activeConversation.id === activeRequestConversationId

  const tokenSummary = useMemo(() => {
    let promptTokens = 0, completionTokens = 0, totalTokens = 0, estimatedCount = 0
    for (const m of activeMessages) {
      if (m.role !== 'assistant' || !m.usage) continue
      promptTokens += m.usage.promptTokens; completionTokens += m.usage.completionTokens
      totalTokens += m.usage.totalTokens; if (m.usageEstimated) estimatedCount++
    }
    return { promptTokens, completionTokens, totalTokens, estimatedCount }
  }, [activeMessages])

  const rounds = useMemo(() => activeMessages.filter((m) => m.role === 'user').length, [activeMessages])
  const chatSummarySnapshot = useMemo<ChatSummarySnapshot>(() => ({
    rounds, promptTokens: tokenSummary.promptTokens, completionTokens: tokenSummary.completionTokens,
    totalTokens: tokenSummary.totalTokens, estimatedCount: tokenSummary.estimatedCount,
  }), [rounds, tokenSummary])

  const emptyStateStats = useMemo(() => ({
    totalConversationCount: effectiveHistoryStats.totalConversationCount,
    totalPhotoCount: effectiveHistoryStats.totalPhotoCount,
    totalMessageCount: effectiveHistoryStats.totalMessageCount,
    totalTokenCount: effectiveHistoryStats.totalTokenCount,
    totalToolCallCount: effectiveHistoryStats.totalToolCallCount,
  }), [effectiveHistoryStats])

  const homepageHighlightStats = useMemo<HomepageHighlightStat[]>(
    () => selectHomepageHighlights([
      { id: 'tokenUsage', label: 'Total token use', value: formatCompactCount(emptyStateStats.totalTokenCount), meta: '词元消耗', count: emptyStateStats.totalTokenCount, priority: 'primary' as const },
      { id: 'conversationHistory', label: 'Conversation archive', value: numberFormatter.format(emptyStateStats.totalConversationCount), meta: '历史会话', count: emptyStateStats.totalConversationCount, priority: 'primary' as const },
      { id: 'toolCalls', label: 'Tool calls', value: numberFormatter.format(emptyStateStats.totalToolCallCount), meta: '工具调用', count: emptyStateStats.totalToolCallCount, priority: 'primary' as const },
      { id: 'imagesSent', label: 'Images sent', value: numberFormatter.format(emptyStateStats.totalPhotoCount), meta: '发送图片', count: emptyStateStats.totalPhotoCount, priority: 'backup' as const },
      { id: 'messageCount', label: 'Messages sent', value: numberFormatter.format(emptyStateStats.totalMessageCount), meta: '消息数量', count: emptyStateStats.totalMessageCount, priority: 'backup' as const },
    ]),
    [emptyStateStats],
  )

  const hasDraftText = draft.trim().length > 0
  const hasComposerPayload = hasDraftText || pendingImages.length > 0
  const isComposerLocked = activeConversation === null || (activeConversation?.storageLoadState !== 'hydrated' && activeConversation?.storageLoadState !== 'error')
  const canSend = !isComposerLocked && hasComposerPayload && !isSending
  const canAppendWhileSending = !isComposerLocked && activeConversationResponseMode === 'tool' && isSending && isRunningInActiveConversation && hasComposerPayload

  // ── Transcript helpers ──
  const updateConversationDraft = useCallback((conversationId: string, nextDraft: string): void => {
    setDraftsByConversation((prev) => {
      if (nextDraft.length === 0) {
        if (!Object.prototype.hasOwnProperty.call(prev, conversationId)) return prev
        const n = { ...prev }; delete n[conversationId]; return n
      }
      if (prev[conversationId] === nextDraft) return prev
      return { ...prev, [conversationId]: nextDraft }
    })
  }, [setDraftsByConversation])

  const updateConversationTranscript = useCallback((conversationId: string, transcript: TranscriptEvent[]): void => {
    setConversationsState((prev) => prev.map((c) =>
      c.id === conversationId ? withConversationRecordTranscript(c, transcript, draftsByConversationRef.current[c.id] ?? '') : c,
    ))
  }, [setConversationsState])

  const updateConversationResponseMode = useCallback((conversationId: string, mode: ConversationResponseMode): void => {
    setConversationsState((prev) => prev.map((c) =>
      c.id === conversationId ? withConversationRecordResponseMode(c, mode, draftsByConversationRef.current[c.id] ?? '') : c,
    ))
  }, [setConversationsState])

  const appendConversationTranscriptEvents = useCallback((conversationId: string, events: TranscriptEvent[]): void => {
    if (events.length === 0) return
    setConversationsState((prev) => prev.map((c) =>
      c.id === conversationId ? withConversationRecordTranscript(c, [...c.transcript, ...events], draftsByConversationRef.current[c.id] ?? '') : c,
    ))
  }, [setConversationsState])

  const updateAssistantEvent = useCallback((
    conversationId: string, assistantId: string,
    updater: (event: AssistantMessageTranscriptEvent) => AssistantMessageTranscriptEvent,
  ): void => {
    setConversationsState((prev) => prev.map((c) => {
      if (c.id !== conversationId) return c
      let changed = false
      const nextTranscript = c.transcript.map((e) => {
        if (e.kind !== 'assistant_message' || e.id !== assistantId) return e
        const next = updater(e); if (next === e) return e
        changed = true; return next
      })
      return changed ? withConversationRecordTranscript(c, nextTranscript, draftsByConversationRef.current[c.id] ?? '') : c
    }))
  }, [setConversationsState])

  const updateConversationTitle = useCallback((conversationId: string, title: string, manual: boolean): void => {
    setConversationsState((prev) => prev.map((c) =>
      c.id === conversationId ? { ...c, title, titleManuallyEdited: manual, updatedAt: Date.now() } : c,
    ))
  }, [setConversationsState])

  // ── Hydration ──
  const hydrateConversationByIdImpl = useCallback((convId: string): void => {
    if (!chatStateLoaded) return
    const target = useChatStore.getState().conversations.find((c) => c.id === convId) ?? null
    if (!target || (target.storageLoadState !== 'summary' && target.storageLoadState !== 'error')) return
    setConversationsState((prev) => prev.map((c) =>
      c.id === convId ? { ...c, storageLoadState: 'hydrating' as const, storageLoadError: undefined } : c,
    ))
    void (async () => {
      try {
        const loaded = await loadConversationState(convId)
        if (!loaded) throw new Error('未找到该历史对话')
        if (!useChatStore.getState().conversations.some((c) => c.id === convId)) return
        startTransition(() => {
          setConversationsState((prev) => prev.map((c) =>
            c.id === convId ? toHydratedConversation(loaded.conversation, loaded.draftText) : c,
          ))
          setDraftsByConversation((prev) => {
            const nd = loaded.draftText
            if (!nd.trim()) {
              if (!Object.prototype.hasOwnProperty.call(prev, convId)) return prev
              const n = { ...prev }; delete n[convId]; return n
            }
            if (prev[convId] === nd) return prev
            return { ...prev, [convId]: nd }
          })
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误'
        startTransition(() => {
          setConversationsState((prev) => prev.map((c) =>
            c.id === convId ? { ...c, storageLoadState: 'error' as const, storageLoadError: msg } : c,
          ))
        })
      }
    })()
  }, [chatStateLoaded, setConversationsState, setDraftsByConversation])

  // ── CRUD ──
  const switchConversation = useCallback((convId: string): void => {
    setActiveConversationId(convId)
    hydrateConversationByIdImpl(convId)
    useUIStore.getState().setDrawerVisibility(true, false)
    const setDeleteModeEnabled = useUIStore.getState().setDeleteModeEnabled
    setDeleteModeEnabled(false)
    useUIStore.getState().closeDeleteDialog()
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
  }, [hydrateConversationByIdImpl, setActiveConversationId, setPendingImages])

  const deleteConversation_ = useCallback((convId: string): void => {
    let nextActiveId: string | null = null
    void deleteConversationStorage(convId).catch(() => {})
    const dlg = useUIStore.getState().deleteDialog
    if (dlg?.type === 'conversation' && dlg.targetId === convId) useUIStore.getState().closeDeleteDialog()
    setDraftsByConversation((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, convId)) return prev
      const n = { ...prev }; delete n[convId]; return n
    })
    setConversationsState((prev) => {
      if (!prev.some((c) => c.id === convId)) return prev
      const remaining = prev.filter((c) => c.id !== convId)
      if (remaining.some((c) => c.id === activeConversationId)) return remaining
      const fallback = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0] ??
        createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
      nextActiveId = fallback.id
      return remaining.length > 0 ? remaining : [fallback]
    })
    if (nextActiveId) setActiveConversationId(nextActiveId)
  }, [activeConversationId, setConversationsState, setActiveConversationId, setDraftsByConversation])

  const createNewConversation = useCallback((): void => {
    const placeholder = conversations.find((c) =>
      c.storageLoadState === 'hydrated' && isTranscriptConversationWorkspacePlaceholder(c, draftsByConversation[c.id] ?? ''),
    )
    const next = placeholder ?? createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
    if (!placeholder) setConversationsState((prev) => [next, ...prev])
    setActiveConversationId(next.id)
    useUIStore.getState().setDrawerVisibility(true, false)
    useUIStore.getState().setDeleteModeEnabled(false)
    useUIStore.getState().closeDeleteDialog()
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
  }, [conversations, draftsByConversation, setConversationsState, setActiveConversationId, setPendingImages])

  // ── Gesture refs ──
  const conversationSwipeStartRef = useRef<{
    conversationId: string; pointerId: number; x: number; y: number
    thresholdReached: boolean; longPressTriggered: boolean; longPressTimerId: number | null
  } | null>(null)
  const ignoreNextConversationClickRef = useRef<string | null>(null)
  const hasAutoCollapsedConversationGroupsRef = useRef(false)
  const conversationGroupElementRefs = useRef<Record<string, HTMLElement | null>>({})
  const conversationListRef = useRef<HTMLDivElement | null>(null)

  const setSwipingConversationId = useUIStore((s) => s.setSwipingConversation)
  const setSwipeOffsetX = useUIStore((s) => s.setSwipeOffsetX)
  const setDeleteModeEnabled2 = useUIStore((s) => s.setDeleteModeEnabled)

  const clearConversationGestureTimer = useCallback((): void => {
    const g = conversationSwipeStartRef.current
    if (g?.longPressTimerId !== null && g) { window.clearTimeout(g.longPressTimerId!); g.longPressTimerId = null }
  }, [])

  const resetConversationSwipe = useCallback((): void => {
    clearConversationGestureTimer()
    conversationSwipeStartRef.current = null
    setSwipingConversationId(null)
    setSwipeOffsetX(0)
  }, [clearConversationGestureTimer, setSwipingConversationId, setSwipeOffsetX])

  const toggleDeleteMode = useCallback((): void => {
    setDeleteModeEnabled2((prev: boolean) => !prev)
  }, [setDeleteModeEnabled2])

  const handleConversationPointerDown = useCallback((
    conversationId: string, event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    resetConversationSwipe()
    event.currentTarget.setPointerCapture(event.pointerId)
    const pid = event.pointerId
    const tid = window.setTimeout(() => {
      const g = conversationSwipeStartRef.current
      if (!g || g.conversationId !== conversationId || g.pointerId !== pid) return
      g.longPressTriggered = true; g.thresholdReached = false
      clearConversationGestureTimer()
      ignoreNextConversationClickRef.current = conversationId
      setSwipingConversationId(null); setSwipeOffsetX(0)
      if ((settings as any).deleteModeHapticsEnabled) vibrateInteraction()
      toggleDeleteMode()
    }, LONG_PRESS_DELETE_MODE_MS)
    conversationSwipeStartRef.current = { conversationId, pointerId: pid, x: event.clientX, y: event.clientY, thresholdReached: false, longPressTriggered: false, longPressTimerId: tid }
  }, [settings, toggleDeleteMode, resetConversationSwipe, clearConversationGestureTimer, setSwipingConversationId, setSwipeOffsetX])

  const handleConversationPointerMove = useCallback((
    conversationId: string, event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const g = conversationSwipeStartRef.current
    if (!g || g.conversationId !== conversationId || g.pointerId !== event.pointerId) return
    if (g.longPressTriggered) return
    const dx = event.clientX - g.x; const dy = event.clientY - g.y
    if (Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX && !g.thresholdReached) { clearConversationGestureTimer(); g.longPressTimerId = null; return }
    if (dx > SWIPE_DELETE_TOGGLE_THRESHOLD_PX && !g.thresholdReached) { g.thresholdReached = true; clearConversationGestureTimer(); setSwipingConversationId(conversationId); ignoreNextConversationClickRef.current = conversationId }
    if (g.thresholdReached && dx > 0) setSwipeOffsetX(Math.min(dx, SWIPE_DELETE_MAX_OFFSET_PX))
  }, [clearConversationGestureTimer, setSwipingConversationId, setSwipeOffsetX])

  const handleConversationPointerUp = useCallback((
    conversationId: string, event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const g = conversationSwipeStartRef.current
    if (!g || g.conversationId !== conversationId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const dx = event.clientX - g.x
    clearConversationGestureTimer(); conversationSwipeStartRef.current = null
    if (g.thresholdReached && dx > SWIPE_DELETE_TOGGLE_THRESHOLD_PX) { setSwipingConversationId(null); setSwipeOffsetX(0); return }
    if (g.longPressTriggered) { ignoreNextConversationClickRef.current = conversationId; setSwipingConversationId(null); setSwipeOffsetX(0); return }
    setSwipingConversationId(null); setSwipeOffsetX(0)
  }, [clearConversationGestureTimer, setSwipingConversationId, setSwipeOffsetX])

  const handleConversationPointerCancel = useCallback((): void => { resetConversationSwipe() }, [resetConversationSwipe])

  const handleConversationClick = useCallback((conversationId: string): void => {
    if (ignoreNextConversationClickRef.current === conversationId) { ignoreNextConversationClickRef.current = null; return }
    switchConversation(conversationId)
  }, [switchConversation])

  const toggleConversationGroup = useCallback((groupId: string): void => {
    useUIStore.getState().toggleConversationGroup(groupId)
  }, [])

  // ── Effects ──
  const setCollapsedConversationGroups = useUIStore((s) => s.setCollapsedConversationGroups)

  useEffect(() => {
    if (!chatStateLoaded) return
    const nextState = buildPersistChatState(conversations, draftsByConversation, activeConversationId)
    const sig = getChatStatePersistenceSignature(nextState)
    if (sig === chatStateSignatureRef.current) return
    const taskId = conversationPersistTaskIdRef.current + 1
    conversationPersistTaskIdRef.current = taskId
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const persisted = await persistChatState(nextState)
          if (conversationPersistTaskIdRef.current !== taskId) return
          const withKeys = applyAssignedImageStorageKeys(conversations, persisted.assignedImageStorageKeys)
          chatStateSignatureRef.current = getChatStatePersistenceSignature(buildPersistChatState(withKeys, draftsByConversation, activeConversationId))
          if (withKeys !== conversations) startTransition(() => { setConversationsState(withKeys) })
        } catch { /* ignore */ }
      })()
    }, CHAT_STATE_PERSIST_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [chatStateLoaded, conversations, draftsByConversation, activeConversationId, setConversationsState])

  useEffect(() => {
    if (!chatStateLoaded) return
    const pending: Array<{ conversationId: string; messageId: string; imageId: string; storageKey: string; mimeType: string }> = []
    for (const c of conversations) {
      for (const e of c.transcript) {
        if (e.kind !== 'user_message') continue
        for (const p of e.content) {
          if (p.type !== 'image') continue
          const img = p.image
          if (!img.storageKey || img.dataUrl.trim().length > 0 || hydratingImageKeysRef.current.has(img.storageKey)) continue
          pending.push({ conversationId: c.id, messageId: e.id, imageId: img.id, storageKey: img.storageKey, mimeType: img.mimeType })
        }
      }
    }
    if (pending.length === 0) return
    let cancelled = false
    for (const item of pending) hydratingImageKeysRef.current.add(item.storageKey)
    void (async () => {
      try {
        const hydrated = await Promise.all(pending.map(async (item) => ({ ...item, dataUrl: await loadStoredAttachmentDataUrl(item.storageKey, item.mimeType) })))
        if (cancelled) return
        const resolved = hydrated.filter((item) => item.dataUrl !== null)
        if (resolved.length === 0) return
        startTransition(() => {
          setConversationsState((prev) => prev.map((c) => {
            const updates = resolved.filter((item) => item.conversationId === c.id)
            if (updates.length === 0) return c
            const updatedIds = new Set(updates.map((item) => item.messageId))
            const nextTranscript = c.transcript.map((e) => {
              if (e.kind !== 'user_message' || !updatedIds.has(e.id)) return e
              const msgUpdates = updates.filter((item) => item.messageId === e.id)
              if (msgUpdates.length === 0) return e
              const nextContent = e.content.map((part: any) => {
                if (part.type !== 'image') return part
                const update = msgUpdates.find((item: any) => item.imageId === part.image.id)
                return update ? { ...part, image: { ...part.image, dataUrl: update.dataUrl } } : part
              })
              return { ...e, content: nextContent }
            })
            return withConversationRecordTranscript(c, nextTranscript, draftsByConversationRef.current[c.id] ?? '')
          }))
        })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [chatStateLoaded, conversations, setConversationsState])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await loadChatIndex()
        if (cancelled) return
        const existingIds = new Set(useChatStore.getState().conversations.map((c) => c.id))
        const next = [...useChatStore.getState().conversations, ...loaded.conversations.filter((c) => !existingIds.has(c.id)).map((c) => createSummaryConversation(c))]
        const naid = activeConversationIdRef.current || next[0]?.id || ''
        chatStateSignatureRef.current = getChatStatePersistenceSignature(buildPersistChatState(next, draftsByConversationRef.current, naid))
        startTransition(() => {
          setConversationsState(next)
          setHistoryStats(loaded.historyStats)
          setChatStateLoadError(null)
          setChatStateLoaded(true)
        })
      } catch (err) {
        if (cancelled) return
        setChatStateLoadError(`聊天记录加载失败：${err instanceof Error ? err.message : '未知错误'}`)
      }
    })()
    return () => { cancelled = true }
  }, [setConversationsState, setHistoryStats, setChatStateLoadError, setChatStateLoaded])

  useEffect(() => {
    if (conversations.length === 0) {
      const fb = createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
      setConversationsState([fb]); setActiveConversationId(fb.id); return
    }
    if (!conversations.some((c) => c.id === activeConversationId)) setActiveConversationId(conversations[0].id)
  }, [conversations, activeConversationId, setConversationsState, setActiveConversationId])

  useEffect(() => {
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
    useUIStore.getState().setModelMenuVisibility(true, false)
  }, [activeConversationId, setPendingImages])

  useEffect(() => {
    if (drawerMounted) return
    const g = conversationSwipeStartRef.current
    if (g?.longPressTimerId !== null) window.clearTimeout(g!.longPressTimerId!)
    conversationSwipeStartRef.current = null
    setSwipingConversationId(null); setSwipeOffsetX(0)
    setDeleteModeEnabled2(false)
    useUIStore.getState().closeDeleteDialog()
  }, [drawerMounted, setSwipingConversationId, setSwipeOffsetX, setDeleteModeEnabled2])

  useEffect(() => {
    setCollapsedConversationGroups((prev) => {
      const next: Record<string, boolean> = {}
      for (const g of conversationGroups) next[g.id] = prev[g.id] ?? false
      if (Object.keys(next).length === Object.keys(prev).length && Object.keys(next).every((k) => next[k] === prev[k])) return prev
      return next
    })
  }, [conversationGroups, setCollapsedConversationGroups])

  useEffect(() => { hasAutoCollapsedConversationGroupsRef.current = false }, [settings.autoCollapseConversations])

  useLayoutEffect(() => {
    if (!drawerVisible || !settings.autoCollapseConversations || hasAutoCollapsedConversationGroupsRef.current) return
    const cl = conversationListRef.current
    if (!cl) return
    let sf = 0
    const ff = window.requestAnimationFrame(() => {
      sf = window.requestAnimationFrame(() => {
        const lr = cl.getBoundingClientRect()
        const nextCollapsed: Record<string, boolean> = {}
        for (const g of conversationGroups) {
          const ge = conversationGroupElementRefs.current[g.id]
          if (!ge) { nextCollapsed[g.id] = false; continue }
          const items = Array.from(ge.querySelectorAll<HTMLElement>('[data-conversation-item="true"]'))
          nextCollapsed[g.id] = !items.some((el) => { const r = el.getBoundingClientRect(); return r.top >= lr.top && r.bottom <= lr.bottom })
        }
        hasAutoCollapsedConversationGroupsRef.current = true
        setCollapsedConversationGroups((prev) => {
          const next: Record<string, boolean> = {}
          for (const g of conversationGroups) next[g.id] = nextCollapsed[g.id] ?? false
          return Object.keys(next).every((k) => next[k] === (prev[k] ?? false)) ? prev : next
        })
      })
    })
    return () => { window.cancelAnimationFrame(ff); if (sf) window.cancelAnimationFrame(sf) }
  }, [drawerVisible, settings.autoCollapseConversations, conversationGroups, setCollapsedConversationGroups])

  // ── Title editing ──
  const isEditingTitle = useUIStore((s) => s.isEditingTitle)
  const titleDraft = useUIStore((s) => s.titleDraft)
  const titleTransition = useUIStore((s) => s.titleTransition)
  const setTitleTransition = useUIStore((s) => s.setTitleTransition)
  const setTitleDraft = useUIStore((s) => s.setTitleDraft)
  const setIsEditingTitle = useUIStore((s) => s.setIsEditingTitle)
  const titleTransitionPrepRef = useRef<any>(null)
  const titleTransitionAnimationFrameRef = useRef<number | null>(null)
  const titleTransitionTimerRef = useRef<number | null>(null)

  const clearTitleTransitionTimers = useCallback((): void => {
    if (titleTransitionAnimationFrameRef.current !== null) { window.cancelAnimationFrame(titleTransitionAnimationFrameRef.current); titleTransitionAnimationFrameRef.current = null }
    if (titleTransitionTimerRef.current !== null) { window.clearTimeout(titleTransitionTimerRef.current); titleTransitionTimerRef.current = null }
  }, [])

  const stopRenameConversationImmediately = useCallback((): void => {
    titleTransitionPrepRef.current = null
    clearTitleTransitionTimers()
    setTitleTransition(null)
    setIsEditingTitle(false)
    setTitleDraft('')
  }, [clearTitleTransitionTimers, setTitleTransition, setIsEditingTitle, setTitleDraft])

  const beginRenameConversation = useCallback((): void => {
    if (!activeConversation || titleTransition || titleTransitionPrepRef.current) return
    setTitleDraft(activeConversation.title)
    setIsEditingTitle(true)
  }, [activeConversation, titleTransition, setTitleDraft, setIsEditingTitle])

  const cancelRenameConversation = useCallback((): void => {
    if (!isEditingTitle || titleTransition || titleTransitionPrepRef.current) return
    setIsEditingTitle(false); setTitleDraft('')
  }, [isEditingTitle, titleTransition, setIsEditingTitle, setTitleDraft])

  const saveRenameConversation = useCallback((): void => {
    if (!activeConversation || titleTransition || titleTransitionPrepRef.current) return
    const nextTitle = titleDraft.trim()
    if (!nextTitle) return
    updateConversationTitle(activeConversation.id, nextTitle, true)
    setIsEditingTitle(false); setTitleDraft('')
  }, [activeConversation, titleTransition, titleDraft, updateConversationTitle, setIsEditingTitle, setTitleDraft])

  const displayConversationTitle = activeConversation?.title ?? '新对话'
  const shouldShowTitleRenameButton = activeConversation !== null && !isHomepageEmptyState
  // ── Image management ──
  const removePendingImage = useCallback((imageId: string): void => {
    delete pendingImageCompressionTaskIdRef.current[imageId]
    setPendingImages((previous) => previous.filter((image) => image.id !== imageId))
  }, [setPendingImages])

  const updatePendingImageCompression = useCallback((imageId: string, compressionRate: number): void => {
    const normalizedRate = Math.max(0, Math.min(100, Math.round(compressionRate)))
    const currentPending = useChatStore.getState().pendingImages
    const target = currentPending.find((image) => image.id === imageId)
    if (!target) return

    setPendingImages((previous) =>
      previous.map((image) =>
        image.id === imageId ? { ...image, compressionRate: normalizedRate } : image,
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
      if (pendingImageCompressionTaskIdRef.current[imageId] !== taskId) return
      setPendingImages((previous) =>
        previous.map((image) =>
          image.id === imageId
            ? { ...image, dataUrl: compressed.dataUrl, mimeType: compressed.mimeType, size: compressed.size }
            : image,
        ),
      )
    })().catch((error) => {
      if (pendingImageCompressionTaskIdRef.current[imageId] !== taskId) return
      const message = error instanceof Error ? error.message : '图片压缩失败'
      pushNotice(message, 'error')
    })
  }, [setPendingImages, pushNotice])


  return {
    conversations, activeConversationId, activeConversation, activeConversationResponseMode,
    activeConversationModeLocked, activeMessages, hasActiveMessages,
    isHomepageEmptyState, chatStateLoaded, chatStateLoadError,
    draftsByConversation, draft, pendingImages,
    hasDraftText, hasComposerPayload, isComposerLocked, canSend, canAppendWhileSending,
    conversationGroups, conversationSummariesById, sortedConversations, visibleConversations,
    displayConversationTitle, shouldShowTitleRenameButton,
    chatSummarySnapshot, tokenSummary, rounds, emptyStateStats, homepageHighlightStats,
    effectiveHistoryStats, isRunningInActiveConversation, historyStats,
    setConversationsState,
    hydrateConversationById: hydrateConversationByIdImpl,
    updateConversationDraft, updateConversationTranscript, updateConversationResponseMode,
    appendConversationTranscriptEvents, updateAssistantEvent, updateConversationTitle,
    createNewConversation, switchConversation, deleteConversation: deleteConversation_,
    handleConversationPointerDown, handleConversationPointerMove,
    handleConversationPointerUp, handleConversationPointerCancel,
    handleConversationClick, toggleConversationGroup, toggleDeleteMode,
    beginRenameConversation, cancelRenameConversation, saveRenameConversation,
    stopRenameConversationImmediately,
    conversationListRef, conversationGroupElementRefs,
    removePendingImage,
    updatePendingImageCompression,
    pendingImageCompressionTaskIdRef,
  }
}
