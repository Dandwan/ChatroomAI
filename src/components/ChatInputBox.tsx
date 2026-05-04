import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react'

type ChatInputRadiusMode = 'auto' | 'card' | 'pill'
const HEIGHT_TRANSITION_MS = 160
const PILL_RADIUS_EXTRA_PX = 12

export interface ChatInputBoxProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  minHeight?: number
  maxHeight?: number
  radiusMode?: ChatInputRadiusMode
}

const assignRef = <T,>(ref: Ref<T> | undefined, value: T): void => {
  if (!ref) {
    return
  }
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ref.current = value
}

const resolvePillRadius = (height: number, cardRadius: number): number =>
  Math.max(cardRadius, Math.min(height / 2, cardRadius + PILL_RADIUS_EXTRA_PX))

const resolveRadius = (
  mode: ChatInputRadiusMode,
  multiline: boolean,
  height: number,
  cardRadius: number,
): string => {
  const pillRadius = resolvePillRadius(height, cardRadius)
  if (mode === 'card') {
    return `${cardRadius}px`
  }
  if (mode === 'pill') {
    return `${pillRadius}px`
  }
  return multiline ? `${cardRadius}px` : `${pillRadius}px`
}

const ChatInputBox = forwardRef<HTMLTextAreaElement, ChatInputBoxProps>(function ChatInputBox(
  {
    className,
    maxHeight = 188,
    minHeight,
    radiusMode = 'auto',
    style,
    value,
    ...props
  },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const resizeAnimationFrameRef = useRef<number | null>(null)
  const radiusTimeoutRef = useRef<number | null>(null)
  const wasMultilineRef = useRef(false)

  const clearRadiusTimeout = useCallback((): void => {
    if (radiusTimeoutRef.current !== null) {
      window.clearTimeout(radiusTimeoutRef.current)
      radiusTimeoutRef.current = null
    }
  }, [])

  const syncLayout = useCallback((): void => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const currentHeight = textarea.getBoundingClientRect().height
    textarea.style.height = 'auto'

    const computedStyle = window.getComputedStyle(textarea)
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0
    const borderTopWidth = Number.parseFloat(computedStyle.borderTopWidth) || 0
    const borderBottomWidth = Number.parseFloat(computedStyle.borderBottomWidth) || 0
    const singleLineHeight =
      lineHeight + paddingTop + paddingBottom + borderTopWidth + borderBottomWidth
    const minimumHeight = Math.max(
      minHeight ?? 0,
      Number.parseFloat(computedStyle.minHeight) || singleLineHeight,
    )
    const contentHeight = textarea.scrollHeight
    const nextHeight = Math.max(minimumHeight, Math.min(contentHeight, maxHeight))
    const cardRadius =
      Number.parseFloat(computedStyle.getPropertyValue('--radius-card')) || minimumHeight / 2
    const multiline = contentHeight > minimumHeight + 1
    const shouldAnimateHeight = Math.abs(currentHeight - nextHeight) > 0.5 && currentHeight > 0
    const shouldMorphIntoCard =
      radiusMode === 'auto' &&
      multiline &&
      shouldAnimateHeight &&
      (!wasMultilineRef.current || radiusTimeoutRef.current !== null)

    clearRadiusTimeout()
    if (shouldMorphIntoCard) {
      textarea.style.setProperty(
        '--chat-input-radius',
        `${resolvePillRadius(nextHeight, cardRadius)}px`,
      )
      radiusTimeoutRef.current = window.setTimeout(() => {
        const currentTextarea = textareaRef.current
        if (!currentTextarea) {
          return
        }
        currentTextarea.style.setProperty('--chat-input-radius', `${cardRadius}px`)
        radiusTimeoutRef.current = null
      }, HEIGHT_TRANSITION_MS)
    } else {
      textarea.style.setProperty(
        '--chat-input-radius',
        resolveRadius(radiusMode, multiline, nextHeight, cardRadius),
      )
    }
    textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden'

    if (resizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeAnimationFrameRef.current)
      resizeAnimationFrameRef.current = null
    }

    if (shouldAnimateHeight) {
      textarea.style.height = `${currentHeight}px`
      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        textarea.style.height = `${nextHeight}px`
        resizeAnimationFrameRef.current = null
      })
      wasMultilineRef.current = multiline
      return
    }

    textarea.style.height = `${nextHeight}px`
    wasMultilineRef.current = multiline
  }, [clearRadiusTimeout, maxHeight, minHeight, radiusMode])

  useLayoutEffect(() => {
    syncLayout()
  }, [syncLayout, value])

  useEffect(() => {
    const handleResize = (): void => {
      syncLayout()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
      }
      clearRadiusTimeout()
    }
  }, [clearRadiusTimeout, syncLayout])

  return (
    <textarea
      {...props}
      ref={(node) => {
        textareaRef.current = node
        assignRef(forwardedRef, node)
      }}
      rows={1}
      className={className}
      value={value}
      style={style}
    />
  )
})

export default ChatInputBox
