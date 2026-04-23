import type {
  TranscriptConversation,
  TranscriptContentPart,
  TranscriptEvent,
  TranscriptImageAttachment,
  TranscriptTokenUsage,
} from '../chat-transcript'

export type ChatStorageTokenUsage = TranscriptTokenUsage
export type ChatStorageImageAttachment = TranscriptImageAttachment
export type ChatStorageContentPart = TranscriptContentPart
export type ChatStorageTranscriptEvent = TranscriptEvent

export interface ChatStorageConversation {
  id: string
  title: string
  titleManuallyEdited: boolean
  transcript: TranscriptConversation['transcript']
  createdAt: number
  updatedAt: number
}

export interface ChatStorageState {
  conversations: ChatStorageConversation[]
  activeConversationId: string
  draftsByConversation: Record<string, string>
}

export interface AssignedImageStorageKey {
  conversationId: string
  messageId: string
  imageId: string
  storageKey: string
}

export interface PersistChatStorageResult {
  assignedImageStorageKeys: AssignedImageStorageKey[]
  signature: string
}
