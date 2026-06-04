import type { ProviderModel } from '../state/types'

const STORAGE_KEY = 'actichat_actinet_models'

export const DEFAULT_ACTINET_MODELS: ProviderModel[] = [
  { id: '快速', enabled: true },
  { id: '专家', enabled: true },
]

interface ActiNetModelPreferences {
  models: ProviderModel[]
  lastFetchedAt: number
}

/** 获取用户已存储的 ActiNet 模型启用偏好 */
export function getStoredActiNetModels(): ProviderModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const prefs = JSON.parse(raw) as ActiNetModelPreferences
    return prefs.models ?? []
  } catch {
    return []
  }
}

/** 保存用户 ActiNet 模型启用偏好 */
export function saveActiNetModelPreferences(models: ProviderModel[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ models, lastFetchedAt: Date.now() } as ActiNetModelPreferences),
  )
}

/** 获取实际生效的 ActiNet 模型：用户已配置则用配置，否则用默认 */
export function getEffectiveActiNetModels(): ProviderModel[] {
  const stored = getStoredActiNetModels()
  if (stored.length > 0) return stored
  return DEFAULT_ACTINET_MODELS
}

/**
 * 从 ActiNet cloud server 拉取可用模型列表。
 * 返回模型 ID 数组（如 ['快速', '专家']）。
 */
export async function fetchActiNetModelsFromServer(
  serverUrl: string,
  apiKey: string,
): Promise<string[]> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/v1/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const data = (await response.json()) as { data?: Array<{ id: string }> }
  return (data.data ?? []).map((m) => m.id)
}

/**
 * 合并远程模型列表与用户本地启用偏好。
 * 远程新增的模型默认 disabled，远程已删除的模型从偏好中移除。
 */
export function mergeActiNetModels(
  remoteModels: string[],
  storedModels: ProviderModel[],
): ProviderModel[] {
  const storedMap = new Map(storedModels.map((m) => [m.id, m.enabled]))
  return remoteModels.map((id) => ({
    id,
    enabled: storedMap.get(id) ?? false,
  }))
}
