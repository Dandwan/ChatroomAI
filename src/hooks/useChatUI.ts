/**
 * Chat UI 交互处理 hook
 * 从 src/App.tsx 提取 - 处理抽屉、菜单、图片查看器、滚动、标题编辑等 UI 交互
 */
import { useCallback, useRef, useState } from 'react'
import type {
  DeleteDialogState,
  ImageViewerItem,
  ImageViewerState,
  PendingImageAttachment,
  RectSnapshot,
} from '../state/types'
import { useUIStore } from '../state/ui-store'
import {
  TITLE_EDIT_TRANSITION_MS,
  TITLE_EDIT_TRANSITION_TRAVEL_FACTOR,
  TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX,
  TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX,
} from '../utils/app-module'

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
  openImageViewer: (
    currentKey: string,
    currentImage: PendingImageAttachment | null,
    items: ImageViewerItem[],
    initialIndex: number,
  ) => void
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
    (
      _currentKey: string,
      _currentImage: PendingImageAttachment | null,
      items: ImageViewerItem[],
      initialIndex: number,
    ): void => {
      const viewer: ImageViewerState = {
        items,
        initialIndex: Math.max(0, Math.min(initialIndex, items.length - 1)),
      }
      useUIStore.getState().setImageViewer(viewer)
      showImageViewerOverlay()
    },
    [showImageViewerOverlay],
  )

  const closeImageViewer = useCallback((): void => {
    hideImageViewerOverlay()
    window.setTimeout(() => {
      useUIStore.getState().setImageViewer(null)
    }, 300)
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
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // Fall through
      }
    }
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        return true
      } catch {
        // Ignore
      } finally {
        document.body.removeChild(textarea)
      }
    }
    return false
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
