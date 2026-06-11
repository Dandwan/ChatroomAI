/**
 * Chat UI 交互处理 hook
 * 从 src/App.tsx 提取 - 处理抽屉、菜单、图片查看器、滚动、标题编辑等 UI 交互
 */
import { useCallback, useRef, useState } from 'react'
import type {
  DeleteDialogState,
  ImageAttachment,
  RectSnapshot,
} from '../state/types'
import { useUIStore } from '../state/ui-store'
import { useChatStore } from '../state/chat-store'
import { projectConversationMessages } from '../services/chat-transcript'
import { toImageViewerItem, collectConversationImageViewerItems } from '../utils/app-images'

interface UseChatUIReturn {
  // ── Drawer state ──
  drawerMounted: boolean
  drawerVisible: boolean
  openDrawer: () => void
  closeDrawer: () => void

  // ── Model menu state ──
  modelMenuMounted: boolean
  modelMenuVisible: boolean
  openModelMenu: () => void
  closeModelMenu: () => void

  // ── Settings state ──
  settingsMounted: boolean
  settingsVisible: boolean
  openSettings: () => void
  closeSettings: () => void

  // ── Image viewer state ──
  imageViewerMounted: boolean
  imageViewerVisible: boolean
  openImageViewer: (viewerKey: string, image: Pick<ImageAttachment, 'name' | 'dataUrl'>) => void
  closeImageViewer: () => void

  // ── Scroll to bottom ──
  scrollToBottomButtonMounted: boolean
  scrollToBottomButtonVisible: boolean
  showScrollToBottomButton: () => void
  hideScrollToBottomButton: () => void

  // ── Clipboard ──
  copyTextToClipboard: (text: string) => Promise<boolean>

  // ── Delete dialog ──
  openDeleteDialog: (dialog: DeleteDialogState) => void

  // ── Title editing ──
  renamingConversationId: string | null
  renamingDraft: string
  renamingTitleRect: RectSnapshot | null
  beginRenameConversation: (conversationId: string, title: string, rect: RectSnapshot) => void
  setRenamingDraft: (value: string) => void
  cancelRenameConversation: () => void
  saveRenameConversation: () => void
}

export function useChatUI(): UseChatUIReturn {
  // ── Store selectors ──
  const drawerMounted = useUIStore((s) => s.drawerMounted)
  const drawerVisible = useUIStore((s) => s.drawerVisible)
  const modelMenuMounted = useUIStore((s) => s.modelMenuMounted)
  const modelMenuVisible = useUIStore((s) => s.modelMenuVisible)
  const settingsMounted = useUIStore((s) => s.settingsMounted)
  const settingsVisible = useUIStore((s) => s.settingsVisible)
  const imageViewerMounted = useUIStore((s) => s.imageViewerMounted)
  const imageViewerVisible = useUIStore((s) => s.imageViewerVisible)
  const scrollToBottomButtonMounted = useUIStore((s) => s.scrollToBottomButtonMounted)
  const scrollToBottomButtonVisible = useUIStore((s) => s.scrollToBottomButtonVisible)

  // ── Refs ──
  const drawerAnimationFrameRef = useRef<number | null>(null)
  const modelMenuAnimationFrameRef = useRef<number | null>(null)

  // ── Title editing state ──
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)
  const [renamingDraft, setRenamingDraft] = useState('')
  const [renamingTitleRect, setRenamingTitleRect] = useState<RectSnapshot | null>(null)

  // ── Drawer ──
  const openDrawer = useCallback((): void => {
    useUIStore.getState().setDrawerVisibility(true, false)
    if (drawerAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(drawerAnimationFrameRef.current)
    }
    drawerAnimationFrameRef.current = window.requestAnimationFrame(() => {
      drawerAnimationFrameRef.current = null
      useUIStore.getState().setDrawerVisibility(true, true)
    })
  }, [])

  const closeDrawer = useCallback((): void => {
    if (drawerAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(drawerAnimationFrameRef.current)
      drawerAnimationFrameRef.current = null
    }
    useUIStore.getState().setDrawerVisibility(true, false)
  }, [])

  // ── Model menu ──
  const openModelMenu = useCallback((): void => {
    useUIStore.getState().setModelMenuVisibility(true, false)
    if (modelMenuAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(modelMenuAnimationFrameRef.current)
    }
    modelMenuAnimationFrameRef.current = window.requestAnimationFrame(() => {
      modelMenuAnimationFrameRef.current = null
      useUIStore.getState().setModelMenuVisibility(true, true)
    })
  }, [])

  const closeModelMenu = useCallback((): void => {
    if (modelMenuAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(modelMenuAnimationFrameRef.current)
      modelMenuAnimationFrameRef.current = null
    }
    useUIStore.getState().setModelMenuVisibility(true, false)
  }, [])

  // ── Settings ──
  const openSettings = useCallback((): void => {
    useUIStore.getState().setSettingsVisibility(true, true)
  }, [])

  const closeSettings = useCallback((): void => {
    useUIStore.getState().setSettingsVisibility(false, false)
  }, [])

  // ── Image viewer ──
  const showImageViewerOverlay = useCallback((): void => {
    useUIStore.getState().setImageViewerVisibility(true, true)
  }, [])

  const hideImageViewerOverlay = useCallback((): void => {
    useUIStore.getState().setImageViewerVisibility(false, false)
  }, [])

  const openImageViewer = useCallback(
    (viewerKey: string, image: Pick<ImageAttachment, 'name' | 'dataUrl'>): void => {
      const fallbackItem = toImageViewerItem(viewerKey, image)
      if (!fallbackItem) {
        return
      }

      const chatState = useChatStore.getState()
      const conversations = chatState.conversations
      const activeConversationId = chatState.activeConversationId
      const pendingImages = chatState.pendingImages

      const activeConversation =
        conversations.find((c) => c.id === activeConversationId) ?? null
      const activeMessages = activeConversation
        ? projectConversationMessages(activeConversation)
        : []
      const viewerItems = collectConversationImageViewerItems(activeMessages, pendingImages)

      const items = viewerItems.length > 0 ? viewerItems : [fallbackItem]
      const initialIndex = items.findIndex((item) => item.key === viewerKey)

      useUIStore.getState().setImageViewer({
        items,
        initialIndex: initialIndex >= 0 ? initialIndex : 0,
      })
      showImageViewerOverlay()
    },
    [showImageViewerOverlay],
  )

  const closeImageViewer = useCallback((): void => {
    hideImageViewerOverlay()
  }, [hideImageViewerOverlay])

  // ── Scroll to bottom ──
  const showScrollToBottomButton = useCallback((): void => {
    useUIStore.getState().setScrollToBottomButtonVisibility(true, true)
  }, [])

  const hideScrollToBottomButton = useCallback((): void => {
    useUIStore.getState().setScrollToBottomButtonVisibility(false, false)
  }, [])

  // ── Clipboard ──
  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }, [])

  // ── Delete dialog ──
  const openDeleteDialog = useCallback((dialog: DeleteDialogState): void => {
    useUIStore.getState().openDeleteDialog(dialog)
  }, [])

  // ── Title editing ──
  const beginRenameConversation = useCallback(
    (conversationId: string, title: string, rect: RectSnapshot): void => {
      setRenamingConversationId(conversationId)
      setRenamingDraft(title)
      setRenamingTitleRect(rect)
    },
    [],
  )

  const cancelRenameConversation = useCallback((): void => {
    setRenamingConversationId(null)
    setRenamingDraft('')
    setRenamingTitleRect(null)
  }, [])

  const saveRenameConversation = useCallback((): void => {
    // The actual save logic is in the parent component
    // This just returns the draft for saving
  }, [])

  return {
    drawerMounted,
    drawerVisible,
    openDrawer,
    closeDrawer,
    modelMenuMounted,
    modelMenuVisible,
    openModelMenu,
    closeModelMenu,
    settingsMounted,
    settingsVisible,
    openSettings,
    closeSettings,
    imageViewerMounted,
    imageViewerVisible,
    openImageViewer,
    closeImageViewer,
    scrollToBottomButtonMounted,
    scrollToBottomButtonVisible,
    showScrollToBottomButton,
    hideScrollToBottomButton,
    copyTextToClipboard,
    openDeleteDialog,
    renamingConversationId,
    renamingDraft,
    renamingTitleRect,
    beginRenameConversation,
    setRenamingDraft,
    cancelRenameConversation,
    saveRenameConversation,
  }
}
