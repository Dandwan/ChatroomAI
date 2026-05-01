import type { ReactNode } from 'react'
import type { ResolvedDailyCover } from '../services/daily-cover'
import type { HomepageHighlightStat } from '../services/homepage-highlights'

interface NewConversationShowcaseProps {
  cover: ResolvedDailyCover | null
  highlightStats: HomepageHighlightStat[]
  responseModeLabel: string
  footerContent?: ReactNode
}

const NewConversationShowcase = ({
  cover,
  highlightStats,
  responseModeLabel,
  footerContent,
}: NewConversationShowcaseProps) => {
  const displayHighlightStats =
    highlightStats.length > 0
      ? highlightStats
      : [
          {
            id: 'tokenUsage',
            label: 'Total token use',
            value: '0',
            meta: '词元消耗',
            count: 0,
            priority: 'primary' as const,
          },
          {
            id: 'conversationHistory',
            label: 'Conversation archive',
            value: '0',
            meta: '历史会话',
            count: 0,
            priority: 'primary' as const,
          },
          {
            id: 'toolCalls',
            label: 'Tool calls',
            value: '0',
            meta: '工具调用',
            count: 0,
            priority: 'primary' as const,
          },
        ]

  return (
    <section className={`cover-empty-state ${cover ? 'has-cover' : 'is-fallback'}`}>
      <div className="cover-empty-state-content">
        <div className="cover-empty-state-kicker">
          <span>01</span>
          <span className="cover-empty-state-rule" />
          <span>
            cold start
            {cover ? ` · ${cover.dateKey}` : ''}
          </span>
        </div>

        <h2 className="cover-empty-state-title">
          <span>让今天的风景，</span>
          <span>成为这段</span>
          <span className="is-italic">new conversation</span>
          <span>的开场。</span>
        </h2>

        <div className="cover-empty-state-byline">
          {cover ? (
            <>
              <span>{cover.title}</span>
              <span className="cover-empty-state-dot" />
              <span>{cover.photographer}</span>
              <span className="cover-empty-state-dot" />
              <span>{cover.description}</span>
            </>
          ) : (
            <span>Daily cover unavailable. Falling back to the quiet shell.</span>
          )}
        </div>

        <div className="cover-empty-state-bottom-grid">
          <div className="cover-empty-state-meta">
            <div className="cover-empty-state-meta-cell">
              <span className="label">default pool</span>
              <span className="value">4 landscapes</span>
            </div>
            <div className="cover-empty-state-meta-cell">
              <span className="label">source</span>
              <span className="value">{cover?.sourceLabel ?? 'bundled pool'}</span>
            </div>
            <div className="cover-empty-state-meta-cell">
              <span className="label">rotation</span>
              <span className="value">{cover?.sourceKind === 'api' ? 'daily api' : 'daily hash'}</span>
            </div>
            <div className="cover-empty-state-meta-cell">
              <span className="label">mode</span>
              <span className="value">{responseModeLabel}</span>
            </div>
          </div>

          <div className="cover-empty-state-stats" role="list" aria-label="首页关键统计">
            {displayHighlightStats.map((stat) => (
              <article key={stat.id} className="cover-empty-state-stat" role="listitem">
                <span className="label">{stat.label}</span>
                <span className="value">{stat.value}</span>
                <span className="meta">{stat.meta}</span>
              </article>
            ))}
          </div>
        </div>
      </div>

      {footerContent ? <div className="cover-empty-state-footer-slot">{footerContent}</div> : null}
    </section>
  )
}

export default NewConversationShowcase
