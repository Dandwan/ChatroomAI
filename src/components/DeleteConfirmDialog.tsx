interface DeleteConfirmDialogProps {
  entityName: string
  hint?: string
  showGraceHint?: boolean
  graceSeconds?: number
  onCancel: () => void
  onConfirm: () => void
}

const DeleteConfirmDialog = ({
  entityName,
  hint,
  showGraceHint,
  graceSeconds,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) => (
  <div className="delete-dialog-overlay" onClick={onCancel}>
    <section className="delete-dialog frosted-surface" onClick={(event) => event.stopPropagation()}>
      <h3>删除提醒</h3>
      <p className="delete-dialog-text">确认删除「{entityName}」吗？</p>
      {showGraceHint && graceSeconds !== undefined && graceSeconds > 0 ? (
        <p className="delete-dialog-hint">
          确认后，{graceSeconds} 秒内再次点击垃圾桶将不再提醒。
        </p>
      ) : null}
      {hint ? <p className="delete-dialog-hint">{hint}</p> : null}
      <div className="delete-dialog-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="danger-button" onClick={onConfirm}>
          删除
        </button>
      </div>
    </section>
  </div>
)

export default DeleteConfirmDialog
