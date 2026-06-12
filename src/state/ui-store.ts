import { create } from 'zustand'
import type {
  DeleteDialogState,
  HomepageSendTransitionState,
  ImageViewerState,
  MessageListScrollMetrics,
  Notice,
  PendingTitleTransition,
  PromptEditorKey,
  SettingsView,
  TagPromptEditorKey,
  TitleTransitionState,
} from './types'

interface UIStore {
  // ── Animated visibility ──
  settingsMounted: boolean
  settingsVisible: boolean
  drawerMounted: boolean
  drawerVisible: boolean
  modelMenuMounted: boolean
  modelMenuVisible: boolean
  imageViewerMounted: boolean
  imageViewerVisible: boolean
  scrollToBottomButtonMounted: boolean
  scrollToBottomButtonVisible: boolean

  // ── Delete dialog (unified) ──
  deleteDialog: DeleteDialogState | null
  deleteModeEnabled: boolean
  deleteConfirmBypassUntil: number

  // ── Editing ──
  editingMessageId: string | null
  editingText: string
  isEditingTitle: boolean
  titleDraft: string
  titleTransition: TitleTransitionState | null
  titleTransitionPrep: PendingTitleTransition | null
  titleTransitionAnimationFrame: number | null
  titleTransitionTimer: number | null

  // ── Image viewer ──
  imageViewer: ImageViewerState | null

  // ── Reasoning & skill results ──
  openReasoningByMessage: Record<string, boolean>
  openSkillResultByStep: Record<string, boolean>

  // ── Notice ──
  notice: Notice | null

  // ── Sending ──
  isSending: boolean
  activeRequestConversationId: string | null

  // ── Drawer ──
  collapsedConversationGroups: Record<string, boolean>
  swipingConversationId: string | null
  swipeOffsetX: number

  // ── Scroll ──
  isAutoFollowEnabled: boolean
  messageListScrollMetrics: MessageListScrollMetrics
  activeChatScrollInsets: { top: number; bottom: number }

  // ── Settings navigation ──
  settingsView: SettingsView
  providerDetailTargetId: string | null
  manualModelDraft: string
  providerModelSearch: string
  isFetchingModelsByProviderId: Record<string, boolean>

  // ── Prompt editors ──
  openPromptEditors: Record<TagPromptEditorKey, boolean>
  openProviderPromptEditors: Record<PromptEditorKey, boolean>

  // ── Permissions ──
  requestingPermissionByKey: Record<string, boolean>

  // ── Homepage transition ──
  homepageSendTransition: HomepageSendTransitionState | null

  // ── Actions ──
  setSettingsVisibility: (mounted: boolean, visible: boolean) => void
  setDrawerVisibility: (mounted: boolean, visible: boolean) => void
  setModelMenuVisibility: (mounted: boolean, visible: boolean) => void
  setImageViewerVisibility: (mounted: boolean, visible: boolean) => void
  setScrollToBottomButtonVisibility: (mounted: boolean, visible: boolean) => void
  openDeleteDialog: (dialog: DeleteDialogState) => void
  closeDeleteDialog: () => void
  extendDeleteConfirmGrace: (bypassUntil: number) => void
  setDeleteModeEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
  setEditingMessage: (messageId: string | null, text?: string) => void
  setEditingText: (text: string) => void
  setIsEditingTitle: (editing: boolean) => void
  setTitleDraft: (draft: string) => void
  setTitleTransition: (transition: TitleTransitionState | null | ((prev: TitleTransitionState | null) => TitleTransitionState | null)) => void
  setTitleTransitionPrep: (prep: PendingTitleTransition | null) => void
  setTitleTransitionAnimationFrame: (frame: number | null) => void
  setTitleTransitionTimer: (timer: number | null) => void
  setImageViewer: (viewer: ImageViewerState | null) => void
  toggleReasoning: (messageId: string) => void
  toggleSkillResult: (stepId: string) => void
  setNotice: (notice: Notice | null) => void
  setIsSending: (sending: boolean) => void
  setActiveRequestConversationId: (id: string | null) => void
  toggleConversationGroup: (groupId: string) => void
  setCollapsedConversationGroups: (groups: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  setSwipingConversation: (id: string | null) => void
  setSwipeOffsetX: (offset: number) => void
  setIsAutoFollowEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
  setMessageListScrollMetrics: (metrics: MessageListScrollMetrics | ((prev: MessageListScrollMetrics) => MessageListScrollMetrics)) => void
  setActiveChatScrollInsets: (insets: { top: number; bottom: number } | ((prev: { top: number; bottom: number }) => { top: number; bottom: number })) => void
  navigateSettingsView: (view: SettingsView) => void
  setProviderDetailTargetId: (id: string | null) => void
  setManualModelDraft: (draft: string) => void
  setProviderModelSearch: (search: string) => void
  setFetchingModelsForProvider: (providerId: string, fetching: boolean) => void
  setIsFetchingModelsByProviderId: (updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  togglePromptEditor: (key: TagPromptEditorKey) => void
  toggleProviderPromptEditor: (key: PromptEditorKey) => void
  setOpenProviderPromptEditors: (editors: Record<PromptEditorKey, boolean>) => void
  setRequestingPermission: (key: string, requesting: boolean) => void
  setRequestingPermissionByKey: (updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  setHomepageSendTransition: (transition: HomepageSendTransitionState | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  // ── Animated visibility ──
  settingsMounted: false,
  settingsVisible: false,
  drawerMounted: false,
  drawerVisible: false,
  modelMenuMounted: false,
  modelMenuVisible: false,
  imageViewerMounted: false,
  imageViewerVisible: false,
  scrollToBottomButtonMounted: false,
  scrollToBottomButtonVisible: false,

  // ── Delete dialog ──
  deleteDialog: null,
  deleteModeEnabled: false,
  deleteConfirmBypassUntil: 0,

  // ── Editing ──
  editingMessageId: null,
  editingText: '',
  isEditingTitle: false,
  titleDraft: '',
  titleTransition: null,
  titleTransitionPrep: null,
  titleTransitionAnimationFrame: null,
  titleTransitionTimer: null,

  // ── Image viewer ──
  imageViewer: null,

  // ── Reasoning & skill results ──
  openReasoningByMessage: {},
  openSkillResultByStep: {},

  // ── Notice ──
  notice: null,

  // ── Sending ──
  isSending: false,
  activeRequestConversationId: null,

  // ── Drawer ──
  collapsedConversationGroups: {},
  swipingConversationId: null,
  swipeOffsetX: 0,

  // ── Scroll ──
  isAutoFollowEnabled: true,
  messageListScrollMetrics: {
    bottomOffset: 0,
    viewportHeight: 0,
  },
  activeChatScrollInsets: { top: 0, bottom: 0 },

  // ── Settings navigation ──
  settingsView: 'main',
  providerDetailTargetId: null,
  manualModelDraft: '',
  providerModelSearch: '',
  isFetchingModelsByProviderId: {},

  // ── Prompt editors ──
  openPromptEditors: {
    systemPrompt: false,
    topLevelTagSystemPrompt: false,
    generalTagSystemPrompt: false,
    readSystemPrompt: false,
    skillCallSystemPrompt: false,
    editSystemPrompt: false,
    deprecatedTagPrompts: false,
  },
  openProviderPromptEditors: {
    systemPrompt: false,
    topLevelTagSystemPrompt: false,
    generalTagSystemPrompt: false,
    readSystemPrompt: false,
    skillCallSystemPrompt: false,
    editSystemPrompt: false,
  },

  // ── Permissions ──
  requestingPermissionByKey: {},

  // ── Homepage transition ──
  homepageSendTransition: null,

  // ── Actions ──
  setSettingsVisibility: (mounted, visible) => set({ settingsMounted: mounted, settingsVisible: visible }),
  setDrawerVisibility: (mounted, visible) => set({ drawerMounted: mounted, drawerVisible: visible }),
  setModelMenuVisibility: (mounted, visible) => set({ modelMenuMounted: mounted, modelMenuVisible: visible }),
  setImageViewerVisibility: (mounted, visible) => set({ imageViewerMounted: mounted, imageViewerVisible: visible }),
  setScrollToBottomButtonVisibility: (mounted, visible) => set({ scrollToBottomButtonMounted: mounted, scrollToBottomButtonVisible: visible }),

  openDeleteDialog: (dialog) => set({ deleteDialog: dialog }),
  closeDeleteDialog: () => set({ deleteDialog: null }),
  extendDeleteConfirmGrace: (bypassUntil) => set({ deleteConfirmBypassUntil: bypassUntil }),
  setDeleteModeEnabled: (enabled) =>
    set((state) => ({
      deleteModeEnabled: typeof enabled === 'function' ? enabled(state.deleteModeEnabled) : enabled,
    })),

  setEditingMessage: (messageId, text) => set({ editingMessageId: messageId, editingText: text ?? '' }),
  setEditingText: (text) => set({ editingText: text }),
  setIsEditingTitle: (editing) => set({ isEditingTitle: editing }),
  setTitleDraft: (draft) => set({ titleDraft: draft }),
  setTitleTransition: (transition) =>
    set((state) => ({
      titleTransition: typeof transition === 'function' ? transition(state.titleTransition) : transition,
    })),
  setTitleTransitionPrep: (prep) => set({ titleTransitionPrep: prep }),
  setTitleTransitionAnimationFrame: (frame) => set({ titleTransitionAnimationFrame: frame }),
  setTitleTransitionTimer: (timer) => set({ titleTransitionTimer: timer }),

  setImageViewer: (viewer) => set({ imageViewer: viewer }),

  toggleReasoning: (messageId) =>
    set((state) => ({
      openReasoningByMessage: {
        ...state.openReasoningByMessage,
        [messageId]: !state.openReasoningByMessage[messageId],
      },
    })),
  toggleSkillResult: (stepId) =>
    set((state) => ({
      openSkillResultByStep: {
        ...state.openSkillResultByStep,
        [stepId]: !state.openSkillResultByStep[stepId],
      },
    })),

  setNotice: (notice) => set({ notice }),
  setIsSending: (sending) => set({ isSending: sending }),
  setActiveRequestConversationId: (id) => set({ activeRequestConversationId: id }),

  toggleConversationGroup: (groupId) =>
    set((state) => ({
      collapsedConversationGroups: {
        ...state.collapsedConversationGroups,
        [groupId]: !state.collapsedConversationGroups[groupId],
      },
    })),
  setCollapsedConversationGroups: (groups) =>
    set((state) => ({
      collapsedConversationGroups: typeof groups === 'function' ? groups(state.collapsedConversationGroups) : groups,
    })),
  setSwipingConversation: (id) => set({ swipingConversationId: id }),
  setSwipeOffsetX: (offset) => set({ swipeOffsetX: offset }),

  setIsAutoFollowEnabled: (enabled) =>
    set((state) => ({
      isAutoFollowEnabled: typeof enabled === 'function' ? enabled(state.isAutoFollowEnabled) : enabled,
    })),
  setMessageListScrollMetrics: (metrics) =>
    set((state) => ({
      messageListScrollMetrics: typeof metrics === 'function' ? metrics(state.messageListScrollMetrics) : metrics,
    })),
  setActiveChatScrollInsets: (insets) =>
    set((state) => ({
      activeChatScrollInsets: typeof insets === 'function' ? insets(state.activeChatScrollInsets) : insets,
    })),

  navigateSettingsView: (view) => set({ settingsView: view }),
  setProviderDetailTargetId: (id) => set({ providerDetailTargetId: id }),
  setManualModelDraft: (draft) => set({ manualModelDraft: draft }),
  setProviderModelSearch: (search) => set({ providerModelSearch: search }),
  setFetchingModelsForProvider: (providerId, fetching) =>
    set((state) => ({
      isFetchingModelsByProviderId: {
        ...state.isFetchingModelsByProviderId,
        [providerId]: fetching,
      },
    })),
  setIsFetchingModelsByProviderId: (updater) =>
    set((state) => ({
      isFetchingModelsByProviderId: typeof updater === 'function' ? updater(state.isFetchingModelsByProviderId) : updater,
    })),

  togglePromptEditor: (key) =>
    set((state) => ({
      openPromptEditors: {
        ...state.openPromptEditors,
        [key]: !state.openPromptEditors[key],
      },
    })),
  toggleProviderPromptEditor: (key) =>
    set((state) => ({
      openProviderPromptEditors: {
        ...state.openProviderPromptEditors,
        [key]: !state.openProviderPromptEditors[key],
      },
    })),
  setOpenProviderPromptEditors: (editors) => set({ openProviderPromptEditors: editors }),

  setRequestingPermission: (key, requesting) =>
    set((state) => ({
      requestingPermissionByKey: {
        ...state.requestingPermissionByKey,
        [key]: requesting,
      },
    })),
  setRequestingPermissionByKey: (updater) =>
    set((state) => ({
      requestingPermissionByKey: typeof updater === 'function' ? updater(state.requestingPermissionByKey) : updater,
    })),

  setHomepageSendTransition: (transition) => set({ homepageSendTransition: transition }),
}))
