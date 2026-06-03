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
  return localStorage.getItem(SERVER_URL_KEY) ?? ''
}

export function setCloudServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url)
}

export function saveCloudAuth(auth: StoredCloudAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearCloudAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isCloudLoggedIn(): boolean {
  const auth = getStoredCloudAuth()
  return !!auth && !!auth.apiKey
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
