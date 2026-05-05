import { create } from 'zustand'
import type {
  ChatStorageHistoryStats,
  ChatSummarySnapshot,
  Conversation,
  ConversationDrafts,
  PendingImageAttachment,
} from './types'
import { EMPTY_HISTORY_STATS } from './types'

interface ChatStore {
  // State
  conversations: Conversation[]
  activeConversationId: string
  draftsByConversation: ConversationDrafts
  historyStats: ChatStorageHistoryStats
  chatStateLoadError: string | null
  chatStateLoaded: boolean
  pendingImages: PendingImageAttachment[]
  abortController: AbortController | null
  chatSummarySnapshot: ChatSummarySnapshot | null

  // Derived
  activeConversation: Conversation | undefined

  // Actions
  setConversations: (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void
  setActiveConversationId: (id: string) => void
  setDraftsByConversation: (drafts: ConversationDrafts | ((prev: ConversationDrafts) => ConversationDrafts)) => void
  setConversationDraft: (conversationId: string, draft: string) => void
  setHistoryStats: (stats: ChatStorageHistoryStats) => void
  setChatStateLoadError: (error: string | null) => void
  setChatStateLoaded: (loaded: boolean) => void
  setPendingImages: (images: PendingImageAttachment[] | ((prev: PendingImageAttachment[]) => PendingImageAttachment[])) => void
  setAbortController: (controller: AbortController | null) => void
  setChatSummarySnapshot: (snapshot: ChatSummarySnapshot | null) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removePendingImage: (dataUrl: string) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: '',
  draftsByConversation: {},
  historyStats: EMPTY_HISTORY_STATS,
  chatStateLoadError: null,
  chatStateLoaded: false,
  pendingImages: [],
  abortController: null,
  chatSummarySnapshot: null,

  get activeConversation() {
    const { conversations, activeConversationId } = get()
    return conversations.find((c) => c.id === activeConversationId)
  },

  setConversations: (conversations) =>
    set((state) => ({
      conversations: typeof conversations === 'function' ? conversations(state.conversations) : conversations,
    })),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setDraftsByConversation: (drafts) =>
    set((state) => ({
      draftsByConversation: typeof drafts === 'function' ? drafts(state.draftsByConversation) : drafts,
    })),
  setConversationDraft: (conversationId, draft) =>
    set((state) => ({
      draftsByConversation: {
        ...state.draftsByConversation,
        [conversationId]: draft,
      },
    })),
  setHistoryStats: (stats) => set({ historyStats: stats }),
  setChatStateLoadError: (error) => set({ chatStateLoadError: error }),
  setChatStateLoaded: (loaded) => set({ chatStateLoaded: loaded }),
  setPendingImages: (images) =>
    set((state) => ({
      pendingImages: typeof images === 'function' ? images(state.pendingImages) : images,
    })),
  setAbortController: (controller) => set({ abortController: controller }),
  setChatSummarySnapshot: (snapshot) => set({ chatSummarySnapshot: snapshot }),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removePendingImage: (dataUrl) =>
    set((state) => ({
      pendingImages: state.pendingImages.filter((img) => img.originalDataUrl !== dataUrl),
    })),
}))
