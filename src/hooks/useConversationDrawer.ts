import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react'
import { useUIStore } from '../state/ui-store'
import { useChatStore } from '../state/chat-store'
import { useSettingsStore } from '../state/settings-store'
import { deleteConversationStorage } from '../services/chat-storage'
import { isTranscriptConversationWorkspacePlaceholder } from '../services/chat-transcript'
import { createConversation, vibrateInteraction } from '../utils/app-module'
import { clamp } from '../utils/app-formatting'
import { SWIPE_DELETE_TOGGLE_THRESHOLD_PX, SWIPE_DELETE_MAX_OFFSET_PX, LONG_PRESS_DELETE_MODE_MS, LONG_PRESS_MOVE_TOLERANCE_PX } from '../state/types'
import type { Conversation, ConversationDrafts, ConversationGroup } from '../state/types'

export interface UseConversationDrawerParams {
  conversationListRef: React.MutableRefObject<HTMLDivElement | null>
  conversationGroupElementRefs: React.MutableRefObject<Record<string, HTMLElement | null>>
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void
  closeDrawer: () => void
  closeModelMenu: () => void
  closeDeleteDialog: () => void
  openDeleteDialog: (dialog: any) => void
  cancelEdit: () => void
  stopRenameConversationImmediately: () => void
  openSettingsFromDrawer: () => void
  activeConversationId: string
  conversations: Conversation[]
  conversationGroups: ConversationGroup[]
  drawerVisible: boolean
  autoCollapseConversations: boolean
  hydrateConversationById: (id: string) => void
  deleteConfirmBypassUntilRef: React.MutableRefObject<number>
  pendingImageCompressionTaskIdRef: any
  setActiveConversationId: (id: string) => void
  setConversationsState: (nextState: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void
  setDraftsByConversation: (nextState: ConversationDrafts | ((prev: ConversationDrafts) => ConversationDrafts)) => void
  setPendingImages: (images: any[] | ((prev: any[]) => any[])) => void
  settings: { deleteModeHapticsEnabled: boolean; deleteConfirmGraceSeconds: number }
}

export interface UseConversationDrawerReturn {
  handleConversationPointerDown: (conversationId: string, event: PointerEvent<HTMLButtonElement>) => void
  handleConversationPointerMove: (conversationId: string, event: PointerEvent<HTMLButtonElement>) => void
  handleConversationPointerUp: (conversationId: string, event: PointerEvent<HTMLButtonElement>) => void
  handleConversationPointerCancel: () => void
  handleConversationClick: (conversationId: string) => void
  toggleConversationGroup: (groupId: string) => void
  toggleDeleteMode: () => void
  requestDeleteConversation: (conversationId: string) => void
  switchConversation: (conversationId: string) => void
  createNewConversation: () => void
  deleteConversation: (conversationId: string) => void
  extendDeleteConfirmGrace: () => void
}

export function useConversationDrawer(params: UseConversationDrawerParams): UseConversationDrawerReturn {
  const {
    conversationListRef, pushNotice, closeDrawer, closeModelMenu,
    closeDeleteDialog, openDeleteDialog, cancelEdit, stopRenameConversationImmediately,
    activeConversationId, conversations, conversationGroups, drawerVisible,
    autoCollapseConversations, hydrateConversationById, deleteConfirmBypassUntilRef,
    pendingImageCompressionTaskIdRef, setActiveConversationId, setConversationsState,
    setDraftsByConversation, setPendingImages, settings,
  } = params

  const swipingConversationId = useUIStore((s) => s.swipingConversationId)
  const setSwipingConversation = useUIStore((s) => s.setSwipingConversation)
  const setSwipeOffsetX = useUIStore((s) => s.setSwipeOffsetX)
  const setDeleteModeEnabled = useUIStore((s) => s.setDeleteModeEnabled)
  const hasAutoCollapsedConversationGroupsRef = useRef(false)

  const conversationSwipeStartRef = useRef<{
    conversationId: string; pointerId: number; x: number; y: number
    thresholdReached: boolean; longPressTriggered: boolean; longPressTimerId: number | null
  } | null>(null)
  const ignoreNextConversationClickRef = useRef<string | null>(null)

  const extendDeleteConfirmGrace = useCallback((): void => {
    const ms = Math.max(0, settings.deleteConfirmGraceSeconds) * 1000
    deleteConfirmBypassUntilRef.current = ms > 0 ? Date.now() + ms : 0
  }, [settings.deleteConfirmGraceSeconds, deleteConfirmBypassUntilRef])

  const clearConversationGestureTimer = useCallback((): void => {
    const gesture = conversationSwipeStartRef.current
    const id = gesture?.longPressTimerId ?? null
    if (id !== null && gesture) { window.clearTimeout(id); gesture.longPressTimerId = null }
  }, [])

  const resetConversationSwipe = useCallback((): void => {
    clearConversationGestureTimer()
    conversationSwipeStartRef.current = null
    setSwipingConversation(null)
    setSwipeOffsetX(0)
  }, [clearConversationGestureTimer, setSwipingConversation, setSwipeOffsetX])

  const toggleDeleteMode = useCallback((): void => {
    setDeleteModeEnabled((prev) => !prev)
  }, [setDeleteModeEnabled])

  const switchConversation = useCallback((conversationId: string): void => {
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
  }, [setActiveConversationId, hydrateConversationById, closeDrawer, closeModelMenu, setDeleteModeEnabled, closeDeleteDialog, pendingImageCompressionTaskIdRef, setPendingImages, cancelEdit, stopRenameConversationImmediately])

  const deleteConversation = useCallback((conversationId: string): void => {
    let deletedActive = false
    let nextId: string | null = null
    void deleteConversationStorage(conversationId).catch((e) => {
      pushNotice(`删除对话工作区失败：${e instanceof Error ? e.message : '删除对话工作区失败'}`, 'error')
    })
    const dlg = useUIStore.getState().deleteDialog
    if (dlg?.type === 'conversation' && dlg.targetId === conversationId) closeDeleteDialog()
    setDraftsByConversation((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, conversationId)) return prev
      const next = { ...prev }; delete next[conversationId]; return next
    })
    setConversationsState((prev) => {
      const exists = prev.some((c) => c.id === conversationId)
      if (!exists) return prev
      deletedActive = prev.some((c) => c.id === conversationId && c.id === activeConversationId)
      const remaining = prev.filter((c) => c.id !== conversationId)
      if (remaining.some((c) => c.id === activeConversationId)) return remaining
      const fallback = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0] ??
        createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
      nextId = fallback.id
      return remaining.length > 0 ? remaining : [fallback]
    })
    if (nextId) setActiveConversationId(nextId)
    if (deletedActive) {
      pendingImageCompressionTaskIdRef.current = {}
      setPendingImages([])
      cancelEdit()
      stopRenameConversationImmediately()
    }
    pushNotice('对话已删除。', 'success')
  }, [activeConversationId, closeDeleteDialog, cancelEdit, pushNotice, setActiveConversationId, setConversationsState, setDraftsByConversation, setPendingImages, pendingImageCompressionTaskIdRef, stopRenameConversationImmediately])

  const requestDeleteConversation = useCallback((conversationId: string): void => {
    const now = Date.now()
    if (now <= deleteConfirmBypassUntilRef.current) {
      extendDeleteConfirmGrace()
      deleteConversation(conversationId)
      return
    }
    openDeleteDialog({ type: 'conversation', targetId: conversationId })
  }, [deleteConversation, deleteConfirmBypassUntilRef, extendDeleteConfirmGrace, openDeleteDialog])

  const handleConversationPointerDown = useCallback((
    conversationId: string, event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    resetConversationSwipe()
    event.currentTarget.setPointerCapture(event.pointerId)
    const pointerId = event.pointerId
    const timerId = window.setTimeout(() => {
      const g = conversationSwipeStartRef.current
      if (!g || g.conversationId !== conversationId || g.pointerId !== pointerId) return
      g.longPressTriggered = true; g.thresholdReached = false
      clearConversationGestureTimer()
      ignoreNextConversationClickRef.current = conversationId
      setSwipingConversation(null); setSwipeOffsetX(0)
      if (settings.deleteModeHapticsEnabled) vibrateInteraction()
      toggleDeleteMode()
    }, LONG_PRESS_DELETE_MODE_MS)
    conversationSwipeStartRef.current = { conversationId, pointerId, x: event.clientX, y: event.clientY, thresholdReached: false, longPressTriggered: false, longPressTimerId: timerId }
  }, [resetConversationSwipe, clearConversationGestureTimer, setSwipingConversation, setSwipeOffsetX, settings.deleteModeHapticsEnabled, toggleDeleteMode])

  const handleConversationPointerMove = useCallback((
    conversationId: string, event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const s = conversationSwipeStartRef.current
    if (!s || s.conversationId !== conversationId || s.pointerId !== event.pointerId) return
    if (s.longPressTriggered) return
    const dx = event.clientX - s.x, dy = event.clientY - s.y
    if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE_PX || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX) clearConversationGestureTimer()
    if (!(Math.abs(dx) > Math.abs(dy) * 1.1)) { if (swipingConversationId === conversationId) setSwipeOffsetX(0); return }
    event.preventDefault()
    const offset = clamp(dx, -SWIPE_DELETE_MAX_OFFSET_PX, SWIPE_DELETE_MAX_OFFSET_PX)
    const reached = Math.abs(dx) >= SWIPE_DELETE_TOGGLE_THRESHOLD_PX
    if (settings.deleteModeHapticsEnabled && reached && !s.thresholdReached) vibrateInteraction()
    s.thresholdReached = reached
    setSwipingConversation(conversationId); setSwipeOffsetX(offset)
  }, [clearConversationGestureTimer, swipingConversationId, setSwipingConversation, setSwipeOffsetX, settings.deleteModeHapticsEnabled])

  const handleConversationPointerUp = useCallback((
    conversationId: string, event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const s = conversationSwipeStartRef.current
    if (!s || s.conversationId !== conversationId || s.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    clearConversationGestureTimer()
    if (s.longPressTriggered) { ignoreNextConversationClickRef.current = conversationId; resetConversationSwipe(); return }
    const dx = event.clientX - s.x, dy = event.clientY - s.y
    if (Math.abs(dx) >= SWIPE_DELETE_TOGGLE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.1) {
      ignoreNextConversationClickRef.current = conversationId; toggleDeleteMode()
    }
    resetConversationSwipe()
  }, [clearConversationGestureTimer, resetConversationSwipe, toggleDeleteMode])

  const handleConversationPointerCancel = useCallback((): void => { resetConversationSwipe() }, [resetConversationSwipe])

  const handleConversationClick = useCallback((conversationId: string): void => {
    if (ignoreNextConversationClickRef.current === conversationId) { ignoreNextConversationClickRef.current = null; return }
    switchConversation(conversationId)
  }, [switchConversation])

  const toggleConversationGroup = useCallback((groupId: string): void => {
    useUIStore.getState().toggleConversationGroup(groupId)
  }, [])

  const createNewConversation_ = useCallback((): void => {
    const draftsByConversation = useChatStore.getState().draftsByConversation
    const existing = conversations.find((c) =>
      c.storageLoadState === 'hydrated' && isTranscriptConversationWorkspacePlaceholder(c, draftsByConversation[c.id] ?? ''))
    const next = existing ?? createConversation([], useSettingsStore.getState().settings.defaultResponseMode)
    if (!existing) setConversationsState((prev) => [next, ...prev])
    setActiveConversationId(next.id)
    closeDrawer(); closeModelMenu(); setDeleteModeEnabled(false)
    pendingImageCompressionTaskIdRef.current = {}
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
  }, [conversations, closeDrawer, closeModelMenu, setDeleteModeEnabled, cancelEdit, pendingImageCompressionTaskIdRef, setActiveConversationId, setConversationsState, setPendingImages, stopRenameConversationImmediately])

  // drawer scroll restore
  const drawerScrollTopRef = useRef(0)
  useLayoutEffect(() => {
    if (!drawerVisible) return
    const list = conversationListRef.current
    if (!list) return
    list.scrollTop = drawerScrollTopRef.current
    const frameId = window.requestAnimationFrame(() => { list.scrollTop = drawerScrollTopRef.current })
    return () => window.cancelAnimationFrame(frameId)
  }, [drawerVisible, conversationListRef])

  // auto-collapse
  useEffect(() => {
    if (!autoCollapseConversations || conversationGroups.length <= 1) return
    const allGroupsHaveVisible = conversationGroups.every((g) => g.conversations.length > 0)
    if (allGroupsHaveVisible) {
      if (!hasAutoCollapsedConversationGroupsRef.current) {
        hasAutoCollapsedConversationGroupsRef.current = true
        conversationGroups.forEach((g) => { useUIStore.getState().setCollapsedConversationGroups((prev) => ({ ...prev, [g.id]: true })) })
      }
    } else {
      hasAutoCollapsedConversationGroupsRef.current = false
    }
  }, [autoCollapseConversations, conversationGroups])

  return {
    handleConversationPointerDown, handleConversationPointerMove, handleConversationPointerUp,
    handleConversationPointerCancel, handleConversationClick, toggleConversationGroup,
    toggleDeleteMode, requestDeleteConversation, switchConversation, createNewConversation: createNewConversation_,
    deleteConversation, extendDeleteConfirmGrace,
  }
}
