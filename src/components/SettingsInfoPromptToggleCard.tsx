import type { InfoPromptDefinition } from '../services/skills/info-system-prompts'

interface SettingsInfoPromptToggleCardProps {
  cardKey: string
  definition: InfoPromptDefinition
  description: string
  statusText?: string
  checked: boolean
  onChange: (enabled: boolean) => void
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
}

export default function SettingsInfoPromptToggleCard({
  cardKey,
  definition,
  description,
  statusText,
  checked,
  onChange,
  actionLabel,
  onAction,
  actionDisabled = false,
}: SettingsInfoPromptToggleCardProps) {
  return (
    <div key={cardKey} className="settings-static-card settings-toggle-card">
      <div className="settings-toggle-card-header">
        <div className="settings-toggle-card-copy">
          <div className="settings-entry-title">{definition.title}</div>
          <div className="settings-entry-meta">{description}</div>
          {statusText ? <div className="settings-toggle-card-state">{statusText}</div> : null}
        </div>
        <input
          className="toggle-switch"
          type="checkbox"
          aria-label={definition.title}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </div>
      {actionLabel && onAction ? (
        <div className="settings-toggle-card-actions">
          <button type="button" className="tiny-button" onClick={onAction} disabled={actionDisabled}>
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
