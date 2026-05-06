import type { CSSProperties } from 'react'
import type { TitleTransitionState } from '../state/types'

interface TitleTransitionProps {
  transition: TitleTransitionState
}

export default function TitleTransition({ transition }: TitleTransitionProps) {
  return (
    <div className="title-transition-layer" aria-hidden="true">
      <div
        className={`title-transition-title title-transition-title--display ${
          transition.playing ? 'is-playing' : ''
        }`}
        style={
          {
            '--title-start-left': `${transition.titleStartRect.left}px`,
            '--title-start-top': `${transition.titleStartRect.top}px`,
            '--title-start-width': `${transition.titleStartRect.width}px`,
            '--title-start-height': `${transition.titleStartRect.height}px`,
            '--title-end-left': `${transition.titleEndRect.left}px`,
            '--title-end-top': `${transition.titleEndRect.top}px`,
            '--title-end-width': `${transition.titleEndRect.width}px`,
            '--title-end-height': `${transition.titleEndRect.height}px`,
            '--title-start-opacity': transition.phase === 'opening' ? 1 : 0,
            '--title-end-opacity': transition.phase === 'opening' ? 0 : 1,
            '--title-content-start-scale': transition.phase === 'opening' ? '1' : '0.988',
            '--title-content-end-scale': transition.phase === 'opening' ? '0.988' : '1',
          } as CSSProperties
        }
      >
        <span className="title-text title-transition-title-content homepage-title-text conversation-title-shell">
          动话 · <em>{transition.titleText}</em>
        </span>
      </div>

      <div
        className={`title-transition-title title-transition-title--editor ${
          transition.playing ? 'is-playing' : ''
        }`}
        style={
          {
            '--title-start-left': `${transition.titleStartRect.left}px`,
            '--title-start-top': `${transition.titleStartRect.top}px`,
            '--title-start-width': `${transition.titleStartRect.width}px`,
            '--title-start-height': `${transition.titleStartRect.height}px`,
            '--title-end-left': `${transition.titleEndRect.left}px`,
            '--title-end-top': `${transition.titleEndRect.top}px`,
            '--title-end-width': `${transition.titleEndRect.width}px`,
            '--title-end-height': `${transition.titleEndRect.height}px`,
            '--title-start-opacity': transition.phase === 'opening' ? 0 : 1,
            '--title-end-opacity': transition.phase === 'opening' ? 1 : 0,
            '--title-content-start-scale': transition.phase === 'opening' ? '0.988' : '1',
            '--title-content-end-scale': transition.phase === 'opening' ? '1' : '0.988',
          } as CSSProperties
        }
      >
        <input
          className="title-transition-input"
          value={transition.titleText}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      <div
        className={`title-transition-pen ${transition.playing ? 'is-playing' : ''}`}
        style={
          {
            '--pen-start-left': `${transition.penStartRect.left}px`,
            '--pen-start-top': `${transition.penStartRect.top}px`,
            '--pen-start-width': `${transition.penStartRect.width}px`,
            '--pen-start-height': `${transition.penStartRect.height}px`,
            '--pen-end-left': `${transition.penEndRect.left}px`,
            '--pen-end-top': `${transition.penEndRect.top}px`,
            '--pen-end-width': `${transition.penEndRect.width}px`,
            '--pen-end-height': `${transition.penEndRect.height}px`,
            '--pen-start-opacity': transition.phase === 'opening' ? 1 : 0,
            '--pen-end-opacity': transition.phase === 'opening' ? 0 : 1,
          } as CSSProperties
        }
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
      </div>

      <div
        className={`title-transition-actions ${transition.playing ? 'is-playing' : ''}`}
        style={
          {
            '--actions-start-left': `${transition.actionsStartRect.left}px`,
            '--actions-start-top': `${transition.actionsStartRect.top}px`,
            '--actions-start-width': `${transition.actionsStartRect.width}px`,
            '--actions-start-height': `${transition.actionsStartRect.height}px`,
            '--actions-end-left': `${transition.actionsEndRect.left}px`,
            '--actions-end-top': `${transition.actionsEndRect.top}px`,
            '--actions-end-width': `${transition.actionsEndRect.width}px`,
            '--actions-end-height': `${transition.actionsEndRect.height}px`,
            '--actions-start-opacity': transition.phase === 'opening' ? 0 : 1,
            '--actions-end-opacity': transition.phase === 'opening' ? 1 : 0,
          } as CSSProperties
        }
      >
        <button type="button" className="tiny-button title-save-button" tabIndex={-1}>
          保存
        </button>
        <button type="button" className="tiny-button title-cancel-button" tabIndex={-1}>
          取消
        </button>
      </div>
    </div>
  )
}
