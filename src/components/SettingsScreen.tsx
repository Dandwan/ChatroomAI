import type { ReactNode, RefObject, UIEvent } from 'react'
import type { SettingsView } from '../state/types'
import SettingsPageIntro from './SettingsPageIntro'

interface SettingsScreenProps {
  settingsView: SettingsView
  settingsPageRef: RefObject<HTMLElement | null>
  pageChrome: {
    eyebrow: string
    title: string
    copy: string
  }
  settingsContent: ReactNode
  showBack: boolean
  onScroll: (event: UIEvent<HTMLElement>) => void
  onBack: () => void
  onClose: () => void
}

export default function SettingsScreen({
  settingsView,
  settingsPageRef,
  pageChrome,
  settingsContent,
  showBack,
  onScroll,
  onBack,
  onClose,
}: SettingsScreenProps) {
  return (
    <section
      ref={settingsPageRef}
      className={`settings-page settings-page-view-${settingsView}`}
      onScroll={onScroll}
    >
      <div className={`settings-header settings-header-nav-only ${showBack ? 'is-back' : 'is-close'}`}>
        <button
          type="button"
          className={`settings-nav-button ${showBack ? 'is-back' : 'is-close'}`}
          aria-label={showBack ? '返回上一层设置' : '关闭设置'}
          onClick={showBack ? onBack : onClose}
        >
          {showBack ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14.75 6.75 9.5 12l5.25 5.25M10 12h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="m9.45 9.45 5.1 5.1m0-5.1-5.1 5.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="settings-page-shell">
        <SettingsPageIntro {...pageChrome} />
        <div
          key={settingsView}
          className={`settings-view-content ${settingsView !== 'main' ? 'is-animated' : ''}`}
        >
          {settingsContent}
        </div>
      </div>
    </section>
  )
}
