import type { ProviderModel } from '../state/types'

const STORAGE_KEY = 'actichat_actinet_models'

export const DEFAULT_ACTINET_MODELS: ProviderModel[] = [
  { id: '快速', enabled: true },
  { id: '专家', enabled: true },
]

/** 核心模型 ID — 快速/专家始终存在于模型列表中，不可被删除 */
export const CORE_ACTINET_MODEL_IDS = ['快速', '专家']

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

/** 获取实际生效的 ActiNet 模型：确保快速/专家始终存在，然后合并用户偏好 */
export function getEffectiveActiNetModels(): ProviderModel[] {
  const stored = getStoredActiNetModels()

  // 以核心模型为基础，确保快速/专家始终存在
  const coreMap = new Map<string, boolean>(
    DEFAULT_ACTINET_MODELS.map((m) => [m.id, m.enabled]),
  )

  // 用存储的偏好覆盖核心模型的启用状态
  for (const m of stored) {
    if (coreMap.has(m.id)) {
      coreMap.set(m.id, m.enabled)
    }
  }

  // 构建最终列表：先是核心模型，再追加存储中的非核心模型
  const coreModels: ProviderModel[] = DEFAULT_ACTINET_MODELS.map((m) => ({
    id: m.id,
    enabled: coreMap.get(m.id) ?? m.enabled,
  }))

  const extraModels = stored.filter((m) => !CORE_ACTINET_MODEL_IDS.includes(m.id))

  return [...coreModels, ...extraModels]
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
 * 快速/专家始终保留，即使远程不返回它们。
 */
export function mergeActiNetModels(
  remoteModels: string[],
  storedModels: ProviderModel[],
): ProviderModel[] {
  const storedMap = new Map(storedModels.map((m) => [m.id, m.enabled]))

  // 以快速/专家为核心基础
  const coreModels = DEFAULT_ACTINET_MODELS.map((m) => ({
    id: m.id,
    enabled: storedMap.get(m.id) ?? m.enabled,
  }))

  // 仅追加远程中存在的非核心模型
  const extraModels = remoteModels
    .filter((id) => !CORE_ACTINET_MODEL_IDS.includes(id))
    .map((id) => ({
      id,
      enabled: storedMap.get(id) ?? false,
    }))

  return [...coreModels, ...extraModels]
}

/** 获取在模型菜单中应显示的 ActiNet 模型（根据高级模式过滤） */
export function getVisibleActiNetModels(
  advancedMode: boolean,
): ProviderModel[] {
  const allModels = getEffectiveActiNetModels()
  if (advancedMode) return allModels
  return allModels.filter((m) => CORE_ACTINET_MODEL_IDS.includes(m.id))
}
