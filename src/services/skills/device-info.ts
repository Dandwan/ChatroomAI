import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { nativeGetLastKnownLocation } from './native-runtime'
import type { SkillCallAction, SkillExecutionResult } from './types'

const DEFAULT_LOCATION_TIMEOUT_MS = 5000

const parseFlag = (argv: string[], flag: string): boolean => argv.includes(flag)

const parseNumberOption = (argv: string[], option: string): number | undefined => {
  const index = argv.indexOf(option)
  if (index === -1) {
    return undefined
  }
  const raw = argv[index + 1]
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed)) {
    return undefined
  }
  return parsed
}

const readOrientation = (): Record<string, unknown> => {
  if (typeof window === 'undefined') {
    return {
      available: false,
      reason: 'window-unavailable',
    }
  }

  const orientation = window.screen?.orientation
  return {
    available: Boolean(orientation),
    type: orientation?.type ?? null,
    angle: typeof orientation?.angle === 'number' ? orientation.angle : null,
  }
}

const readLocation = async (timeoutMs: number): Promise<Record<string, unknown>> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: Math.max(500, timeoutMs),
        maximumAge: 10_000,
      })
      return {
        available: true,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
        provider: 'capacitor-geolocation',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      try {
        const fallback = await nativeGetLastKnownLocation()
        if (fallback.available) {
          return {
            ...fallback,
            provider: fallback.provider ?? 'native-last-known-location',
            source: 'native-fallback',
          }
        }
      } catch {
        // Keep primary geolocation failure details when native fallback is unavailable.
      }
      return {
        available: false,
        reason: message || 'location-unavailable',
        provider: 'capacitor-geolocation',
      }
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      available: false,
      reason: 'geolocation-unavailable',
    }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          available: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        resolve({
          available: false,
          reason: error.message || 'location-unavailable',
          code: error.code,
        })
      },
      {
        enableHighAccuracy: false,
        timeout: Math.max(500, timeoutMs),
        maximumAge: 5000,
      },
    )
  })
}

export const executeDeviceInfoSkillCall = async (
  action: SkillCallAction,
): Promise<SkillExecutionResult> => {
  const startedAt = Date.now()
  const argv = action.argv ?? []
  const includeLocation = !parseFlag(argv, '--no-location')
  const includeOrientation = !parseFlag(argv, '--no-orientation')
  const locationTimeoutMs = parseNumberOption(argv, '--location-timeout-ms') ?? DEFAULT_LOCATION_TIMEOUT_MS

  const now = new Date()
  const payload: Record<string, unknown> = {
    skill: action.skill,
    script: action.script,
    systemTime: {
      epochMs: now.getTime(),
      iso: now.toISOString(),
      locale: now.toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      timezoneOffsetMinutes: now.getTimezoneOffset(),
    },
    device: {
      userAgent:
        typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
          ? navigator.userAgent
          : null,
      platform:
        typeof navigator !== 'undefined' && typeof navigator.platform === 'string'
          ? navigator.platform
          : null,
      language:
        typeof navigator !== 'undefined' && typeof navigator.language === 'string'
          ? navigator.language
          : null,
      languages: typeof navigator !== 'undefined' && Array.isArray(navigator.languages) ? navigator.languages : [],
      viewport:
        typeof window !== 'undefined'
          ? {
              width: window.innerWidth,
              height: window.innerHeight,
            }
          : null,
      screen:
        typeof window !== 'undefined'
          ? {
              width: window.screen?.width ?? null,
              height: window.screen?.height ?? null,
              pixelRatio: window.devicePixelRatio ?? 1,
            }
          : null,
    },
  }

  payload.orientation = includeOrientation
    ? readOrientation()
    : {
        available: false,
        reason: 'disabled-by-argv',
      }

  payload.location = includeLocation
    ? await readLocation(locationTimeoutMs)
    : {
        available: false,
        reason: 'disabled-by-argv',
      }

  return {
    ok: true,
    stdout: JSON.stringify(payload),
    stderr: '',
    exitCode: 0,
    elapsedMs: Date.now() - startedAt,
    resolvedCommand: [action.skill, action.script],
    inferredRuntime: 'native',
  }
}
