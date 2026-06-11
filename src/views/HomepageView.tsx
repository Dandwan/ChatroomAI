import { type RefObject } from 'react'
import type { Conversation, ConversationResponseMode, HomepageHighlightStat } from '../state/types'
import type { ResolvedDailyCover } from '../services/daily-cover'
import CloudAuthForm from '../components/CloudAuthForm'
import NewConversationShowcase from '../components/NewConversationShowcase'

export interface HomepageViewProps {
  isActiveConversationLoadError: boolean
  isActiveConversationLoading: boolean
  activeMessagesLength: number
  activeConversation: Conversation | null
  chatStateLoadError: string | null
  hydrateConversationById: (id: string) => void
  displayConversationTitle: string
  showCloudAuthOnHomepage: boolean
  isCloudAuthRegisterMode: boolean
  setCloudAuthMode: (mode: 'none' | 'login' | 'register') => void
  setAuthVersion: (updater: (v: number) => number) => void
  homepageShowcaseRef: RefObject<HTMLElement | null>
  resolvedDailyCover: ResolvedDailyCover | null
  homepageHighlightStats: HomepageHighlightStat[]
  getResponseModeLabel: (mode: ConversationResponseMode) => string
  activeConversationResponseMode: ConversationResponseMode
}

export function HomepageView(props: HomepageViewProps) {
  const {
    isActiveConversationLoadError,
    isActiveConversationLoading,
    activeMessagesLength,
    activeConversation,
    chatStateLoadError,
    hydrateConversationById,
    displayConversationTitle,
    showCloudAuthOnHomepage,
    isCloudAuthRegisterMode,
    setCloudAuthMode,
    setAuthVersion,
    homepageShowcaseRef,
    resolvedDailyCover,
    homepageHighlightStats,
    getResponseModeLabel,
    activeConversationResponseMode,
  } = props

  if (isActiveConversationLoadError) {
    return (
      <section className="empty-state">
        <h2>历史对话加载失败</h2>
        <p className="empty-state-line">
          {activeConversation?.storageLoadError ?? chatStateLoadError ?? '未知错误'}
        </p>
        <button
          type="button"
          className="tiny-button"
          onClick={() => {
            if (!activeConversation) {
              return
            }
            hydrateConversationById(activeConversation.id)
          }}
        >
          重试加载
        </button>
      </section>
    )
  }

  if (isActiveConversationLoading) {
    return (
      <section className="empty-state">
        <h2>{displayConversationTitle}</h2>
        <p className="empty-state-line">正在载入这段历史对话…</p>
      </section>
    )
  }

  if (activeMessagesLength === 0) {
    if (showCloudAuthOnHomepage) {
      return (
        <CloudAuthForm
          initialMode={isCloudAuthRegisterMode ? 'register' : 'login'}
          onAuthSuccess={() => {
            setCloudAuthMode('none')
            setAuthVersion((v) => v + 1)
          }}
        />
      )
    }

    return (
      <NewConversationShowcase
        rootRef={homepageShowcaseRef}
        cover={resolvedDailyCover}
        highlightStats={homepageHighlightStats}
        responseModeLabel={getResponseModeLabel(activeConversationResponseMode)}
      />
    )
  }

  return null
}
