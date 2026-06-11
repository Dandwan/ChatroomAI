import {
  useCallback,
  useEffect,
  useRef,
} from 'react'
import {
  appendAssistantFlowContent,
  appendAssistantFlowDivider,
  assistantFlowToPlainText,
  clearAssistantFlowRound,
  type AssistantFlowNode,
} from '../utils/assistant-flow'
import {
  DEBUG_SKILL_ROUND_LOG_STORAGE_KEY,
  DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY,
  truncateDebugLogText,
  appendDebugLogEntry,
} from '../utils/app-debug'
import { createId } from '../utils/app-formatting'
import type { AssistantMessageTranscriptEvent } from '../services/chat-transcript'

export interface UseAssistantStreamParams {
  updateAssistantEvent: (
    conversationId: string,
    assistantId: string,
    updater: (event: AssistantMessageTranscriptEvent) => AssistantMessageTranscriptEvent,
  ) => void
}

export interface UseAssistantStreamReturn {
  appendSkillRoundLog: (payload: Record<string, unknown>, dedupeKey?: string) => void
  appendObjectFlowLog: (payload: Record<string, unknown>, dedupeKey?: string) => void
  appendAssistantFlowRoundDivider: (
    conversationId: string,
    assistantId: string,
    roundId: string,
    explanation?: string,
  ) => void
  clearAssistantFlowRoundState: (
    conversationId: string,
    assistantId: string,
    roundId: string,
  ) => void
  updateAssistantFlow: (
    conversationId: string,
    assistantId: string,
    updater: (
      flow: AssistantFlowNode[] | undefined,
      event: AssistantMessageTranscriptEvent,
    ) => AssistantFlowNode[] | undefined,
  ) => void
  applyAssistantStreamDelta: (
    conversationId: string,
    assistantId: string,
    delta: { content?: string; reasoning?: string; roundId?: string },
  ) => void
  flushQueuedAssistantStreamDelta: () => void
  appendAssistantStreamDelta: (
    conversationId: string,
    assistantId: string,
    delta: { content?: string; reasoning?: string; roundId?: string },
  ) => void
  resetAssistantStreamOutput: (conversationId: string, assistantId: string) => void
}

export function useAssistantStream(params: UseAssistantStreamParams): UseAssistantStreamReturn {
  const { updateAssistantEvent } = params

  // --- refs ---
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

  // --- debug log helpers ---
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

  // --- flow state ---
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

  const appendAssistantFlowRoundDivider = useCallback(
    (
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
    },
    [appendObjectFlowLog, updateAssistantFlow],
  )

  const clearAssistantFlowRoundState = useCallback(
    (
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
    },
    [appendObjectFlowLog, updateAssistantFlow],
  )

  // --- stream delta ---
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

  // cleanup on unmount
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

  const appendAssistantStreamDelta = useCallback(
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
    },
    [applyAssistantStreamDelta, flushQueuedAssistantStreamDelta],
  )

  const resetAssistantStreamOutput = useCallback(
    (conversationId: string, assistantId: string): void => {
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
    },
    [flushQueuedAssistantStreamDelta, updateAssistantEvent],
  )

  return {
    appendSkillRoundLog,
    appendObjectFlowLog,
    appendAssistantFlowRoundDivider,
    clearAssistantFlowRoundState,
    updateAssistantFlow,
    applyAssistantStreamDelta,
    flushQueuedAssistantStreamDelta,
    appendAssistantStreamDelta,
    resetAssistantStreamOutput,
  }
}
