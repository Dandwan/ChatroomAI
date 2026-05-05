import type { Notice } from '../state/types'

interface NoticeBannerProps {
  notice: Notice
}

const NoticeBanner = ({ notice }: NoticeBannerProps) => (
  <div className="chat-notice-layer">
    <div className={`notice notice-${notice.type}`}>{notice.text}</div>
  </div>
)

export default NoticeBanner
