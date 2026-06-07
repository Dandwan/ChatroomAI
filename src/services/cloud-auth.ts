export interface CloudAuthResult {
  token: string
  api_key: string
  user: {
    id: string
    username: string
    email: string
  }
}

export interface CloudRegisterResult {
  /** Whether the verification email was sent successfully */
  email_sent: boolean
  /** Human-readable message from the server */
  message: string
  /** Created user info (minimal — no token/api_key) */
  user: {
    id: string
    username: string
    email: string
  }
}

const STORAGE_KEY = 'actichat_cloud_auth'
const SERVER_URL_KEY = 'actichat_cloud_server_url'
const CREDENTIALS_KEY = 'actichat_cloud_credentials'

/** 默认云服务器地址 — 上线时修改此处 */
const DEFAULT_CLOUD_SERVER_URL = 'https://47.108.210.249:2179/'

export interface StoredCloudAuth {
  serverUrl: string
  token: string
  apiKey: string
  username: string
  email: string
  emailVerified?: boolean
  savedAt: number
}

interface StoredCloudCredentials {
  serverUrl: string
  username: string
  email: string
  /** Base64 编码后的密码（混淆，非加密） */
  password: string
}

const encodePassword = (password: string): string => {
  try {
    return btoa(password)
  } catch {
    return password
  }
}

const decodePassword = (encoded: string): string => {
  try {
    return atob(encoded)
  } catch {
    return encoded
  }
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

// ── 凭据存储（用于自动登录）──

function saveCloudCredentials(serverUrl: string, username: string, email: string, password: string): void {
  const creds: StoredCloudCredentials = {
    serverUrl,
    username,
    email,
    password: encodePassword(password),
  }
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds))
}

function getStoredCloudCredentials(): StoredCloudCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredCloudCredentials
  } catch {
    return null
  }
}

function clearCloudCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY)
}

/** 判断是否存储了可用于自动登录的凭据（用户名 + 密码 + 服务器地址） */
export function hasStoredCredentials(): boolean {
  const creds = getStoredCloudCredentials()
  return !!(creds && creds.username && creds.password && creds.serverUrl)
}

/**
 * 使用已存储的凭据尝试自动登录。
 * 成功返回 true，失败静默返回 false（不抛异常，不弹通知）。
 */
export async function tryAutoLogin(): Promise<boolean> {
  const creds = getStoredCloudCredentials()
  if (!creds || !creds.username || !creds.password || !creds.serverUrl) {
    return false
  }

  try {
    await cloudLogin(creds.serverUrl, creds.username, decodePassword(creds.password))
    return true
  } catch {
    return false
  }
}

export function saveCloudAuth(auth: StoredCloudAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

/** 硬退出：完全清除所有凭据（用户手动退出） */
export function clearCloudAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
  clearCloudCredentials()
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

export interface CloudUserInfo {
  id: string
  username: string
  email: string
  email_verified: boolean
  api_key: string
  rate_limit_rpm: number
  rate_limit_tpd: number
  app_version_code?: number
}

/** Fetch current user info from the server. Returns null on failure. */
export async function fetchCloudUserInfo(): Promise<CloudUserInfo | null> {
  const auth = getStoredCloudAuth()
  if (!auth || !auth.apiKey) return null

  try {
    // Report client version to server
    let versionParam = ''
    try {
      const versionCode = (window as any).__ACTICHAT_VERSION_CODE__ as number | undefined
      if (versionCode && versionCode > 0) {
        versionParam = `?version_code=${versionCode}`
      }
    } catch { /* ignore */ }

    const normalizedUrl = auth.serverUrl.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/api/auth/me${versionParam}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    const info = await response.json() as CloudUserInfo
    return info
  } catch {
    return null
  }
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
): Promise<CloudRegisterResult> {
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

  const result = (await response.json()) as CloudRegisterResult

  // Save server URL and credentials for later auto-login (no token/api_key yet)
  setCloudServerUrl(normalizedUrl)
  saveCloudCredentials(normalizedUrl, username, email, password)

  return result
}

/**
 * Verify email using the verification code from the email.
 * On success, persists auth data (same as login) and returns the result.
 */
export async function verifyCloudEmail(
  serverUrl: string,
  token: string,
): Promise<CloudAuthResult> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = await response.json() as { api_key: string; user: { id: string; username: string; email: string }; message: string }

  // Save auth data on successful verification
  saveCloudAuth({
    serverUrl: normalizedUrl,
    token: '',  // No JWT from email verification; user must login
    apiKey: result.api_key,
    username: result.user.username,
    email: result.user.email,
    savedAt: Date.now(),
  })
  // Note: credentials already saved from register step

  return {
    token: '',  // Email verification doesn't return a JWT
    api_key: result.api_key,
    user: result.user,
  }
}

/**
 * Request a new verification email.
 * Returns true if the server accepted the request (always returns success to avoid leaking user existence).
 */
export async function resendCloudVerification(
  serverUrl: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = await response.json() as { message: string }
  return { ok: true, message: result.message }
}

/** Request a password reset. Always returns success message to avoid leaking user existence. */
export async function requestCloudPasswordReset(
  serverUrl: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = await response.json() as { message: string }
  return { ok: true, message: result.message }
}

/** Reset password using the token from the reset email. */
export async function resetCloudPassword(
  serverUrl: string,
  token: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = await response.json() as { message: string }
  return { ok: true, message: result.message }
}

/** Request to change the bound email address. Requires API key auth. */
export async function changeCloudEmail(
  serverUrl: string,
  apiKey: string,
  newEmail: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/change-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ new_email: newEmail, password }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = await response.json() as { message: string }
  return { ok: true, message: result.message }
}

/** Confirm email change using the verification token. */
export async function confirmCloudEmailChange(
  serverUrl: string,
  token: string,
): Promise<{ ok: boolean; message: string; email: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/auth/confirm-email-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    throw new Error(err.error?.message ?? `HTTP ${response.status}`)
  }

  const result = await response.json() as { message: string; email: string }
  return { ok: true, message: result.message, email: result.email }
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
  saveCloudCredentials(normalizedUrl, result.user.username, result.user.email, password)

  return result
}
