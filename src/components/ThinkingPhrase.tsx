import { useState, useEffect, useMemo, useRef } from 'react'

interface ThinkingPhraseProps {
  createdAt: number
}

// ── Phrase pools ──
const SHORT_PHRASES = ['烧烤中🤯', '思考更多🤔🤔🤔', '头脑风暴中🤯'] as const

const LONG_PHRASES = [
  '正在创造奇迹',
  '正在斟酌用词',
  '正在发表演讲',
  '正在驾驶航空母舰',
  '正在研发核聚变',
  '正在发表SCI',
  '正在领取诺贝尔奖',
  '正在构建智能世界',
  '正在发动星际殖民',
] as const

// ── Color stops in HSL ──
const GRAY_HSL = { h: 212, s: 18, l: 65 }   // #94a3b8
const YELLOW_HSL = { h: 48, s: 96, l: 48 }   // #eab308
const ORANGE_HSL = { h: 24, s: 95, l: 53 }   // #f97316

// ── Time brackets (seconds) ──
const GRAY_TO_YELLOW_START = 10
const GRAY_TO_YELLOW_END = 15
const YELLOW_TO_ORANGE_START = 25
const YELLOW_TO_ORANGE_END = 30
const SHORT_PHRASE_INTERVAL = 5
const LONG_PHRASE_INTERVAL = 15

interface HSL {
  h: number
  s: number
  l: number
}

/** Linear interpolation between two HSL colors */
function lerpHsl(a: HSL, b: HSL, t: number): HSL {
  return {
    h: a.h + (b.h - a.h) * t,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  }
}

function hslToCss(hsl: HSL): string {
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`
}

/** Pick a random phrase different from the current one when possible */
function pickNext<T>(pool: readonly T[], current: T): T {
  if (pool.length <= 1) {
    return pool[0]
  }
  const filtered = pool.filter((p) => p !== current)
  return filtered[Math.floor(Math.random() * filtered.length)]
}

function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function ThinkingPhrase({ createdAt }: ThinkingPhraseProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - createdAt) / 1000)),
  )

  // Track the last phrase index to avoid repeats on rotation
  const lastShortRef = useRef<string>(pickRandom(SHORT_PHRASES))
  const lastLongRef = useRef<string>(pickRandom(LONG_PHRASES))
  const [phrase, setPhrase] = useState<string>(
    elapsedSeconds < GRAY_TO_YELLOW_START ? '思考中🤔' : lastShortRef.current,
  )
  // Track which rotation bucket we're in so we only rotate at intervals
  const shortBucketRef = useRef<number>(Math.floor(elapsedSeconds / SHORT_PHRASE_INTERVAL))
  const longBucketRef = useRef<number>(Math.floor(elapsedSeconds / LONG_PHRASE_INTERVAL))

  // ── Elapsed timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - createdAt) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [createdAt])

  // ── Phrase rotation ──
  useEffect(() => {
    if (elapsedSeconds < GRAY_TO_YELLOW_START) {
      setPhrase('思考中🤔')
      return
    }

    if (elapsedSeconds < YELLOW_TO_ORANGE_START) {
      const bucket = Math.floor(elapsedSeconds / SHORT_PHRASE_INTERVAL)
      if (bucket !== shortBucketRef.current) {
        shortBucketRef.current = bucket
        lastShortRef.current = pickNext(SHORT_PHRASES, lastShortRef.current)
        setPhrase(lastShortRef.current)
      }
      return
    }

    // 25s+
    const bucket = Math.floor(elapsedSeconds / LONG_PHRASE_INTERVAL)
    if (bucket !== longBucketRef.current) {
      longBucketRef.current = bucket
      lastLongRef.current = pickNext(LONG_PHRASES, lastLongRef.current)
      setPhrase(lastLongRef.current)
    }
  }, [elapsedSeconds])

  // ── Color computation ──
  const color = useMemo(() => {
    if (elapsedSeconds < GRAY_TO_YELLOW_START) {
      return hslToCss(GRAY_HSL)
    }

    if (elapsedSeconds < GRAY_TO_YELLOW_END) {
      // 10-15s: gray → yellow
      const t = (elapsedSeconds - GRAY_TO_YELLOW_START) / (GRAY_TO_YELLOW_END - GRAY_TO_YELLOW_START)
      return hslToCss(lerpHsl(GRAY_HSL, YELLOW_HSL, Math.min(1, t)))
    }

    if (elapsedSeconds < YELLOW_TO_ORANGE_START) {
      // 15-25s: solid yellow
      return hslToCss(YELLOW_HSL)
    }

    if (elapsedSeconds < YELLOW_TO_ORANGE_END) {
      // 25-30s: yellow → orange
      const t = (elapsedSeconds - YELLOW_TO_ORANGE_START) / (YELLOW_TO_ORANGE_END - YELLOW_TO_ORANGE_START)
      return hslToCss(lerpHsl(YELLOW_HSL, ORANGE_HSL, Math.min(1, t)))
    }

    // 30s+: solid orange
    return hslToCss(ORANGE_HSL)
  }, [elapsedSeconds])

  return (
    <div className="thinking-phrase" aria-label="模型输出中" style={{ color }}>
      {phrase}
    </div>
  )
}
