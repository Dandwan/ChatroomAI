import { memo } from 'react'

const ChatScrollPlaceholder = memo(
  ({ heightPx, position }: { heightPx: number; position: 'top' | 'bottom' }) => {
    if (heightPx <= 0) {
      return null
    }

    return (
      <div
        aria-hidden="true"
        className={`chat-scroll-placeholder chat-scroll-placeholder--${position}`}
        style={{ height: `${heightPx}px` }}
      />
    )
  },
)

ChatScrollPlaceholder.displayName = 'ChatScrollPlaceholder'

export default ChatScrollPlaceholder
