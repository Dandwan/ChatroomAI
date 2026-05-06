import type { ChangeEvent } from 'react'
import ChatInputBox from './ChatInputBox'

interface PromptEditorPanelProps {
  isOpen: boolean
  onToggle: () => void
  title: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
}

export default function PromptEditorPanel({
  isOpen,
  onToggle,
  title,
  value,
  onChange,
  placeholder,
  helperText,
  actionLabel,
  onAction,
  actionDisabled = false,
}: PromptEditorPanelProps) {
  return (
    <section className={`reasoning-panel settings-prompt-panel ${isOpen ? 'is-open' : ''}`}>
      <button type="button" className="reasoning-toggle" onClick={onToggle}>
        <span>{title}</span>
        <span className={`arrow ${isOpen ? 'open' : ''}`}>▾</span>
      </button>
      <div className="reasoning-body">
        <div className="settings-prompt-content">
          {helperText ? <p className="settings-prompt-helper">{helperText}</p> : null}
          <ChatInputBox
            className="settings-chat-input settings-chat-input-card settings-prompt-input"
            radiusMode="card"
            value={value}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
            placeholder={placeholder}
            maxHeight={420}
          />
          {actionLabel && onAction ? (
            <div className="settings-prompt-actions">
              <button type="button" className="tiny-button" onClick={onAction} disabled={actionDisabled}>
                {actionLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
