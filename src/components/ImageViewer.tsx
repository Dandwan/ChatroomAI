import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react'

export interface ImageViewerItem {
  key: string
  name: string
  dataUrl: string
}

interface ImageViewerProps {
  items: ImageViewerItem[]
  initialIndex: number
  visible: boolean
  onClose: () => void
}

interface Point {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

type GestureMode = 'none' | 'swipe' | 'pan' | 'pinch'

interface SinglePointerGesture {
  pointerId: number
  startX: number
  startY: number
  startTranslate: Point
  moved: boolean
  suppressTap: boolean
}

interface PinchGesture {
  startDistance: number
  startScale: number
  startTranslate: Point
}

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_DELAY_MS = 240
const DOUBLE_TAP_DISTANCE_PX = 24
const TAP_SLOP_PX = 10
const EDGE_RESISTANCE = 0.26
const NAVIGATION_ANIMATION_MS = 280
const BOUNCE_ANIMATION_MS = 220

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const getViewportSize = (): Size => ({
  width: typeof window === 'undefined' ? 0 : window.innerWidth,
  height: typeof window === 'undefined' ? 0 : window.innerHeight,
})

const getDistance = (first: Point, second: Point): number =>
  Math.hypot(second.x - first.x, second.y - first.y)

const getMidpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const getRelativeAnchor = (clientX: number, clientY: number, viewport: Size): Point => ({
  x: clientX - viewport.width / 2,
  y: clientY - viewport.height / 2,
})

const fitImageToViewport = (naturalSize: Size, viewport: Size): Size => {
  if (naturalSize.width <= 0 || naturalSize.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return viewport
  }

  const imageRatio = naturalSize.width / naturalSize.height
  const viewportRatio = viewport.width / viewport.height
  if (imageRatio > viewportRatio) {
    return {
      width: viewport.width,
      height: viewport.width / imageRatio,
    }
  }

  return {
    width: viewport.height * imageRatio,
    height: viewport.height,
  }
}

const clampTranslate = (
  translate: Point,
  scale: number,
  naturalSize: Size | null,
  viewport: Size,
): Point => {
  if (scale <= 1.001 || !naturalSize || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0 }
  }

  const fittedSize = fitImageToViewport(naturalSize, viewport)
  const maxX = Math.max((fittedSize.width * scale - viewport.width) / 2, 0)
  const maxY = Math.max((fittedSize.height * scale - viewport.height) / 2, 0)

  return {
    x: clamp(translate.x, -maxX, maxX),
    y: clamp(translate.y, -maxY, maxY),
  }
}

const applyZoomAtAnchor = (
  currentScale: number,
  currentTranslate: Point,
  nextScale: number,
  anchor: Point,
  naturalSize: Size | null,
  viewport: Size,
): Point => {
  if (nextScale <= 1.001) {
    return { x: 0, y: 0 }
  }

  const rawTranslate = {
    x: anchor.x - ((anchor.x - currentTranslate.x) / currentScale) * nextScale,
    y: anchor.y - ((anchor.y - currentTranslate.y) / currentScale) * nextScale,
  }

  return clampTranslate(rawTranslate, nextScale, naturalSize, viewport)
}

const ImageViewer = ({ items, initialIndex, visible, onClose }: ImageViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(() =>
    clamp(initialIndex, 0, Math.max(items.length - 1, 0)),
  )
  const [viewport, setViewport] = useState<Size>(() => getViewportSize())
  const [naturalSizeByKey, setNaturalSizeByKey] = useState<Record<string, Size>>({})
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 })
  const [swipeOffsetX, setSwipeOffsetX] = useState(0)
  const [trackAnimating, setTrackAnimating] = useState(false)
  const [imageAnimating, setImageAnimating] = useState(true)

  const scaleRef = useRef(1)
  const translateRef = useRef<Point>({ x: 0, y: 0 })
  const pointerPositionsRef = useRef<Map<number, Point>>(new Map())
  const gestureModeRef = useRef<GestureMode>('none')
  const singlePointerGestureRef = useRef<SinglePointerGesture | null>(null)
  const pinchGestureRef = useRef<PinchGesture | null>(null)
  const tapCloseTimerRef = useRef<number | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const navigationTimerRef = useRef<number | null>(null)
  const bounceTimerRef = useRef<number | null>(null)

  const currentItem = items[currentIndex] ?? null
  const currentNaturalSize = currentItem ? naturalSizeByKey[currentItem.key] ?? null : null

  const updateTransform = useCallback((nextScale: number, nextTranslate: Point, animated: boolean): void => {
    scaleRef.current = nextScale
    translateRef.current = nextTranslate
    setImageAnimating(animated)
    setScale(nextScale)
    setTranslate(nextTranslate)
  }, [])

  const resetTransform = useCallback(
    (animated: boolean): void => {
      updateTransform(1, { x: 0, y: 0 }, animated)
    },
    [updateTransform],
  )

  const clearTapCloseTimer = useCallback((): void => {
    if (tapCloseTimerRef.current !== null) {
      window.clearTimeout(tapCloseTimerRef.current)
      tapCloseTimerRef.current = null
    }
  }, [])

  const clearNavigationTimer = useCallback((): void => {
    if (navigationTimerRef.current !== null) {
      window.clearTimeout(navigationTimerRef.current)
      navigationTimerRef.current = null
    }
  }, [])

  const clearBounceTimer = useCallback((): void => {
    if (bounceTimerRef.current !== null) {
      window.clearTimeout(bounceTimerRef.current)
      bounceTimerRef.current = null
    }
  }, [])

  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < items.length - 1

  const clampCurrentTranslate = useCallback(
    (nextTranslate: Point, nextScale: number): Point =>
      clampTranslate(nextTranslate, nextScale, currentNaturalSize, viewport),
    [currentNaturalSize, viewport],
  )

  const handleToggleZoom = useCallback(
    (clientX: number, clientY: number): void => {
      clearTapCloseTimer()
      clearBounceTimer()
      clearNavigationTimer()
      setTrackAnimating(false)
      const nextScale = scaleRef.current > 1.001 ? 1 : DOUBLE_TAP_SCALE
      const anchor = getRelativeAnchor(clientX, clientY, viewport)
      const nextTranslate =
        nextScale <= 1.001
          ? { x: 0, y: 0 }
          : applyZoomAtAnchor(
              scaleRef.current,
              translateRef.current,
              nextScale,
              anchor,
              currentNaturalSize,
              viewport,
            )
      updateTransform(nextScale, nextTranslate, true)
    },
    [clearBounceTimer, clearNavigationTimer, clearTapCloseTimer, currentNaturalSize, updateTransform, viewport],
  )

  const scheduleTapAction = useCallback(
    (clientX: number, clientY: number): void => {
      const now = Date.now()
      const lastTap = lastTapRef.current
      if (
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_DELAY_MS &&
        Math.hypot(clientX - lastTap.x, clientY - lastTap.y) <= DOUBLE_TAP_DISTANCE_PX
      ) {
        lastTapRef.current = null
        clearTapCloseTimer()
        handleToggleZoom(clientX, clientY)
        return
      }

      lastTapRef.current = { time: now, x: clientX, y: clientY }
      clearTapCloseTimer()
      tapCloseTimerRef.current = window.setTimeout(() => {
        tapCloseTimerRef.current = null
        lastTapRef.current = null
        onClose()
      }, DOUBLE_TAP_DELAY_MS)
    },
    [clearTapCloseTimer, handleToggleZoom, onClose],
  )

  const resetInteractionState = useCallback((): void => {
    pointerPositionsRef.current.clear()
    gestureModeRef.current = 'none'
    singlePointerGestureRef.current = null
    pinchGestureRef.current = null
  }, [])

  const snapBackTrack = useCallback((): void => {
    clearNavigationTimer()
    clearBounceTimer()
    setTrackAnimating(true)
    setSwipeOffsetX(0)
    bounceTimerRef.current = window.setTimeout(() => {
      bounceTimerRef.current = null
      setTrackAnimating(false)
    }, BOUNCE_ANIMATION_MS)
  }, [clearBounceTimer, clearNavigationTimer])

  const animateEdgeBounce = useCallback(
    (direction: -1 | 1): void => {
      clearNavigationTimer()
      clearBounceTimer()
      setTrackAnimating(true)
      setSwipeOffsetX(direction * 56)
      bounceTimerRef.current = window.setTimeout(() => {
        bounceTimerRef.current = null
        setSwipeOffsetX(0)
        bounceTimerRef.current = window.setTimeout(() => {
          bounceTimerRef.current = null
          setTrackAnimating(false)
        }, BOUNCE_ANIMATION_MS)
      }, 60)
    },
    [clearBounceTimer, clearNavigationTimer],
  )

  const navigateBy = useCallback(
    (direction: -1 | 1): void => {
      if (trackAnimating || items.length <= 1) {
        return
      }

      const nextIndex = currentIndex + direction
      if (nextIndex < 0 || nextIndex >= items.length) {
        animateEdgeBounce(direction === -1 ? 1 : -1)
        return
      }

      clearTapCloseTimer()
      clearNavigationTimer()
      clearBounceTimer()
      setTrackAnimating(true)
      setSwipeOffsetX(direction === 1 ? -viewport.width : viewport.width)
      navigationTimerRef.current = window.setTimeout(() => {
        navigationTimerRef.current = null
        setTrackAnimating(false)
        setSwipeOffsetX(0)
        setCurrentIndex(nextIndex)
      }, NAVIGATION_ANIMATION_MS)
    },
    [
      animateEdgeBounce,
      clearBounceTimer,
      clearNavigationTimer,
      clearTapCloseTimer,
      currentIndex,
      items.length,
      trackAnimating,
      viewport.width,
    ],
  )

  const slides = useMemo(
    () => [
      {
        slotKey: currentIndex > 0 ? `prev-${items[currentIndex - 1]?.key}` : 'prev-empty',
        item: currentIndex > 0 ? items[currentIndex - 1] : null,
      },
      {
        slotKey: currentItem ? `current-${currentItem.key}` : 'current-empty',
        item: currentItem,
      },
      {
        slotKey: currentIndex < items.length - 1 ? `next-${items[currentIndex + 1]?.key}` : 'next-empty',
        item: currentIndex < items.length - 1 ? items[currentIndex + 1] : null,
      },
    ],
    [currentIndex, currentItem, items],
  )

  useEffect(() => {
    setCurrentIndex(clamp(initialIndex, 0, Math.max(items.length - 1, 0)))
  }, [initialIndex, items])

  useEffect(() => {
    const handleResize = (): void => {
      setViewport(getViewportSize())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    clearTapCloseTimer()
    clearNavigationTimer()
    clearBounceTimer()
    resetInteractionState()
    setTrackAnimating(false)
    setSwipeOffsetX(0)
    resetTransform(false)
  }, [
    clearBounceTimer,
    clearNavigationTimer,
    clearTapCloseTimer,
    currentItem?.key,
    resetInteractionState,
    resetTransform,
  ])

  useEffect(() => {
    if (scaleRef.current <= 1.001) {
      return
    }
    updateTransform(scaleRef.current, clampCurrentTranslate(translateRef.current, scaleRef.current), true)
  }, [clampCurrentTranslate, updateTransform, viewport])

  useEffect(
    () => () => {
      clearTapCloseTimer()
      clearNavigationTimer()
      clearBounceTimer()
    },
    [clearBounceTimer, clearNavigationTimer, clearTapCloseTimer],
  )

  useEffect(() => {
    if (!visible) {
      clearTapCloseTimer()
    }
  }, [clearTapCloseTimer, visible])

  useEffect(() => {
    if (!visible) {
      return undefined
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        navigateBy(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        navigateBy(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigateBy, onClose, visible])

  const beginSinglePointerGesture = useCallback(
    (pointerId: number, point: Point, suppressTap = false): void => {
      singlePointerGestureRef.current = {
        pointerId,
        startX: point.x,
        startY: point.y,
        startTranslate: translateRef.current,
        moved: false,
        suppressTap,
      }
      gestureModeRef.current = scaleRef.current > 1.001 ? 'pan' : 'swipe'
    },
    [],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!currentItem) {
        return
      }

      clearTapCloseTimer()
      clearNavigationTimer()
      clearBounceTimer()

      const point = { x: event.clientX, y: event.clientY }
      pointerPositionsRef.current.set(event.pointerId, point)
      event.currentTarget.setPointerCapture(event.pointerId)

      if (pointerPositionsRef.current.size >= 2) {
        const [first, second] = Array.from(pointerPositionsRef.current.values())
        if (!first || !second) {
          return
        }
        gestureModeRef.current = 'pinch'
        singlePointerGestureRef.current = null
        pinchGestureRef.current = {
          startDistance: Math.max(getDistance(first, second), 1),
          startScale: scaleRef.current,
          startTranslate: translateRef.current,
        }
        setTrackAnimating(false)
        setImageAnimating(false)
        return
      }

      beginSinglePointerGesture(event.pointerId, point)
      setTrackAnimating(false)
      setImageAnimating(false)
    },
    [
      beginSinglePointerGesture,
      clearBounceTimer,
      clearNavigationTimer,
      clearTapCloseTimer,
      currentItem,
    ],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const updatedPoint = { x: event.clientX, y: event.clientY }
      pointerPositionsRef.current.set(event.pointerId, updatedPoint)

      if (gestureModeRef.current === 'pinch') {
        const [first, second] = Array.from(pointerPositionsRef.current.values())
        const pinchGesture = pinchGestureRef.current
        if (!first || !second || !pinchGesture) {
          return
        }

        const nextScale = clamp(
          pinchGesture.startScale * (getDistance(first, second) / pinchGesture.startDistance),
          1,
          MAX_SCALE,
        )
        const midpoint = getMidpoint(first, second)
        const nextTranslate = applyZoomAtAnchor(
          pinchGesture.startScale,
          pinchGesture.startTranslate,
          nextScale,
          getRelativeAnchor(midpoint.x, midpoint.y, viewport),
          currentNaturalSize,
          viewport,
        )
        updateTransform(nextScale, nextTranslate, false)
        return
      }

      const gesture = singlePointerGestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) {
        return
      }

      const deltaX = updatedPoint.x - gesture.startX
      const deltaY = updatedPoint.y - gesture.startY
      if (Math.abs(deltaX) > TAP_SLOP_PX || Math.abs(deltaY) > TAP_SLOP_PX) {
        gesture.moved = true
      }

      if (gestureModeRef.current === 'pan') {
        const nextTranslate = clampCurrentTranslate(
          {
            x: gesture.startTranslate.x + deltaX,
            y: gesture.startTranslate.y + deltaY,
          },
          scaleRef.current,
        )
        updateTransform(scaleRef.current, nextTranslate, false)
        return
      }

      if (gestureModeRef.current !== 'swipe') {
        return
      }

      if (Math.abs(deltaX) < Math.abs(deltaY) && Math.abs(deltaY) > TAP_SLOP_PX) {
        setSwipeOffsetX(0)
        return
      }

      const atEdge = (deltaX > 0 && !canGoPrevious) || (deltaX < 0 && !canGoNext)
      setSwipeOffsetX(atEdge ? deltaX * EDGE_RESISTANCE : deltaX)
    },
    [canGoNext, canGoPrevious, clampCurrentTranslate, currentNaturalSize, updateTransform, viewport],
  )

  const endSinglePointerGesture = useCallback(
    (point: Point, triggerTap: boolean): void => {
      const gesture = singlePointerGestureRef.current
      if (!gesture) {
        return
      }

      if (gestureModeRef.current === 'pan') {
        if (triggerTap && !gesture.moved && !gesture.suppressTap) {
          scheduleTapAction(point.x, point.y)
        } else {
          updateTransform(scaleRef.current, clampCurrentTranslate(translateRef.current, scaleRef.current), true)
        }
        return
      }

      if (gestureModeRef.current === 'swipe') {
        if (triggerTap && !gesture.moved && !gesture.suppressTap) {
          scheduleTapAction(point.x, point.y)
          return
        }

        const threshold = Math.min(120, viewport.width * 0.18)
        if (Math.abs(swipeOffsetX) >= threshold) {
          navigateBy(swipeOffsetX < 0 ? 1 : -1)
          return
        }

        snapBackTrack()
      }
    },
    [
      clampCurrentTranslate,
      navigateBy,
      scheduleTapAction,
      snapBackTrack,
      swipeOffsetX,
      updateTransform,
      viewport.width,
    ],
  )

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, triggerTap: boolean): void => {
      pointerPositionsRef.current.delete(event.pointerId)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      if (gestureModeRef.current === 'pinch') {
        pinchGestureRef.current = null
        if (pointerPositionsRef.current.size === 1) {
          const [pointerId, point] = Array.from(pointerPositionsRef.current.entries())[0] ?? []
          if (typeof pointerId === 'number' && point) {
            beginSinglePointerGesture(pointerId, point, true)
            return
          }
        }
        gestureModeRef.current = 'none'
        return
      }

      const point = { x: event.clientX, y: event.clientY }
      if (singlePointerGestureRef.current?.pointerId === event.pointerId) {
        endSinglePointerGesture(point, triggerTap)
        singlePointerGestureRef.current = null
      }
      gestureModeRef.current = 'none'
    },
    [beginSinglePointerGesture, endSinglePointerGesture],
  )

  const handleImageLoad = useCallback((itemKey: string, event: SyntheticEvent<HTMLImageElement>): void => {
    const element = event.currentTarget
    const nextSize = {
      width: element.naturalWidth,
      height: element.naturalHeight,
    }
    if (nextSize.width <= 0 || nextSize.height <= 0) {
      return
    }
    setNaturalSizeByKey((previous) => {
      const existing = previous[itemKey]
      if (existing && existing.width === nextSize.width && existing.height === nextSize.height) {
        return previous
      }
      return {
        ...previous,
        [itemKey]: nextSize,
      }
    })
  }, [])

  if (!currentItem) {
    return null
  }

  return (
    <div className={`image-viewer-overlay ${visible ? 'is-open' : 'is-closing'}`}>
      <div
        className={`image-viewer-stage ${scale > 1.001 ? 'is-zoomed' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => handlePointerEnd(event, true)}
        onPointerCancel={(event) => handlePointerEnd(event, false)}
      >
        <div
          className={`image-viewer-track ${trackAnimating ? 'is-animating' : ''}`}
          style={{
            width: `${viewport.width * 3}px`,
            transform: `translate3d(${swipeOffsetX - viewport.width}px, 0, 0)`,
          }}
        >
          {slides.map((slide, index) => {
            const isCurrent = index === 1
            return (
              <div
                key={slide.slotKey}
                className={`image-viewer-slide ${isCurrent ? 'is-current' : ''}`}
                style={{ width: `${viewport.width}px` }}
              >
                {slide.item ? (
                  <div className={`image-viewer-media-shell ${isCurrent ? 'is-current' : ''}`}>
                    <div
                      className={`image-viewer-media ${isCurrent && !imageAnimating ? 'is-interacting' : ''}`}
                      style={
                        isCurrent
                          ? {
                              transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
                            }
                          : undefined
                      }
                    >
                      <img
                        src={slide.item.dataUrl}
                        alt={slide.item.name}
                        draggable={false}
                        onLoad={(event) => handleImageLoad(slide.item!.key, event)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default memo(ImageViewer)
