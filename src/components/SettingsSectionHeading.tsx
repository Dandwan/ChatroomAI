import type { ReactNode } from 'react'

interface SettingsSectionHeadingProps {
  label: string
  title?: string
  copy?: ReactNode
}

export default function SettingsSectionHeading({ label, title, copy }: SettingsSectionHeadingProps) {
  return (
    <div className="settings-section-heading">
      <div className="conversation-group-divider settings-section-divider">
        <span className="conversation-group-label">{label}</span>
        <span className="conversation-group-dash" aria-hidden="true" />
      </div>
      {title ? <h3 className="settings-section-title">{title}</h3> : null}
      {copy ? <p className="settings-section-copy">{copy}</p> : null}
    </div>
  )
}
