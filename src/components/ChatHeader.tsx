import type { Conversation, ThemeMode, TitleTransitionState } from '../state/types'
import ThemeToggle from './ThemeToggle'

interface ChatHeaderProps {
  chatHeaderRef: React.RefObject<HTMLElement | null>
  titleTextRef: React.RefObject<HTMLSpanElement | null>
  titleRenameButtonRef: React.RefObject<HTMLButtonElement | null>
  titleInputRef: React.RefObject<HTMLInputElement | null>
  titleActionsRef: React.RefObject<HTMLDivElement | null>
  isEditingTitle: boolean
  titleDraft: string
  titleTransition: TitleTransitionState | null
  activeConversation: Conversation | null
  displayConversationTitle: string
  shouldShowTitleRenameButton: boolean
  themeMode: ThemeMode
  openDrawer: () => void
  setTitleDraft: (draft: string) => void
  saveRenameConversation: () => void
  cancelRenameConversation: () => void
  beginRenameConversation: () => void
  onThemeToggle: (nextMode: ThemeMode) => void
}

const ChatHeader = ({
  chatHeaderRef,
  titleTextRef,
  titleRenameButtonRef,
  titleInputRef,
  titleActionsRef,
  isEditingTitle,
  titleDraft,
  titleTransition,
  activeConversation,
  displayConversationTitle,
  shouldShowTitleRenameButton,
  themeMode,
  openDrawer,
  setTitleDraft,
  saveRenameConversation,
  cancelRenameConversation,
  beginRenameConversation,
  onThemeToggle,
}: ChatHeaderProps) => (
  <header
    ref={chatHeaderRef}
    className={`app-header header-card chat-header-pill ${isEditingTitle ? 'is-editing-title' : ''}`}
  >
    <button
      type="button"
      className="menu-button"
      aria-label="打开会话菜单"
      onClick={openDrawer}
    >
      <span />
      <span />
      <span />
    </button>

    <div className={`header-center ${isEditingTitle ? 'is-editing' : ''}`}>
      {isEditingTitle && activeConversation ? (
        <div className={`title-editor ${titleTransition ? 'is-hidden' : ''}`}>
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveRenameConversation()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelRenameConversation()
              }
            }}
          />
          <div ref={titleActionsRef} className="title-actions">
            <button
              type="button"
              className="tiny-button title-save-button"
              onClick={saveRenameConversation}
            >
              保存
            </button>
            <button
              type="button"
              className="tiny-button title-cancel-button"
              onClick={cancelRenameConversation}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className={`title-display ${titleTransition ? 'is-hidden' : ''}`}>
          <span ref={titleTextRef} className="title-text homepage-title-text conversation-title-shell">
            动话 · <em>{displayConversationTitle}</em>
          </span>
          {shouldShowTitleRenameButton ? (
            <button
              ref={titleRenameButtonRef}
              type="button"
              className="icon-inline-button title-rename-button"
              aria-label="编辑对话名"
              onClick={beginRenameConversation}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5.5 16.9V19h2.1l8.1-8.1-2.1-2.1-8.1 8.1Zm9-9 2.1 2.1 1.2-1.2a1.5 1.5 0 0 0 0-2.1l-1.2-1.2a1.5 1.5 0 0 0-2.1 0L13.3 6.7l1.2 1.2Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      )}
    </div>

    <ThemeToggle themeMode={themeMode} onToggle={onThemeToggle} />
  </header>
)

export default ChatHeader
