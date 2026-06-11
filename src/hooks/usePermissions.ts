/**
 * 权限管理 hook — 提取自 App.tsx（D6 阶段）
 *
 * 管理原生权限请求（位置、相机、麦克风、通知）。
 */
import { useCallback } from 'react'
import { useUIStore } from '../state/ui-store'
import { useSettingsStore } from '../state/settings-store'
import { ensureValidCurrentModelSelection } from '../utils/app-module'
import {
  requestLocationPermission,
  requestMediaPermission,
  requestNotificationPermission,
} from '../utils/app-module'
import { PERMISSION_LABELS, type AppPermissionKey } from '../state/types'

export interface UsePermissionsReturn {
  requestingPermissionByKey: Record<string, boolean>
  handlePermissionToggle: (key: AppPermissionKey, enabled: boolean) => Promise<void>
}

export function usePermissions(
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void,
): UsePermissionsReturn {
  const requestingPermissionByKey = useUIStore((s) => s.requestingPermissionByKey)
  const setRequestingPermissionByKey = useUIStore((s) => s.setRequestingPermissionByKey)

  const handlePermissionToggle = useCallback(
    async (key: AppPermissionKey, enabled: boolean): Promise<void> => {
      if (!enabled) {
        useSettingsStore.setState((prev) => ({
          settings: ensureValidCurrentModelSelection({
            ...prev.settings,
            permissionToggles: {
              ...prev.settings.permissionToggles,
              [key]: false,
            },
          }),
        }))
        return
      }

      setRequestingPermissionByKey((previous) => ({
        ...previous,
        [key]: true,
      }))
      try {
        const granted =
          key === 'location'
            ? await requestLocationPermission()
            : key === 'camera'
              ? await requestMediaPermission('camera')
              : key === 'microphone'
                ? await requestMediaPermission('microphone')
                : await requestNotificationPermission()
        if (!granted) {
          pushNotice(`${PERMISSION_LABELS[key]}权限未授予。请在系统设置中手动开启。`, 'error')
          useSettingsStore.setState((prev) => ({
            settings: ensureValidCurrentModelSelection({
              ...prev.settings,
              permissionToggles: {
                ...prev.settings.permissionToggles,
                [key]: false,
              },
            }),
          }))
          return
        }

        useSettingsStore.setState((prev) => ({
          settings: ensureValidCurrentModelSelection({
            ...prev.settings,
            permissionToggles: {
              ...prev.settings.permissionToggles,
              [key]: true,
            },
          }),
        }))
        pushNotice(`${PERMISSION_LABELS[key]}权限已开启。`, 'success')
      } finally {
        setRequestingPermissionByKey((previous) => ({
          ...previous,
          [key]: false,
        }))
      }
    },
    [pushNotice],
  )

  return {
    requestingPermissionByKey,
    handlePermissionToggle,
  }
}
