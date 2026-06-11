import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type UIEvent,
} from 'react'
import { useUIStore } from '../state/ui-store'
import type { ChatMessage, MessageListScrollMetrics } from '../state/types'
import {
  MESSAGE_LIST_AUTO_SCROLL_MAX_MS,
  MESSAGE_LIST_BOTTOM_THRESHOLD_PX,
  MESSAGE_LIST_INTERACTION_IDLE_MS,
  MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR,
  resolveMessageListSmoothScrollStep,
} from '../utils/app-module'

export interface UseMessageListScrollParams {
  // External refs (owned by App.tsx, used in JSX ref attributes)
  messageListRef: React.MutableRefObject<HTMLElement | null>
  chatContentStackRef: React.MutableRefObject<HTMLDivElement | null>
  chatHeaderRef: React.MutableRefObject<HTMLElement | null>
  chatSummaryBarRef: React.MutableRefObject<HTMLElement | null>
  composerFooterRef: React.MutableRefObject<HTMLElement | null>

  // Callbacks
  showScrollToBottomButton: (rAF: boolean) => void
  hideScrollToBottomButton: (rAF: boolean) => void

  // Data
  activeConversationId: string
  activeMessages: ChatMessage[]
  hasActiveMessages: boolean
  isSending: boolean
  pendingImagesLength: number
}

export interface UseMessageListScrollReturn {
  messageListRef: React.MutableRefObject<HTMLElement | null>
  chatContentStackRef: React.MutableRefObject<HTMLDivElement | null>
  onScroll: (event: UIEvent<HTMLElement>) => void
  onPointerDownCapture: () => void
  onPointerUpCapture: () => void
  onPointerCancelCapture: () => void
  onWheelCapture: () => void
  handleScrollToBottomButtonClick: () => void
  activeChatScrollInsets: { top: number; bottom: number }
  shouldShowScrollToBottomButton: boolean
}

export function useMessageListScroll(params: UseMessageListScrollParams): UseMessageListScrollReturn {
  const {
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
    pendingImagesLength,
  } = params

  // --- store selectors ---
  const messageListScrollMetrics = useUIStore((s) => s.messageListScrollMetrics)
  const setMessageListScrollMetrics = useUIStore((s) => s.setMessageListScrollMetrics)
  const activeChatScrollInsets = useUIStore((s) => s.activeChatScrollInsets)
  const setActiveChatScrollInsets = useUIStore((s) => s.setActiveChatScrollInsets)
  const isAutoFollowEnabled = useUIStore((s) => s.isAutoFollowEnabled)
  const setIsAutoFollowEnabled = useUIStore((s) => s.setIsAutoFollowEnabled)
  const setIsSending = useUIStore((s) => s.setIsSending)
  void setIsSending

  // --- internal refs ---
  const messageListInteractionTimerRef = useRef<number | null>(null)
  const messageListUserInteractingRef = useRef(false)
  const messageListProgrammaticScrollRef = useRef(false)
  const messageListProgrammaticScrollAnimationFrameRef = useRef<number | null>(null)
  const messageListSmoothScrollAnimationFrameRef = useRef<number | null>(null)
  const messageListSmoothScrollInProgressRef = useRef(false)
  const pendingMessageListBottomResetRef = useRef(true)

  // --- timer / scroll helpers ---
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
    ): MessageListScrollMetrics & { atBottom: boolean } => {
      const target = messageList ?? messageListRef.current
      if (!target) {
        return { bottomOffset: 0, viewportHeight: 0, atBottom: true }
      }
      const viewportHeight = Math.max(0, target.clientHeight)
      const bottomOffset = Math.max(0, target.scrollHeight - target.scrollTop - viewportHeight)
      return {
        bottomOffset,
        viewportHeight,
        atBottom: bottomOffset <= MESSAGE_LIST_BOTTOM_THRESHOLD_PX,
      }
    },
    [messageListRef],
  )

  const syncMessageListScrollMetrics = useCallback(
    (
      messageList?: HTMLElement | null,
    ): MessageListScrollMetrics & { atBottom: boolean } => {
      const next = getMessageListScrollMetrics(messageList)
      setMessageListScrollMetrics((previous) =>
        previous.bottomOffset === next.bottomOffset && previous.viewportHeight === next.viewportHeight
          ? previous
          : { bottomOffset: next.bottomOffset, viewportHeight: next.viewportHeight },
      )
      return next
    },
    [getMessageListScrollMetrics, setMessageListScrollMetrics],
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
    [clearProgrammaticMessageListScrollTracking, getMessageListScrollMetrics, syncMessageListScrollMetrics],
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
      messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'auto' })
      return
    }

    messageList.scrollTop = messageList.scrollHeight
  }, [cancelMessageListSmoothScroll, trackProgrammaticMessageListScroll, setMessageListScrollMetrics, messageListRef])

  const smoothScrollMessageListToBottom = useCallback(
    (
      options?: { enableAutoFollowOnComplete?: boolean },
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

        const targetScrollTop = Math.max(0, currentMessageList.scrollHeight - currentMessageList.clientHeight)
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
      setMessageListScrollMetrics,
      messageListRef,
      setIsAutoFollowEnabled,
    ],
  )

  // --- interaction ---
  const beginMessageListInteraction = useCallback((): void => {
    cancelMessageListSmoothScroll()
    clearProgrammaticMessageListScrollTracking()
    clearMessageListInteractionTimer()
    messageListUserInteractingRef.current = true
  }, [cancelMessageListSmoothScroll, clearMessageListInteractionTimer, clearProgrammaticMessageListScrollTracking])

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
  }, [clearMessageListInteractionTimer, isMessageListAtBottom, scrollMessageListToBottom, setIsAutoFollowEnabled])

  // --- event handlers ---
  const onScroll = useCallback(
    (event: UIEvent<HTMLElement>): void => {
      if (messageListProgrammaticScrollRef.current) {
        return
      }
      const metrics = syncMessageListScrollMetrics(event.currentTarget)
      beginMessageListInteraction()
      setIsAutoFollowEnabled((previous) => (previous === metrics.atBottom ? previous : metrics.atBottom))
      scheduleMessageListInteractionEnd()
    },
    [beginMessageListInteraction, scheduleMessageListInteractionEnd, syncMessageListScrollMetrics, setIsAutoFollowEnabled],
  )

  const onPointerDownCapture = useCallback((): void => {
    beginMessageListInteraction()
  }, [beginMessageListInteraction])

  const onPointerUpCapture = useCallback((): void => {
    scheduleMessageListInteractionEnd()
  }, [scheduleMessageListInteractionEnd])

  const onPointerCancelCapture = useCallback((): void => {
    scheduleMessageListInteractionEnd()
  }, [scheduleMessageListInteractionEnd])

  const onWheelCapture = useCallback((): void => {
    beginMessageListInteraction()
    scheduleMessageListInteractionEnd()
  }, [beginMessageListInteraction, scheduleMessageListInteractionEnd])

  const handleScrollToBottomButtonClick = useCallback((): void => {
    clearMessageListInteractionTimer()
    messageListUserInteractingRef.current = false
    smoothScrollMessageListToBottom({ enableAutoFollowOnComplete: true })
  }, [clearMessageListInteractionTimer, smoothScrollMessageListToBottom])

  // --- derived ---
  const shouldShowScrollToBottomButton =
    activeMessages.length > 0 &&
    messageListScrollMetrics.viewportHeight > 0 &&
    messageListScrollMetrics.bottomOffset >
      messageListScrollMetrics.viewportHeight * MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR

  // --- effects ---

  // Cleanup timers on unmount
  useEffect(
    () => () => { clearMessageListInteractionTimer() },
    [clearMessageListInteractionTimer],
  )
  useEffect(
    () => () => { clearProgrammaticMessageListScrollTracking() },
    [clearProgrammaticMessageListScrollTracking],
  )
  useEffect(
    () => () => { cancelMessageListSmoothScroll() },
    [cancelMessageListSmoothScroll],
  )

  // Reset scroll position when conversation changes
  useEffect(() => {
    pendingMessageListBottomResetRef.current = true
    clearMessageListInteractionTimer()
    clearProgrammaticMessageListScrollTracking()
    cancelMessageListSmoothScroll()
    messageListUserInteractingRef.current = false
    setMessageListScrollMetrics({ bottomOffset: 0, viewportHeight: 0 })
    setIsAutoFollowEnabled(true)
  }, [
    activeConversationId,
    cancelMessageListSmoothScroll,
    clearMessageListInteractionTimer,
    clearProgrammaticMessageListScrollTracking,
    setMessageListScrollMetrics,
    setIsAutoFollowEnabled,
  ])

  // Auto-scroll to bottom on messages change
  useLayoutEffect(() => {
    if (messageListUserInteractingRef.current) return
    if (messageListSmoothScrollInProgressRef.current) return

    if (pendingMessageListBottomResetRef.current) {
      scrollMessageListToBottom()
      pendingMessageListBottomResetRef.current = false
      return
    }

    if (!isAutoFollowEnabled) return

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

  // Sync scroll metrics on messages change
  useLayoutEffect(() => {
    if (messageListProgrammaticScrollRef.current) return
    syncMessageListScrollMetrics()
  }, [activeConversationId, activeMessages, isSending, syncMessageListScrollMetrics])

  // ResizeObserver for scroll insets
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
      if (!messageList || !chatContentStack || !chatHeader || !summaryBar || !footer) return

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
          : { top: nextTop, bottom: nextBottom },
      )
    }

    syncActiveChatScrollInsets()

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => { syncActiveChatScrollInsets() })

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
    pendingImagesLength,
    chatContentStackRef,
    chatHeaderRef,
    chatSummaryBarRef,
    composerFooterRef,
    messageListRef,
    setActiveChatScrollInsets,
  ])

  // Show/hide scroll-to-bottom button
  useEffect(() => {
    if (shouldShowScrollToBottomButton) {
      showScrollToBottomButton(true)
    } else {
      hideScrollToBottomButton(true)
    }
  }, [hideScrollToBottomButton, shouldShowScrollToBottomButton, showScrollToBottomButton])

  return {
    messageListRef,
    chatContentStackRef,
    onScroll,
    onPointerDownCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    onWheelCapture,
    handleScrollToBottomButtonClick,
    activeChatScrollInsets,
    shouldShowScrollToBottomButton,
  }
}
