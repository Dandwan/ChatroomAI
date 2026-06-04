export interface CloudAuthResult {
  token: string
  api_key: string
  user: {
    id: string
    username: string
    email: string
  }
}

const STORAGE_KEY = 'actichat_cloud_auth'
const SERVER_URL_KEY = 'actichat_cloud_server_url'

/** 默认云服务器地址 — 上线时修改此处 */
const DEFAULT_CLOUD_SERVER_URL = 'https://47.108.210.249:2179/'

export interface StoredCloudAuth {
  serverUrl: string
  token: string
  apiKey: string
  username: string
  email: string
  savedAt: number
}

export function getStoredCloudAuth(): StoredCloudAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredCloudAuth
  } catch {
    return null
  }
}

export function getCloudServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_CLOUD_SERVER_URL
}

export function setCloudServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url)
}

export function saveCloudAuth(auth: StoredCloudAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

/** 硬退出：完全清除所有凭据（用户手动退出） */
export function clearCloudAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** 软退出：保留 username/email/serverUrl，仅清除 token/apiKey（启动检测失败时调用） */
export function deactivateCloudAuth(): void {
  const auth = getStoredCloudAuth()
  if (!auth) return
  saveCloudAuth({
    ...auth,
    token: '',
    apiKey: '',
    savedAt: Date.now(),
  })
}

export function isCloudLoggedIn(): boolean {
  const auth = getStoredCloudAuth()
  return !!auth && !!auth.apiKey
}

/**
 * 验证当前 ActiNet 登录状态是否有效。
 * 调用 GET /api/auth/me 检测 token 是否过期或服务器是否可达。
 * 返回 true 表示有效，false 表示需要软退出。
 */
export async function verifyCloudAuth(): Promise<boolean> {
  const auth = getStoredCloudAuth()
  if (!auth || !auth.token) return false

  try {
    const normalizedUrl = auth.serverUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok
  } catch {
    // 网络错误、超时、DNS 失败等 — 视为无法连接
    return false
  }
}

export async function cloudRegister(
  serverUrl: string,
  username: string,
  email: string,
  password: string,
): Promise<CloudAuthResult> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = (await response.json()) as CloudAuthResult

  // Persist to local storage (same as login)
  setCloudServerUrl(normalizedUrl)
  saveCloudAuth({
    serverUrl: normalizedUrl,
    token: result.token,
    apiKey: result.api_key,
    username: result.user.username,
    email: result.user.email,
    savedAt: Date.now(),
  })

  return result
}

export async function cloudLogin(
  serverUrl: string,
  username: string,
  password: string,
): Promise<CloudAuthResult> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = (await response.json()) as CloudAuthResult

  // Persist to local storage
  setCloudServerUrl(normalizedUrl)
  saveCloudAuth({
    serverUrl: normalizedUrl,
    token: result.token,
    apiKey: result.api_key,
    username: result.user.username,
    email: result.user.email,
    savedAt: Date.now(),
  })

  return result
}
