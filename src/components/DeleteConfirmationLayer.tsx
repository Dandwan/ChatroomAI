import { useMemo } from 'react'
import { useUIStore } from '../state/ui-store'
import { useSettingsStore } from '../state/settings-store'
import { useChatStore } from '../state/chat-store'
import { useExtensionsStore } from '../state/extensions-store'
import DeleteConfirmDialog from './DeleteConfirmDialog'

export interface DeleteConfirmationLayerProps {
  confirmDeleteConversation: () => void
  confirmDeleteProvider: () => void
  confirmDeleteSkill: () => void
  confirmDeleteRuntime: () => void
}

export default function DeleteConfirmationLayer(props: DeleteConfirmationLayerProps) {
  const { confirmDeleteConversation, confirmDeleteProvider, confirmDeleteSkill, confirmDeleteRuntime } = props

  const deleteDialog = useUIStore((s) => s.deleteDialog)
  const closeDeleteDialog = useUIStore((s) => s.closeDeleteDialog)
  const settings = useSettingsStore((s) => s.settings)
  const conversations = useChatStore((s) => s.conversations)
  const skillRecords = useExtensionsStore((s) => s.skillRecords)
  const runtimeRecords = useExtensionsStore((s) => s.runtimeRecords)

  const deleteDialogConversationId = deleteDialog?.type === 'conversation' ? deleteDialog.targetId : null
  const deleteDialogConversation = useMemo(
    () =>
      deleteDialogConversationId
        ? conversations.find((c) => c.id === deleteDialogConversationId) ?? null
        : null,
    [conversations, deleteDialogConversationId],
  )

  const deleteDialogProviderId = deleteDialog?.type === 'provider' ? deleteDialog.targetId : null
  const deleteDialogProvider = useMemo(
    () =>
      deleteDialogProviderId
        ? settings.providers.find((p) => p.id === deleteDialogProviderId) ?? null
        : null,
    [deleteDialogProviderId, settings.providers],
  )

  const deleteDialogSkillId = deleteDialog?.type === 'skill' ? deleteDialog.targetId : null
  const deleteDialogSkill = useMemo(
    () =>
      deleteDialogSkillId
        ? skillRecords.find((s) => s.id === deleteDialogSkillId) ?? null
        : null,
    [deleteDialogSkillId, skillRecords],
  )

  const deleteDialogRuntimeId = deleteDialog?.type === 'runtime' ? deleteDialog.targetId : null
  const deleteDialogRuntime = useMemo(
    () =>
      deleteDialogRuntimeId
        ? runtimeRecords.find((r) => r.id === deleteDialogRuntimeId) ?? null
        : null,
    [deleteDialogRuntimeId, runtimeRecords],
  )

  if (!deleteDialog) return null

  if (deleteDialog.type === 'conversation' && deleteDialogConversation) {
    return (
      <DeleteConfirmDialog
        entityName={deleteDialogConversation.title}
        showGraceHint
        graceSeconds={settings.deleteConfirmGraceSeconds}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDeleteConversation}
      />
    )
  }

  if (deleteDialog.type === 'provider' && deleteDialogProvider) {
    return (
      <DeleteConfirmDialog
        entityName={deleteDialogProvider.name.trim() || '未命名服务商'}
        hint="该服务商下的接口配置、模型列表和参数覆盖都会一并删除。"
        onCancel={closeDeleteDialog}
        onConfirm={confirmDeleteProvider}
      />
    )
  }

  if (deleteDialog.type === 'skill' && deleteDialogSkill) {
    return (
      <DeleteConfirmDialog
        entityName={deleteDialogSkill.frontmatter.name || deleteDialogSkill.id}
        hint="该 skill 的配置文件与启用状态都会一起移除。若它覆盖了同名内置 skill，删除后将回退到内置版本。"
        onCancel={closeDeleteDialog}
        onConfirm={confirmDeleteSkill}
      />
    )
  }

  if (deleteDialog.type === 'runtime' && deleteDialogRuntime) {
    return (
      <DeleteConfirmDialog
        entityName={deleteDialogRuntime.displayName || deleteDialogRuntime.id}
        hint="删除后，依赖该运行时的 skill 执行可能失败；如果它当前是默认运行时，也会失去默认指向。"
        onCancel={closeDeleteDialog}
        onConfirm={confirmDeleteRuntime}
      />
    )
  }

  return null
}
