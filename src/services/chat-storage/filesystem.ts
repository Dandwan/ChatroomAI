import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

const DIRECTORY = Directory.Data

export const CHAT_STORAGE_DIRECTORIES = {
  root: 'chat-data',
  conversations: 'chat-data/conversations',
}

const normalizeRelativePath = (value: string): string =>
  value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')

export const joinRelativePath = (...parts: string[]): string =>
  normalizeRelativePath(parts.filter(Boolean).join('/'))

export const ensureSafeRelativePath = (value: string): string => {
  const normalized = normalizeRelativePath(value)
  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`Illegal path: ${value}`)
  }
  return normalized
}

export const ensureDirectory = async (path: string): Promise<void> => {
  await Filesystem.mkdir({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
    recursive: true,
  }).catch(() => {
    // Ignore mkdir races.
  })
}

export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await Filesystem.stat({
      path: ensureSafeRelativePath(path),
      directory: DIRECTORY,
    })
    return true
  } catch {
    return false
  }
}

export interface RelativePathStat {
  type?: string
  size?: number
}

export const statPath = async (path: string): Promise<RelativePathStat> => {
  const result = await Filesystem.stat({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
  })
  return {
    type: result.type,
    size: typeof result.size === 'number' ? result.size : undefined,
  }
}

export const readTextFile = async (path: string): Promise<string> => {
  const result = await Filesystem.readFile({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
    encoding: Encoding.UTF8,
  })
  return typeof result.data === 'string' ? result.data : ''
}

export const writeTextFile = async (path: string, content: string): Promise<void> => {
  await Filesystem.writeFile({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
    recursive: true,
    data: content,
    encoding: Encoding.UTF8,
  })
}

export const readBase64File = async (path: string): Promise<string> => {
  const result = await Filesystem.readFile({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
  })
  return typeof result.data === 'string' ? result.data : ''
}

const normalizeAbsoluteUri = (uri: string): string => {
  const normalized = uri.trim()
  if (!normalized) {
    return normalized
  }

  if (!normalized.startsWith('file://')) {
    return normalized
  }

  try {
    const pathname = decodeURIComponent(new URL(normalized).pathname)
    return pathname.replace(/^\/([A-Za-z]:\/)/, '$1')
  } catch {
    return normalized.replace(/^file:\/\//i, '')
  }
}

export const resolveAbsolutePath = async (path: string): Promise<string> => {
  const safePath = ensureSafeRelativePath(path)
  const result = await Filesystem.getUri({
    path: safePath,
    directory: DIRECTORY,
  })
  return normalizeAbsoluteUri(result.uri)
}

export const writeBase64File = async (path: string, content: string): Promise<void> => {
  await Filesystem.writeFile({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
    recursive: true,
    data: content,
  })
}

export const deletePath = async (path: string): Promise<void> => {
  const safePath = ensureSafeRelativePath(path)
  if (!(await pathExists(safePath))) {
    return
  }
  const stat = await Filesystem.stat({
    path: safePath,
    directory: DIRECTORY,
  })
  if (stat.type === 'directory') {
    await Filesystem.rmdir({
      path: safePath,
      directory: DIRECTORY,
      recursive: true,
    })
    return
  }
  await Filesystem.deleteFile({
    path: safePath,
    directory: DIRECTORY,
  })
}

export const readJsonFile = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    const raw = await readTextFile(path)
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeJsonFile = async (path: string, value: unknown): Promise<void> => {
  await writeTextFile(path, JSON.stringify(value, null, 2))
}

export interface DirectoryEntry {
  name: string
  type?: string
}

export const listDirectory = async (path: string): Promise<DirectoryEntry[]> => {
  try {
    const result = await Filesystem.readdir({
      path: ensureSafeRelativePath(path),
      directory: DIRECTORY,
    })
    return result.files.map((entry) => ({
      name: entry.name,
      type: entry.type,
    }))
  } catch {
    return []
  }
}
