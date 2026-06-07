import { getAppVersion } from '../utils/app-version'

export interface UpdateInfo {
  id: string
  version_name: string
  version_code: number
  release_notes: string
  download_type: 'patch' | 'full'
  download_url: string
  file_size_bytes: number
  file_sha256: string
  base_version_code?: number
}

interface CheckResult {
  has_update: boolean
  update?: UpdateInfo
}

const DISMISSED_KEY = 'actichat.dismissedUpdates'

interface DismissedRecord {
  [version_code: string]: number // timestamp
}

function getDismissed(): DismissedRecord {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function dismissUpdate(versionCode: number): void {
  const record = getDismissed()
  record[versionCode] = Date.now()
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(record))
}

export function isUpdateDismissed(versionCode: number): boolean {
  return versionCode in getDismissed()
}

/**
 * Check for available updates from the ActiNet server.
 * Returns null if no update is available, or the update info.
 */
export async function checkForUpdate(serverUrl: string, userId?: string): Promise<UpdateInfo | null> {
  try {
    const { versionCode } = await getAppVersion()
    const params = new URLSearchParams()
    params.set('version_code', String(versionCode))
    if (userId) params.set('user_id', userId)

    const url = `${serverUrl.replace(/\/+$/, '')}/api/updates/check?${params.toString()}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })

    if (!res.ok) return null

    const data = (await res.json()) as CheckResult
    if (!data.has_update || !data.update) return null

    return data.update
  } catch {
    // Network errors / server unreachable — silently skip
    return null
  }
}

/**
 * Download the update file (APK or patch) and save to a local path.
 * Reports progress via the onProgress callback.
 *
 * Uses fetch streaming to track download progress.
 * Returns the downloaded file as a Blob with its local URL.
 */
export async function downloadUpdate(
  update: UpdateInfo,
  serverUrl: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ blob: Blob; fileName: string }> {
  const url = `${serverUrl.replace(/\/+$/, '')}${update.download_url}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`下载失败: HTTP ${res.status}`)
  }

  const contentLength = parseInt(res.headers.get('Content-Length') ?? '0', 10) || update.file_size_bytes

  // Stream the response to track progress
  const reader = res.body?.getReader()
  if (!reader) {
    // Fallback: no streaming support
    const blob = await res.blob()
    const fileName = update.download_type === 'patch'
      ? `patch-${update.base_version_code ?? 'prev'}-${update.version_code}.patch`
      : `actichat-${update.version_name}.apk`
    return { blob, fileName }
  }

  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    loaded += value.length
    onProgress?.(loaded, contentLength)
  }

  const blob = new Blob(chunks as BlobPart[], {
    type: update.download_type === 'patch' ? 'application/octet-stream' : 'application/vnd.android.package-archive',
  })

  const fileName = update.download_type === 'patch'
    ? `patch-${update.base_version_code ?? 'prev'}-${update.version_code}.patch`
    : `actichat-${update.version_name}.apk`

  return { blob, fileName }
}
