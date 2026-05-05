interface SettingsPageIntroProps {
  eyebrow: string
  title: string
  copy: string
}

export default function SettingsPageIntro({ eyebrow, title, copy }: SettingsPageIntroProps) {
  return (
    <header className="settings-page-intro">
      <div className="settings-page-eyebrow">{eyebrow}</div>
      <h2 className="settings-page-title">{title}</h2>
      <p className="settings-page-copy">{copy}</p>
    </header>
  )
}
