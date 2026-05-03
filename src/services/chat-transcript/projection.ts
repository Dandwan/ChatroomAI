import {
  assistantFlowToPlainText,
  type AssistantFlowNode,
} from '../../utils/assistant-flow'
import {
  normalizeSkillAgentProtocolResponse,
} from '../skills/protocol'
import type {
  ApiContentPart,
  ApiMessage,
} from '../chat-api'
import type {
  AssistantMessageTranscriptEvent,
  HostMessageTranscriptEvent,
  ProjectedConversationMessage,
  TranscriptContentPart,
  TranscriptConversation,
  TranscriptConversationPreferences,
  TranscriptConversationResponseMode,
  TranscriptEvent,
  TranscriptImageAttachment,
  TranscriptTurn,
  UserMessageTranscriptEvent,
} from './types'

interface LegacyMessageLike {
  id: string
  role: 'user' | 'assistant'
  text: string
  assistantFlow?: AssistantFlowNode[]
  images?: TranscriptImageAttachment[]
  reasoning?: string
  createdAt: number
  model?: string
  usage?: AssistantMessageTranscriptEvent['usage']
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

const sanitizeTitleText = (text: string): string =>
  text
    .replace(/[#[\]>*`_~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const normalizeConversationResponseMode = (
  value: unknown,
): TranscriptConversationResponseMode | undefined => {
  if (value === 'tool' || value === 'text') {
    return value
  }
  return undefined
}

const getUserMessageText = (content: TranscriptContentPart[]): string =>
  content
    .filter((part): part is Extract<TranscriptContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')

const getUserMessageImages = (content: TranscriptContentPart[]): TranscriptImageAttachment[] =>
  content
    .filter((part): part is Extract<TranscriptContentPart, { type: 'image' }> => part.type === 'image')
    .map((part) => part.image)

const buildFallbackAssistantFlow = (
  event: AssistantMessageTranscriptEvent,
): AssistantFlowNode[] | undefined => {
  const displayText = assistantEventToDisplayText(event)
  if (!displayText) {
    return undefined
  }
  return [
    {
      id: `${event.id}:text`,
      kind: 'text',
      roundId: event.roundId,
      text: displayText,
    },
  ]
}

const looksLikeSkillAgentProtocolText = (text: string): boolean =>
  /<\/?(progress|final)>/i.test(text)

const buildConversationPreferences = (
  responseMode: unknown,
): TranscriptConversationPreferences | undefined => {
  const normalizedResponseMode = normalizeConversationResponseMode(responseMode)
  return normalizedResponseMode
    ? {
        responseMode: normalizedResponseMode,
      }
    : undefined
}

const hasAssistantToolArtifacts = (event: AssistantMessageTranscriptEvent): boolean =>
  looksLikeSkillAgentProtocolText(event.rawText) ||
  (event.assistantFlow?.some((node) => node.kind === 'skill') ?? false)

export const inferConversationResponseModeFromTranscript = (
  transcript: TranscriptEvent[],
): TranscriptConversationResponseMode | undefined => {
  let hasPlainAssistantOutput = false

  for (const event of transcript) {
    if (event.kind === 'user_message') {
      continue
    }

    if (event.kind === 'host_message') {
      return 'tool'
    }

    if (hasAssistantToolArtifacts(event)) {
      return 'tool'
    }

    if (event.rawText.trim() || (event.assistantFlow?.length ?? 0) > 0) {
      hasPlainAssistantOutput = true
    }
  }

  if (hasPlainAssistantOutput) {
    return 'text'
  }

  return undefined
}

const groupTranscriptTurns = (transcript: TranscriptEvent[]): TranscriptTurn[] => {
  const turns: TranscriptTurn[] = []
  const turnById = new Map<string, TranscriptTurn>()

  for (const event of transcript) {
    if (event.kind === 'user_message') {
      const turn: TranscriptTurn = {
        turnId: event.turnId,
        userEvent: event,
        assistantEvents: [],
        hostMessages: [],
      }
      turns.push(turn)
      turnById.set(event.turnId, turn)
      continue
    }

    const turn = turnById.get(event.turnId)
    if (!turn) {
      continue
    }

    if (event.kind === 'assistant_message') {
      turn.assistantEvents.push(event)
      continue
    }

    turn.hostMessages.push(event)
  }

  return turns
}

const projectAssistantTurnMessage = (turn: TranscriptTurn): ProjectedConversationMessage | null => {
  if (turn.assistantEvents.length === 0) {
    return null
  }

  const firstAssistant = turn.assistantEvents[0]
  const lastAssistant = turn.assistantEvents[turn.assistantEvents.length - 1]
  const mergedFlow = turn.assistantEvents.flatMap(
    (event) => event.assistantFlow ?? buildFallbackAssistantFlow(event) ?? [],
  )
  const mergedReasoning = turn.assistantEvents
    .map((event) => event.reasoning?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')

  return {
    id: `assistant-turn:${turn.turnId}`,
    turnId: turn.turnId,
    role: 'assistant',
    text:
      mergedFlow.length > 0
        ? assistantFlowToPlainText(mergedFlow)
        : turn.assistantEvents.map((event) => assistantEventToDisplayText(event)).filter(Boolean).join('\n\n'),
    assistantFlow: mergedFlow.length > 0 ? mergedFlow : undefined,
    reasoning: mergedReasoning || undefined,
    createdAt: firstAssistant.createdAt,
    model: lastAssistant.model,
    usage: lastAssistant.usage,
    usageEstimated: lastAssistant.usageEstimated,
    firstTokenLatencyMs: lastAssistant.firstTokenLatencyMs,
    totalTimeMs: lastAssistant.totalTimeMs,
    error: lastAssistant.error,
  }
}

export const assistantEventToDisplayText = (event: AssistantMessageTranscriptEvent): string => {
  const normalized = event.rawText.trim()
  if (!normalized) {
    return ''
  }

  if (!looksLikeSkillAgentProtocolText(normalized)) {
    return normalized
  }

  const outcome = normalizeSkillAgentProtocolResponse(normalized)
  if (outcome.kind === 'progress' || outcome.kind === 'retry') {
    return outcome.displayText.trim()
  }
  return outcome.finalText.trim()
}

export const buildUserMessageApiContent = (
  content: TranscriptContentPart[],
): string | ApiContentPart[] => {
  const parts: ApiContentPart[] = []

  for (const part of content) {
    if (part.type === 'text') {
      if (part.text.trim()) {
        parts.push({
          type: 'text',
          text: part.text,
        })
      }
      continue
    }

    if (part.image.dataUrl.trim()) {
      parts.push({
        type: 'image_url',
        image_url: {
          url: part.image.dataUrl,
        },
      })
    }
  }

  if (parts.length === 0) {
    return ''
  }

  if (parts.length === 1 && parts[0].type === 'text') {
    return parts[0].text
  }

  return parts
}

export const buildHostMessagePromptText = (event: HostMessageTranscriptEvent): string =>
  [
    '<host_message>',
    JSON.stringify(
      {
        category: event.category,
        roundId: event.roundId,
        payload: event.payload,
      },
      null,
      2,
    ),
    '</host_message>',
  ].join('\n')

export const buildApiMessagesFromTranscript = (
  transcript: TranscriptEvent[],
  systemPrompt: string,
): ApiMessage[] => {
  const payload: ApiMessage[] = []

  if (systemPrompt.trim()) {
    payload.push({
      role: 'system',
      content: systemPrompt.trim(),
    })
  }

  for (const event of transcript) {
    if (event.kind === 'user_message') {
      payload.push({
        role: 'user',
        content: buildUserMessageApiContent(event.content),
      })
      continue
    }

    if (event.kind === 'assistant_message') {
      const normalized = event.rawText.trim()
      const assistantContent =
        normalized && looksLikeSkillAgentProtocolText(normalized)
        ? (() => {
            const outcome = normalizeSkillAgentProtocolResponse(normalized)
            return outcome.kind === 'progress' || outcome.kind === 'final'
              ? outcome.normalizedEnvelope
              : normalized
          })()
        : normalized
      if (!assistantContent.trim()) {
        continue
      }
      payload.push({
        role: 'assistant',
        content: assistantContent,
      })
      continue
    }

    payload.push({
      role: 'user',
      content: buildHostMessagePromptText(event),
    })
  }

  return payload
}

export const projectConversationMessages = (
  conversation: Pick<TranscriptConversation, 'transcript'>,
): ProjectedConversationMessage[] => {
  const messages: ProjectedConversationMessage[] = []

  for (const turn of groupTranscriptTurns(conversation.transcript)) {
    const userText = getUserMessageText(turn.userEvent.content)
    const userImages = getUserMessageImages(turn.userEvent.content)
    messages.push({
      id: turn.userEvent.id,
      turnId: turn.turnId,
      role: 'user',
      text: userText,
      images: userImages.length > 0 ? userImages : undefined,
      createdAt: turn.userEvent.createdAt,
    })

    const assistantMessage = projectAssistantTurnMessage(turn)
    if (assistantMessage) {
      messages.push(assistantMessage)
    }
  }

  return messages
}

export const deriveConversationTitleFromTranscript = (
  transcript: TranscriptEvent[],
): string | undefined => {
  const firstUser = transcript.find((event): event is UserMessageTranscriptEvent => event.kind === 'user_message')
  const hasFirstRound = transcript.some(
    (event) => event.kind === 'assistant_message' && assistantEventToDisplayText(event).length > 0 && !event.error,
  )

  if (!firstUser || !hasFirstRound) {
    return undefined
  }

  const textCandidate = sanitizeTitleText(getUserMessageText(firstUser.content))
  let candidate = textCandidate
  if (!candidate && getUserMessageImages(firstUser.content).length > 0) {
    candidate = '图片对话'
  }
  if (!candidate) {
    return undefined
  }
  return candidate.length > 20 ? `${candidate.slice(0, 20)}…` : candidate
}

export const inferConversationCreatedAtFromTranscript = (transcript: TranscriptEvent[]): number => {
  const firstUser = transcript.find((event): event is UserMessageTranscriptEvent => event.kind === 'user_message')
  return firstUser?.createdAt ?? transcript[0]?.createdAt ?? Date.now()
}

export const isTranscriptConversationPlaceholder = (
  conversation: Pick<TranscriptConversation, 'transcript'>,
): boolean => conversation.transcript.length === 0

export const isTranscriptConversationWorkspacePlaceholder = (
  conversation: Pick<TranscriptConversation, 'transcript' | 'titleManuallyEdited'>,
  draftText = '',
): boolean =>
  conversation.transcript.length === 0 &&
  !conversation.titleManuallyEdited &&
  draftText.trim().length === 0

export const withConversationTranscript = (
  conversation: TranscriptConversation,
  transcript: TranscriptEvent[],
  options?: {
    keepUpdatedAt?: boolean
  },
): TranscriptConversation => {
  const nextTitle = conversation.titleManuallyEdited
    ? conversation.title
    : deriveConversationTitleFromTranscript(transcript) ?? '新对话'
  const nextCreatedAt =
    isTranscriptConversationPlaceholder(conversation) && transcript.length > 0
      ? inferConversationCreatedAtFromTranscript(transcript)
      : conversation.createdAt > 0 || transcript.length === 0
        ? conversation.createdAt
        : inferConversationCreatedAtFromTranscript(transcript)

  return {
    ...conversation,
    title: nextTitle,
    transcript,
    createdAt: nextCreatedAt,
    updatedAt:
      nextCreatedAt <= 0
        ? 0
        : options?.keepUpdatedAt
          ? Math.max(conversation.updatedAt, nextCreatedAt)
          : Date.now(),
  }
}

export const withConversationResponseMode = (
  conversation: TranscriptConversation,
  responseMode: TranscriptConversationResponseMode,
  options?: {
    keepUpdatedAt?: boolean
  },
): TranscriptConversation => {
  const nextPreferences = buildConversationPreferences(responseMode)
  if (conversation.preferences?.responseMode === nextPreferences?.responseMode) {
    return conversation
  }

  return {
    ...conversation,
    preferences: nextPreferences,
    updatedAt: options?.keepUpdatedAt ? conversation.updatedAt : Date.now(),
  }
}

export const createConversationFromTranscript = (
  id: string,
  transcript: TranscriptEvent[] = [],
  options?: {
    preferences?: TranscriptConversationPreferences
  },
): TranscriptConversation => {
  const createdAt = transcript.length > 0 ? inferConversationCreatedAtFromTranscript(transcript) : 0
  const updatedAt =
    transcript.length > 0
      ? Math.max(transcript[transcript.length - 1]?.createdAt ?? createdAt, createdAt)
      : 0

  return {
    id,
    title: deriveConversationTitleFromTranscript(transcript) ?? '新对话',
    titleManuallyEdited: false,
    transcript,
    preferences: buildConversationPreferences(options?.preferences?.responseMode),
    createdAt,
    updatedAt,
  }
}

export const createUserMessageTranscriptEvent = (
  id: string,
  createdAt: number,
  content: TranscriptContentPart[],
): UserMessageTranscriptEvent => ({
  kind: 'user_message',
  id,
  turnId: id,
  createdAt,
  content,
})

export const transcriptFromLegacyMessages = (messages: LegacyMessageLike[]): TranscriptEvent[] => {
  const transcript: TranscriptEvent[] = []
  let currentTurnId = ''

  for (const message of messages) {
    if (message.role === 'user') {
      currentTurnId = message.id
      transcript.push({
        kind: 'user_message',
        id: message.id,
        turnId: currentTurnId,
        createdAt: message.createdAt,
        content: [
          ...(message.text ? ([{ type: 'text', text: message.text }] as const) : []),
          ...((message.images ?? []).map((image) => ({
            type: 'image' as const,
            image,
          })) ?? []),
        ],
      })
      continue
    }

    if (!currentTurnId) {
      currentTurnId = `legacy-turn:${message.id}`
    }

    transcript.push({
      kind: 'assistant_message',
      id: message.id,
      turnId: currentTurnId,
      createdAt: message.createdAt,
      rawText: message.text,
      assistantFlow: message.assistantFlow,
      reasoning: message.reasoning,
      model: message.model,
      usage: message.usage,
      usageEstimated: message.usageEstimated,
      firstTokenLatencyMs: message.firstTokenLatencyMs,
      totalTimeMs: message.totalTimeMs,
      error: message.error,
    })
  }

  return transcript
}
