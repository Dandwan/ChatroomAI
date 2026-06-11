import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import { useUIStore } from '../state/ui-store'
import type { Conversation, PendingTitleTransition, TitleTransitionState } from '../state/types'
import {
  getTravelOffset,
  shiftRect,
  snapshotRect,
  TITLE_EDIT_TRANSITION_MS,
} from '../utils/app-module'

export interface UseTitleTransitionParams {
  // External refs (owned by App.tsx, used in JSX ref attributes)
  titleTextRef: React.MutableRefObject<HTMLSpanElement | null>
  titleRenameButtonRef: React.MutableRefObject<HTMLButtonElement | null>
  titleInputRef: React.MutableRefObject<HTMLInputElement | null>
  titleActionsRef: React.MutableRefObject<HTMLDivElement | null>

  // Data
  activeConversation: Conversation | null
  activeConversationId: string

  // Callbacks
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void
  updateConversationTitle: (conversationId: string, title: string, manual: boolean) => void
}

export interface UseTitleTransitionReturn {
  beginRenameConversation: () => void
  cancelRenameConversation: () => void
  saveRenameConversation: () => void
  stopRenameConversationImmediately: () => void
  isEditingTitle: boolean
  titleDraft: string
  titleTransition: TitleTransitionState | null
  setTitleDraft: (draft: string) => void
}

export function useTitleTransition(params: UseTitleTransitionParams): UseTitleTransitionReturn {
  const {
    titleTextRef,
    titleRenameButtonRef,
    titleInputRef,
    titleActionsRef,
    activeConversation,
    activeConversationId,
    pushNotice,
    updateConversationTitle,
  } = params

  // --- UI store selectors ---
  const isEditingTitle = useUIStore((s) => s.isEditingTitle)
  const titleDraft = useUIStore((s) => s.titleDraft)
  const titleTransition = useUIStore((s) => s.titleTransition)
  const setTitleTransition = useUIStore((s) => s.setTitleTransition)
  const setTitleDraft = useUIStore((s) => s.setTitleDraft)
  const setIsEditingTitle = useUIStore((s) => s.setIsEditingTitle)

  // --- internal refs ---
  const titleTransitionPrepRef = useRef<PendingTitleTransition | null>(null)
  const titleTransitionAnimationFrameRef = useRef<number | null>(null)
  const titleTransitionTimerRef = useRef<number | null>(null)

  // --- timer helpers ---
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
  }, [clearTitleTransitionTimers, setTitleTransition])

  const stopRenameConversationImmediately = useCallback((): void => {
    titleTransitionPrepRef.current = null
    clearTitleTransitionTimers()
    setTitleTransition(null)
    setIsEditingTitle(false)
    setTitleDraft('')
  }, [clearTitleTransitionTimers, setTitleTransition, setIsEditingTitle, setTitleDraft])

  const focusTitleInput = useCallback((): void => {
    const input = titleInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const selectionEnd = input.value.length
    input.setSelectionRange(selectionEnd, selectionEnd)
  }, [titleInputRef])

  // --- rename actions ---
  const beginRenameConversation = useCallback((): void => {
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
  }, [activeConversation, titleTransition, setTitleDraft, setIsEditingTitle, titleTextRef, titleRenameButtonRef])

  const cancelRenameConversation = useCallback((): void => {
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
  }, [isEditingTitle, titleTransition, activeConversation, titleDraft, setIsEditingTitle, setTitleDraft, titleInputRef, titleActionsRef])

  const saveRenameConversation = useCallback((): void => {
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
  }, [activeConversation, titleTransition, titleDraft, pushNotice, updateConversationTitle, setIsEditingTitle, setTitleDraft, titleInputRef, titleActionsRef])

  // --- effects ---

  // FLIP animation for title transition
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
  }, [isEditingTitle, activeConversation?.id, activeConversation?.title, playTitleTransition, titleInputRef, titleActionsRef, titleTextRef, titleRenameButtonRef])

  // Focus title input when entering edit mode
  useEffect(() => {
    if (!isEditingTitle || titleTransition || titleTransitionPrepRef.current) {
      return
    }
    focusTitleInput()
  }, [focusTitleInput, isEditingTitle, titleTransition, activeConversationId])

  // Cleanup timers on unmount
  useEffect(
    () => () => {
      clearTitleTransitionTimers()
    },
    [clearTitleTransitionTimers],
  )

  return {
    beginRenameConversation,
    cancelRenameConversation,
    saveRenameConversation,
    stopRenameConversationImmediately,
    isEditingTitle,
    titleDraft,
    titleTransition,
    setTitleDraft,
  }
}
