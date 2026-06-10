import { type PointerEvent } from 'react'
import { useUIStore } from '../state/ui-store'
import { useChatStore } from '../state/chat-store'
import { formatDrawerGroupLabel, dateFormatter } from '../utils/app-formatting'
import type { ConversationGroup } from '../state/types'

export interface AppDrawerProps {
  conversationListRef: React.RefObject<HTMLDivElement | null>
  conversationGroupElementRefs: React.MutableRefObject<Record<string, HTMLElement | null>>
  drawerScrollTopRef: React.MutableRefObject<number>

  conversationGroups: ConversationGroup[]

  closeDrawer: () => void
  toggleConversationGroup: (groupId: string) => void
  handleConversationPointerDown: (conversationId: string, event: PointerEvent<HTMLButtonElement>) => void
  handleConversationPointerMove: (conversationId: string, event: PointerEvent<HTMLButtonElement>) => void
  handleConversationPointerUp: (conversationId: string, event: PointerEvent<HTMLButtonElement>) => void
  handleConversationPointerCancel: () => void
  handleConversationClick: (conversationId: string) => void
  requestDeleteConversation: (conversationId: string) => void
  openSettingsFromDrawer: () => void
  createNewConversation: () => void
}

export default function AppDrawer(props: AppDrawerProps) {
  const {
    conversationListRef,
    conversationGroupElementRefs,
    drawerScrollTopRef,
    conversationGroups,
    closeDrawer,
    toggleConversationGroup,
    handleConversationPointerDown,
    handleConversationPointerMove,
    handleConversationPointerUp,
    handleConversationPointerCancel,
    handleConversationClick,
    requestDeleteConversation,
    openSettingsFromDrawer,
    createNewConversation,
  } = props

  const drawerMounted = useUIStore((s) => s.drawerMounted)
  const drawerVisible = useUIStore((s) => s.drawerVisible)
  const collapsedConversationGroups = useUIStore((s) => s.collapsedConversationGroups)
  const deleteModeEnabled = useUIStore((s) => s.deleteModeEnabled)
  const swipingConversationId = useUIStore((s) => s.swipingConversationId)
  const swipeOffsetX = useUIStore((s) => s.swipeOffsetX)
  const activeConversationId = useChatStore((s) => s.activeConversationId)

  if (!drawerMounted) {
    return null
  }

  return (
    <div
      className={`drawer-overlay ${drawerVisible ? 'is-open' : 'is-closing'}`}
      onClick={closeDrawer}
    >
      <aside
        className="drawer-panel drawer-panel--editorial frosted-surface"
        onClick={(event) => event.stopPropagation()}
        onTransitionEnd={(event) => {
          if (!drawerVisible && event.target === event.currentTarget) {
            useUIStore.getState().setDrawerVisibility(false, false)
          }
        }}
      >
        <div className="drawer-header drawer-header--editorial">
          <h2>动话</h2>
        </div>

        <div
          ref={conversationListRef}
          className="conversation-list drawer-conversation-list"
          onScroll={(event) => {
            drawerScrollTopRef.current = event.currentTarget.scrollTop
          }}
        >
          {conversationGroups.map((group) => {
            const collapsed = collapsedConversationGroups[group.id] ?? false
            return (
              <section
                key={group.id}
                ref={(node) => {
                  conversationGroupElementRefs.current[group.id] = node
                }}
                className="conversation-group drawer-conversation-group"
              >
                <button
                  type="button"
                  className={`drawer-group-heading ${collapsed ? 'is-collapsed' : ''}`}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? '展开分组' : '收起分组'}
                  onClick={() => toggleConversationGroup(group.id)}
                >
                  <span className="drawer-group-heading-label">
                    {formatDrawerGroupLabel(group.labelTime)}
                  </span>
                </button>

                <div className={`conversation-group-content drawer-group-content ${collapsed ? 'is-collapsed' : ''}`}>
                  <div className="conversation-group-content-inner drawer-group-content-inner">
                    {group.conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`conversation-item-row drawer-conversation-item-row ${
                          deleteModeEnabled ? 'delete-mode' : ''
                        } ${
                          swipingConversationId === conversation.id ? 'is-swiping' : ''
                        }`}
                        style={
                          swipingConversationId === conversation.id
                            ? { transform: `translate3d(${swipeOffsetX}px, 0, 0)` }
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          data-conversation-item="true"
                          className={`conversation-item drawer-conversation-item ${
                            conversation.id === activeConversationId ? 'active' : ''
                          } ${swipingConversationId === conversation.id ? 'is-swiping' : ''}`}
                          onPointerDown={(event) => handleConversationPointerDown(conversation.id, event)}
                          onPointerMove={(event) => handleConversationPointerMove(conversation.id, event)}
                          onPointerUp={(event) => handleConversationPointerUp(conversation.id, event)}
                          onPointerCancel={handleConversationPointerCancel}
                          onClick={() => {
                            if (deleteModeEnabled) {
                              requestDeleteConversation(conversation.id)
                              return
                            }
                            handleConversationClick(conversation.id)
                          }}
                        >
                          <span className="conversation-item-title drawer-conversation-item-title">
                            {conversation.title}
                          </span>
                          <div className="conversation-item-times drawer-conversation-item-times">
                            <span className="conversation-item-time drawer-conversation-item-time">
                              创建：{dateFormatter.format(conversation.createdAt)}
                            </span>
                            <span className="drawer-conversation-item-time-separator" aria-hidden="true">
                              ·
                            </span>
                            <span className="conversation-item-time drawer-conversation-item-time">
                              更新：{dateFormatter.format(conversation.updatedAt)}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="conversation-delete-button"
                          aria-label={`删除 ${conversation.title}`}
                          onClick={() => requestDeleteConversation(conversation.id)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M9 4.75h6M5.75 7h12.5M8.25 7l.65 10.1a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9L15.75 7M10.25 10v5.25M13.75 10v5.25"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
        </div>

        <div className="drawer-footer drawer-footer--editorial">
          <button
            type="button"
            className="drawer-action-button drawer-action-button--editorial drawer-settings-button"
            aria-label="打开设置"
            onClick={openSettingsFromDrawer}
          >
            <span>设置</span>
          </button>
          <button
            type="button"
            className="drawer-action-button drawer-action-button--editorial drawer-new-chat-button"
            aria-label="新增对话"
            onClick={createNewConversation}
          >
            <span>新增对话</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
