/**
 * 软件更新管理 hook — 提取自 App.tsx（D5 阶段）
 *
 * 管理 APK 更新检查和安装逻辑。
 */
import { useCallback, useState } from 'react'
import { checkForUpdate, type UpdateInfo } from '../services/app-update'
import { isCloudLoggedIn, getCloudServerUrl } from '../services/cloud-auth'

export interface UseUpdatesReturn {
  pendingUpdate: UpdateInfo | null
  showUpdateDialog: boolean
  updatingNow: boolean
  handleInstallUpdate: (blob: Blob, fileName: string) => Promise<void>
  handleManualUpdateCheck: () => Promise<void>
  /** 供 useCloudAuth 使用的更新发现回调 */
  onUpdateFound: (update: UpdateInfo) => void
  dismissUpdateDialog: () => void
}

export function useUpdates(): UseUpdatesReturn {
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updatingNow, setUpdatingNow] = useState(false)

  const handleInstallUpdate = useCallback(async (blob: Blob, fileName: string) => {
    setUpdatingNow(true)
    try {
      // Try native install path (Android/Capacitor)
      const bridge = (window as any).SkillRuntimePlugin
      if (bridge?.installApk) {
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        await bridge.installApk({ apkData: base64, fileName })
      } else {
        // Fallback: trigger browser download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      setShowUpdateDialog(false)
    } catch (err) {
      console.error('[update] Install failed', err)
    } finally {
      setUpdatingNow(false)
    }
  }, [])

  const handleManualUpdateCheck = useCallback(async () => {
    if (!isCloudLoggedIn()) return
    const update = await checkForUpdate(getCloudServerUrl())
    if (update) {
      setPendingUpdate(update)
      setShowUpdateDialog(true)
    } else {
      console.log('[update] No update available')
    }
  }, [])

  const onUpdateFound = useCallback((update: UpdateInfo) => {
    setPendingUpdate(update)
    setShowUpdateDialog(true)
  }, [])

  const dismissUpdateDialog = useCallback(() => {
    setShowUpdateDialog(false)
  }, [])

  return {
    pendingUpdate,
    showUpdateDialog,
    updatingNow,
    handleInstallUpdate,
    handleManualUpdateCheck,
    onUpdateFound,
    dismissUpdateDialog,
  }
}
