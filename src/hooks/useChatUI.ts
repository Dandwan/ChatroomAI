/**
 * Chat UI 交互处理 hook
 * 从 src/App.tsx 提取 - 处理抽屉、菜单、图片查看器、滚动、标题编辑等 UI 交互
 */
import { useCallback, useRef } from 'react'
import type {
  DeleteDialogState,
  ImageViewerItem,
  ImageViewerState,
  PendingImageAttachment,
} from '../state/types'
import { useUIStore } from '../state/ui-store'

interface UseChatUIReturn {
  // ── Drawer ──
  openDrawer: () => void
  closeDrawer: () => void
  drawerAnimationFrameRef: React.MutableRefObject<number | null>

  // ── Model menu ──
  openModelMenu: () => void
  closeModelMenu: () => void
  modelMenuAnimationFrameRef: React.MutableRefObject<number | null>

  // ── Settings ──
  openSettings: () => void
  closeSettings: () => void

  // ── Image viewer ──
  showImageViewerOverlay: () => void
  hideImageViewerOverlay: () => void
  openImageViewer: (
    currentKey: string,
    currentImage: PendingImageAttachment | null,
    items: ImageViewerItem[],
    initialIndex: number,
  ) => void
  closeImageViewer: () => void

  // ── Scroll to bottom ──
  showScrollToBottomButton: () => void
  hideScrollToBottomButton: () => void

  // ── Clipboard ──
  copyTextToClipboard: (text: string) => Promise<boolean>

  // ── Delete dialog ──
  openDeleteDialog: (dialog: DeleteDialogState) => void
}

export function useChatUI(): UseChatUIReturn {
  // ── Drawer ──
  const openDrawer = useCallback((): void => {
    const state = useUIStore.getState()
    state.setDrawerVisibility(true, false)
  }, [])

  const closeDrawer = useCallback((): void => {
    const state = useUIStore.getState()
    state.setDrawerVisibility(true, false)
  }, [])

  const drawerAnimationFrameRef = useRef<number | null>(null)

  // ── Model menu ──
  const openModelMenu = useCallback((): void => {
    const state = useUIStore.getState()
    state.setModelMenuVisibility(true, false)
  }, [])

  const closeModelMenu = useCallback((): void => {
    const state = useUIStore.getState()
    state.setModelMenuVisibility(true, false)
  }, [])

  const modelMenuAnimationFrameRef = useRef<number | null>(null)

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
    // Delay unmount to allow CSS transition to finish
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
        // Fall through to fallback
      }
    }

    // Fallback: use textarea
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
        // Ignore errors
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

  return {
    openDrawer,
    closeDrawer,
    drawerAnimationFrameRef,
    openModelMenu,
    closeModelMenu,
    modelMenuAnimationFrameRef,
    openSettings,
    closeSettings,
    showImageViewerOverlay,
    hideImageViewerOverlay,
    openImageViewer,
    closeImageViewer,
    showScrollToBottomButton,
    hideScrollToBottomButton,
    copyTextToClipboard,
    openDeleteDialog,
  }
}
