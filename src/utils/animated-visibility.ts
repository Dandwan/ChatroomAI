import { useCallback, useEffect, useRef, useState } from 'react'

export interface AnimatedVisibility {
  mounted: boolean
  visible: boolean
  open: () => void
  close: () => void
}

export const useAnimatedVisibility = (durationMs: number): AnimatedVisibility => {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const open = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setMounted(true)
    window.requestAnimationFrame(() => setVisible(true))
  }, [])

  const close = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setVisible(false)
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      closeTimerRef.current = null
    }, durationMs)
  }, [durationMs])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  return { mounted, visible, open, close }
}
