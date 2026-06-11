import type { TranscriptConversation } from '../chat-transcript'

export type { TranscriptTokenUsage as ChatStorageTokenUsage } from '../chat-transcript'
export type { TranscriptImageAttachment as ChatStorageImageAttachment } from '../chat-transcript'
export type { TranscriptContentPart as ChatStorageContentPart } from '../chat-transcript'
export type { TranscriptEvent as ChatStorageTranscriptEvent } from '../chat-transcript'

export interface ChatStorageConversation {
  id: string
  title: string
  titleManuallyEdited: boolean
  transcript: TranscriptConversation['transcript']
  preferences?: TranscriptConversation['preferences']
  createdAt: number
  updatedAt: number
}

export interface ChatStorageConversationSummary {
  id: string
  title: string
  titleManuallyEdited: boolean
  createdAt: number
  updatedAt: number
  preferences?: TranscriptConversation['preferences']
  messageCount: number
  userMessageCount: number
  fileCount: number
  imageCount: number
  assistantTokenCount: number
  toolCallCount: number
  draftTextLength: number
  draftAttachmentCount: number
  lastMessagePreview: string
  lastMessageRole?: 'user' | 'assistant'
}

export interface ChatStorageHistoryStats {
  totalConversationCount: number
  totalMessageCount: number
  totalPhotoCount: number
  totalTokenCount: number
  totalToolCallCount: number
}

export interface ChatStorageState {
  conversations: ChatStorageConversation[]
  activeConversationId: string
  draftsByConversation: Record<string, string>
}

export interface ChatStorageIndexState {
  conversations: ChatStorageConversationSummary[]
  activeConversationId: string
  historyStats: ChatStorageHistoryStats
}

export interface LoadedChatStorageConversation {
  conversation: ChatStorageConversation
  draftText: string
}

export type ChatStoragePersistConversation =
  | {
      kind: 'hydrated'
      conversation: ChatStorageConversation
      draftText: string
    }
  | {
      kind: 'summary'
      summary: ChatStorageConversationSummary
    }

export interface ChatStoragePersistState {
  conversations: ChatStoragePersistConversation[]
  activeConversationId: string
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