import { useEffect, useState } from 'react'
import {
  isCloudLoggedIn,
  getCloudServerUrl,
  deactivateCloudAuth,
  verifyCloudAuth,
  tryAutoLogin,
  hasStoredCredentials,
} from '../services/cloud-auth'
import { checkForUpdate, isUpdateDismissed, type UpdateInfo } from '../services/app-update'

export interface UseCloudAuthOptions {
  /** Whether user has any configured providers (with otherProvidersEnabled on) */
  hasOtherProviders: boolean
  /** Whether we're on the homepage empty state */
  isHomepageEmptyState: boolean
  /** Callback when auto-login succeeds (to trigger update check in App) */
  onAutoLoginSuccess?: () => void
  /** Callback when auto-login succeeds - returns update info if available */
  onUpdateFound?: (update: UpdateInfo) => void
}

export interface UseCloudAuthReturn {
  cloudLoggedIn: boolean
  cloudAuthMode: 'none' | 'login' | 'register'
  setCloudAuthMode: (mode: 'none' | 'login' | 'register') => void
  showCloudAuthOnHomepage: boolean
  isCloudAuthRegisterMode: boolean
  /** Force refresh counter — bump after async auth changes so cloudLoggedIn re-reads localStorage */
  setAuthVersion: React.Dispatch<React.SetStateAction<number>>
}

export function useCloudAuth(options: UseCloudAuthOptions): UseCloudAuthReturn {
  const { hasOtherProviders, isHomepageEmptyState, onAutoLoginSuccess, onUpdateFound } = options

  const [cloudAuthMode, setCloudAuthMode] = useState<'none' | 'login' | 'register'>('none')

  // Force-refresh counter: when localStorage auth state is modified asynchronously
  // (verifyCloudAuth/deactivateCloudAuth/tryAutoLogin), bump this to trigger re-render
  // so that cloudLoggedIn = isCloudLoggedIn() re-reads from localStorage.
  const [_authVersion, setAuthVersion] = useState(0)
  void _authVersion // suppress unused warning — used only for re-render triggering

  // ── Startup: verify ActiNet connectivity or auto-login ──
  useEffect(() => {
    let cancelled = false

    if (isCloudLoggedIn()) {
      void verifyCloudAuth().then((valid) => {
        if (cancelled) return
        if (!valid) {
          console.warn('[actinet] Startup connectivity check failed — deactivating auth (credentials preserved)')
          deactivateCloudAuth()
          setAuthVersion(v => v + 1)
        }
      })
    } else if (hasStoredCredentials()) {
      void tryAutoLogin().then((success) => {
        if (cancelled) return
        if (success) {
          console.log('[actinet] Auto-login succeeded')
          setCloudAuthMode('none')
          setAuthVersion(v => v + 1)
          onAutoLoginSuccess?.()
          void checkForUpdate(getCloudServerUrl()).then((update) => {
            if (update && !isUpdateDismissed(update.version_code)) {
              onUpdateFound?.(update)
            }
          })
        }
      })
    }

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount

  const cloudLoggedIn = isCloudLoggedIn()

  const showCloudAuthOnHomepage =
    isHomepageEmptyState &&
    ((!cloudLoggedIn && !hasOtherProviders) || cloudAuthMode !== 'none')

  const isCloudAuthRegisterMode = cloudAuthMode === 'register'

  return {
    cloudLoggedIn,
    cloudAuthMode,
    setCloudAuthMode,
    showCloudAuthOnHomepage,
    isCloudAuthRegisterMode,
    setAuthVersion,
  }
}
