import { type CSSProperties, type ReactNode } from 'react'

export interface AppShellProps {
  isHomepageEmptyState: boolean
  hasActiveMessages: boolean
  homepageSendTransition: unknown | null
  appShellStyle: CSSProperties

  // Conditional backgrounds
  shouldShowHomepageBackground: boolean
  resolvedDailyCover: unknown | null
  shouldShowChatBackground: boolean

  // Children rendered as ReactNode blocks
  transitionElements: ReactNode
  headerElement: ReactNode
  summaryElement: ReactNode
  noticeElement: ReactNode | null
  contentElement: ReactNode       // main.message-list with ChildrenView, HomepageView etc.
  composerElement: ReactNode     // ComposerView
  fileInputElements: ReactNode
  drawerElement: ReactNode
  imageViewerElement: ReactNode | null
  deleteConfirmationElement: ReactNode
  updateDialogElement: ReactNode | null
  settingsElement: ReactNode | null

  // Callbacks
  onHomepageTransitionEnd: () => void
}

export function AppShell(props: AppShellProps) {
  const {
    isHomepageEmptyState,
    hasActiveMessages,
    homepageSendTransition,
    appShellStyle,
    shouldShowHomepageBackground,
    resolvedDailyCover,
    shouldShowChatBackground,
    transitionElements,
    headerElement,
    summaryElement,
    noticeElement,
    contentElement,
    composerElement,
    fileInputElements,
    drawerElement,
    imageViewerElement,
    deleteConfirmationElement,
    updateDialogElement,
    settingsElement,
  } = props

  return (
    <div
      className={`app-shell chat-page-shell ${isHomepageEmptyState ? 'is-homepage-empty' : ''} ${
        hasActiveMessages ? 'has-active-messages' : ''
      } ${homepageSendTransition ? 'is-homepage-send-transition-active' : ''}`}
      style={appShellStyle}
    >
      {shouldShowHomepageBackground ? (
        <div className={`homepage-empty-background ${resolvedDailyCover ? 'has-cover' : 'is-fallback'}`} aria-hidden="true" />
      ) : null}

      {shouldShowChatBackground ? <div className="chat-active-background" aria-hidden="true" /> : null}

      {transitionElements}

      <div className="app-shell-content">
        {headerElement}
        {summaryElement}
        {noticeElement}

        {contentElement}
        {composerElement}
        {fileInputElements}
      </div>

      {drawerElement}
      {imageViewerElement}
      {deleteConfirmationElement}
      {updateDialogElement}
      {settingsElement}
    </div>
  )
}
