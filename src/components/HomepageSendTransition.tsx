import type { CSSProperties } from 'react'
import type { HomepageSendTransitionState } from '../state/types'
import NewConversationShowcase from './NewConversationShowcase'

interface HomepageSendTransitionProps {
  transition: HomepageSendTransitionState
  numberFormatter: Intl.NumberFormat
  onAnimationEnd: () => void
}

export default function HomepageSendTransition({
  transition,
  numberFormatter,
  onAnimationEnd,
}: HomepageSendTransitionProps) {
  const backgroundStyle = transition.cover
    ? ({ '--homepage-transition-image': `url("${transition.cover.imageUrl}")` } as CSSProperties)
    : undefined

  const showcaseStyle = {
    top: `${transition.showcaseRect.top}px`,
    left: `${transition.showcaseRect.left}px`,
    width: `${transition.showcaseRect.width}px`,
    height: `${transition.showcaseRect.height}px`,
  } as CSSProperties

  const summaryStyle = transition.summaryRect
    ? ({
        top: `${transition.summaryRect.top}px`,
        left: `${transition.summaryRect.left}px`,
        width: `${transition.summaryRect.width}px`,
        height: `${transition.summaryRect.height}px`,
      } as CSSProperties)
    : undefined

  return (
    <div
      className="homepage-send-transition-layer"
      aria-hidden="true"
      onAnimationEnd={onAnimationEnd}
    >
      <div
        className={`homepage-send-transition-background ${
          transition.cover ? 'has-cover' : 'is-fallback'
        }`}
        style={backgroundStyle}
      />
      {transition.summaryRect ? (
        <section
          className="summary-bar chat-summary-bar homepage-send-transition-summary"
          style={summaryStyle}
        >
          <span>轮次 {transition.summary.rounds}</span>
          <span>输入 {numberFormatter.format(transition.summary.promptTokens)}</span>
          <span>输出 {numberFormatter.format(transition.summary.completionTokens)}</span>
          <span>总计 {numberFormatter.format(transition.summary.totalTokens)}</span>
          {transition.summary.estimatedCount > 0 ? (
            <span className="summary-muted">含 {transition.summary.estimatedCount} 条估算</span>
          ) : null}
        </section>
      ) : null}
      <div className="homepage-send-transition-showcase-shell" style={showcaseStyle}>
        <NewConversationShowcase
          cover={transition.cover}
          highlightStats={transition.highlightStats}
          responseModeLabel={transition.responseModeLabel}
          className="is-transition-overlay"
        />
      </div>
    </div>
  )
}
