import type { AppPermissionKey, PermissionToggles } from '../../state/types'
import { PERMISSION_LABELS } from '../../state/types'

interface PermissionsSettingsProps {
  permissionToggles: PermissionToggles
  requestingPermissionByKey: Record<string, boolean>
  onToggle: (key: AppPermissionKey, enabled: boolean) => void
}

export default function PermissionsSettings({
  permissionToggles,
  requestingPermissionByKey,
  onToggle,
}: PermissionsSettingsProps) {
  return (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">权限管理</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>
        <p className="summary-muted">
          默认关闭。打开开关时才会向系统申请权限；关闭开关只会停止本应用使用该权限，不会撤销系统已授权。
        </p>
      </section>

      <section className="settings-section">
        <div className="field-grid">
          {(Object.keys(PERMISSION_LABELS) as AppPermissionKey[]).map((key) => (
            <label key={key} className="toggle-row">
              <span>{PERMISSION_LABELS[key]}</span>
              <input
                className="toggle-switch"
                type="checkbox"
                checked={permissionToggles[key]}
                disabled={requestingPermissionByKey[key]}
                onChange={(event) => {
                  void onToggle(key, event.target.checked)
                }}
              />
            </label>
          ))}
        </div>
      </section>
    </>
  )
}
