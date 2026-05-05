import { forwardRef } from 'react'
import type { ChatSummarySnapshot } from '../state/types'

interface ChatSummaryBarProps {
  summary: ChatSummarySnapshot
  numberFormatter: Intl.NumberFormat
}

const ChatSummaryBar = forwardRef<HTMLElement, ChatSummaryBarProps>(
  ({ summary, numberFormatter }, ref) => (
    <section ref={ref} className="summary-bar chat-summary-bar">
      <span>轮次 {summary.rounds}</span>
      <span>输入 {numberFormatter.format(summary.promptTokens)}</span>
      <span>输出 {numberFormatter.format(summary.completionTokens)}</span>
      <span>总计 {numberFormatter.format(summary.totalTokens)}</span>
      {summary.estimatedCount > 0 ? (
        <span className="summary-muted">含 {summary.estimatedCount} 条估算</span>
      ) : null}
    </section>
  ),
)

ChatSummaryBar.displayName = 'ChatSummaryBar'

export default ChatSummaryBar
