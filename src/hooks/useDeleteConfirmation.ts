import { useCallback, useEffect } from 'react'
import { useUIStore } from '../state/ui-store'
import type { Conversation, ProviderConfig } from '../state/types'
import type { SkillRecord, RuntimeRecord } from '../services/skills/types'

export interface UseDeleteConfirmationParams {
  openDeleteDialog: (dialog: any) => void
  deleteConversation: (conversationId: string) => void
  deleteProvider: (providerId: string) => void
  deleteSkillById: (skillId: string) => void
  deleteRuntimeById: (runtimeId: string) => void
  conversations: Conversation[]
  providers: ProviderConfig[]
  skillRecords: SkillRecord[]
  runtimeRecords: RuntimeRecord[]
  settings: { deleteConfirmGraceSeconds: number }
  deleteConfirmBypassUntilRef: React.MutableRefObject<number>
}

export interface UseDeleteConfirmationReturn {
  closeDeleteDialog: () => void
  confirmDeleteConversation: () => void
  confirmDeleteProvider: () => void
  confirmDeleteSkill: () => void
  confirmDeleteRuntime: () => void
  extendDeleteConfirmGrace: () => void
  requestDeleteConversation: (conversationId: string) => void
}

export function useDeleteConfirmation(params: UseDeleteConfirmationParams): UseDeleteConfirmationReturn {
  const {
    openDeleteDialog, deleteConversation, deleteProvider, deleteSkillById,
    deleteRuntimeById, conversations, providers, skillRecords, runtimeRecords,
    settings, deleteConfirmBypassUntilRef,
  } = params

  const deleteDialog = useUIStore((s) => s.deleteDialog)
  const deleteDialogConversationId = deleteDialog?.type === 'conversation' ? deleteDialog.targetId : null
  const deleteDialogProviderId = deleteDialog?.type === 'provider' ? deleteDialog.targetId : null
  const deleteDialogSkillId = deleteDialog?.type === 'skill' ? deleteDialog.targetId : null
  const deleteDialogRuntimeId = deleteDialog?.type === 'runtime' ? deleteDialog.targetId : null

  const closeDeleteDialog = useCallback((): void => {
    useUIStore.getState().closeDeleteDialog()
  }, [])

  const extendDeleteConfirmGrace = useCallback((): void => {
    const ms = Math.max(0, settings.deleteConfirmGraceSeconds) * 1000
    deleteConfirmBypassUntilRef.current = ms > 0 ? Date.now() + ms : 0
  }, [settings.deleteConfirmGraceSeconds, deleteConfirmBypassUntilRef])

  const confirmDeleteConversation = useCallback((): void => {
    if (!deleteDialogConversationId) return
    extendDeleteConfirmGrace()
    const id = deleteDialogConversationId
    closeDeleteDialog()
    deleteConversation(id)
  }, [deleteDialogConversationId, extendDeleteConfirmGrace, closeDeleteDialog, deleteConversation])

  const confirmDeleteProvider = useCallback((): void => {
    if (!deleteDialogProviderId) return
    const id = deleteDialogProviderId
    closeDeleteDialog()
    deleteProvider(id)
  }, [deleteDialogProviderId, closeDeleteDialog, deleteProvider])

  const confirmDeleteSkill = useCallback((): void => {
    if (!deleteDialogSkillId) return
    const id = deleteDialogSkillId
    closeDeleteDialog()
    void deleteSkillById(id)
  }, [deleteDialogSkillId, closeDeleteDialog, deleteSkillById])

  const confirmDeleteRuntime = useCallback((): void => {
    if (!deleteDialogRuntimeId) return
    const id = deleteDialogRuntimeId
    closeDeleteDialog()
    void deleteRuntimeById(id)
  }, [deleteDialogRuntimeId, closeDeleteDialog, deleteRuntimeById])

  const requestDeleteConversation_ = useCallback((conversationId: string): void => {
    const now = Date.now()
    if (now <= deleteConfirmBypassUntilRef.current) {
      extendDeleteConfirmGrace()
      deleteConversation(conversationId)
      return
    }
    openDeleteDialog({ type: 'conversation', targetId: conversationId })
  }, [deleteConversation, deleteConfirmBypassUntilRef, extendDeleteConfirmGrace, openDeleteDialog])

  // validity check
  useEffect(() => {
    if (!deleteDialog) return
    const isValid =
      (deleteDialog.type === 'conversation' && deleteDialogConversationId &&
        conversations.some((c) => c.id === deleteDialogConversationId)) ||
      (deleteDialog.type === 'provider' && deleteDialogProviderId &&
        providers.some((p) => p.id === deleteDialogProviderId)) ||
      (deleteDialog.type === 'skill' && deleteDialogSkillId &&
        skillRecords.some((s) => s.id === deleteDialogSkillId)) ||
      (deleteDialog.type === 'runtime' && deleteDialogRuntimeId &&
        runtimeRecords.some((r) => r.id === deleteDialogRuntimeId))
    if (!isValid) closeDeleteDialog()
  }, [deleteDialog, deleteDialogConversationId, deleteDialogProviderId, deleteDialogSkillId, deleteDialogRuntimeId, conversations, providers, skillRecords, runtimeRecords, closeDeleteDialog])

  return {
    closeDeleteDialog,
    confirmDeleteConversation,
    confirmDeleteProvider,
    confirmDeleteSkill,
    confirmDeleteRuntime,
    extendDeleteConfirmGrace,
    requestDeleteConversation: requestDeleteConversation_,
  }
}
