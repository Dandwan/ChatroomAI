/**
 * Read the current app's version information.
 * On Android/Capacitor, this reads from the native bridge.
 * On web/development, it falls back to the build-injected constants.
 */

// Version info is injected at build time by Vite define
declare const __APP_VERSION__: string | undefined
declare const __APP_VERSION_CODE__: number | undefined

interface AppVersionInfo {
  versionName: string
  versionCode: number
}

/** Read from Capacitor plugin via native bridge (if available). */
async function getNativeVersion(): Promise<AppVersionInfo | null> {
  try {
    const bridge = (window as any).SkillRuntimePlugin
    if (bridge?.getVersionCode) {
      const result = await bridge.getVersionCode()
      if (result?.versionCode) {
        return {
          versionName: result.versionName ?? String(result.versionCode),
          versionCode: result.versionCode,
        }
      }
    }
  } catch {
    // Native bridge not available — expected in web dev
  }
  return null
}

/** Cached version info — resolved once on startup. */
let cachedVersion: AppVersionInfo | null = null

export async function getAppVersion(): Promise<AppVersionInfo> {
  if (cachedVersion) return cachedVersion

  // Try native (Capacitor/Android) first
  const native = await getNativeVersion()
  if (native) {
    cachedVersion = native
    return native
  }

  // Fallback to build-injected constants
  const versionName =
    typeof __APP_VERSION__ === 'string' && __APP_VERSION__ !== 'undefined'
      ? __APP_VERSION__
      : '1.5.0'

  const versionCode =
    typeof __APP_VERSION_CODE__ === 'number' && !isNaN(__APP_VERSION_CODE__)
      ? __APP_VERSION_CODE__
      : 1500

  cachedVersion = { versionName, versionCode }
  return cachedVersion
}

/**
 * Convert version_code (integer) to version_name string.
 * e.g. 1500 → "1.5.0"
 */
export function versionCodeToName(code: number): string {
  const major = Math.floor(code / 1000)
  const minor = Math.floor((code % 1000) / 100)
  const patch = code % 100
  return `${major}.${minor}.${patch}`
}

export function versionNameToCode(name: string): number {
  const parts = name.split('.').map(Number)
  if (parts.length < 2 || parts.some(isNaN)) return 0
  const [major = 0, minor = 0, patch = 0] = parts
  return major * 1000 + minor * 100 + patch
}
