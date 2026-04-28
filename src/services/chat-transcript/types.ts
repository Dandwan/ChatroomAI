import type { AssistantFlowNode } from '../../utils/assistant-flow'

export type TranscriptRole = 'user' | 'assistant'

export interface TranscriptTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  reasoningTokens?: number
}

export interface TranscriptImageAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
  storageKey?: string
}

export interface TranscriptTextPart {
  type: 'text'
  text: string
}

export interface TranscriptImagePart {
  type: 'image'
  image: TranscriptImageAttachment
}

export type TranscriptContentPart = TranscriptTextPart | TranscriptImagePart

export interface UserMessageTranscriptEvent {
  kind: 'user_message'
  id: string
  turnId: string
  createdAt: number
  content: TranscriptContentPart[]
}

export interface AssistantMessageTranscriptEvent {
  kind: 'assistant_message'
  id: string
  turnId: string
  roundId?: string
  createdAt: number
  rawText: string
  assistantFlow?: AssistantFlowNode[]
  reasoning?: string
  model?: string
  usage?: TranscriptTokenUsage
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

export type HostMessageCategory =
  | 'read_result'
  | 'read_error'
  | 'run_result'
  | 'run_error'
  | 'skill_result'
  | 'skill_error'
  | 'tag_error'
  | 'protocol_retry'
  | 'missing_final'

export interface HostMessageTranscriptEvent {
  kind: 'host_message'
  id: string
  turnId: string
  roundId?: string
  createdAt: number
  category: HostMessageCategory
  payload: Record<string, unknown>
}

export type TranscriptEvent =
  | UserMessageTranscriptEvent
  | AssistantMessageTranscriptEvent
  | HostMessageTranscriptEvent

export interface TranscriptConversation {
  id: string
  title: string
  titleManuallyEdited: boolean
  transcript: TranscriptEvent[]
  createdAt: number
  updatedAt: number
}

export interface ProjectedConversationMessage {
  id: string
  turnId: string
  role: TranscriptRole
  text: string
  assistantFlow?: AssistantFlowNode[]
  images?: TranscriptImageAttachment[]
  reasoning?: string
  createdAt: number
  model?: string
  usage?: TranscriptTokenUsage
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

export interface TranscriptTurn {
  turnId: string
  userEvent: UserMessageTranscriptEvent
  assistantEvents: AssistantMessageTranscriptEvent[]
  hostMessages: HostMessageTranscriptEvent[]
}
