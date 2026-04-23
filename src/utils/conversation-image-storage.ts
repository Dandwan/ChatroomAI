import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

export interface ConversationImageMetadata {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl?: string
  storageKey?: string
}

interface PersistConversationImageInput {
  conversationId: string
  messageId: string
  image: ConversationImageMetadata
}

const IMAGE_ROOT = 'conversation-images'
const IMAGE_MANIFEST_STORAGE_KEY = 'chatroom.conversation-image-manifest.v1'

const toSafePathSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9-_]/g, '_')

const buildImageStoragePath = (
  conversationId: string,
  messageId: string,
  imageId: string,
): string =>
  `${IMAGE_ROOT}/${toSafePathSegment(conversationId)}/${toSafePathSegment(messageId)}/${toSafePathSegment(
    imageId,
  )}.json`

const ensureParentDirectory = async (storagePath: string): Promise<void> => {
  const segments = storagePath.split('/')
  if (segments.length <= 1) {
    return
  }
  const directoryPath = segments.slice(0, -1).join('/')
  await Filesystem.mkdir({
    path: directoryPath,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => {
    // Ignore races when the directory already exists.
  })
}

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await Filesystem.stat({
      path,
      directory: Directory.Data,
    })
    return true
  } catch {
    return false
  }
}

const readManifest = (): string[] => {
  if (typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(IMAGE_MANIFEST_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  } catch {
    return []
  }
}

const writeManifest = (keys: string[]): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(IMAGE_MANIFEST_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Ignore manifest persistence failures. Conversation metadata persistence handles user-facing errors.
  }
}

export const persistConversationImage = async (
  input: PersistConversationImageInput,
): Promise<string> => {
  const storageKey =
    input.image.storageKey ?? buildImageStoragePath(input.conversationId, input.messageId, input.image.id)
  if (!input.image.dataUrl) {
    return storageKey
  }
  await ensureParentDirectory(storageKey)
  await Filesystem.writeFile({
    path: storageKey,
    directory: Directory.Data,
    data: JSON.stringify({
      dataUrl: input.image.dataUrl,
    }),
    encoding: Encoding.UTF8,
    recursive: true,
  })
  return storageKey
}

export const loadConversationImageData = async (storageKey: string): Promise<string | null> => {
  try {
    const result = await Filesystem.readFile({
      path: storageKey,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    })
    const raw = typeof result.data === 'string' ? result.data : ''
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' &&
      parsed !== null &&
      'dataUrl' in parsed &&
      typeof (parsed as { dataUrl?: unknown }).dataUrl === 'string'
      ? ((parsed as { dataUrl: string }).dataUrl || null)
      : null
  } catch {
    return null
  }
}

export const removeConversationImages = async (storageKeys: string[]): Promise<void> => {
  await Promise.all(
    storageKeys.map(async (storageKey) => {
      if (!(await pathExists(storageKey))) {
        return
      }
      await Filesystem.deleteFile({
        path: storageKey,
        directory: Directory.Data,
      }).catch(() => {
        // Ignore best-effort cleanup failures.
      })
    }),
  )
}

export const syncConversationImageManifest = async (nextKeys: string[]): Promise<void> => {
  const previousKeys = readManifest()
  const nextSet = new Set(nextKeys)
  const removed = previousKeys.filter((key) => !nextSet.has(key))
  if (removed.length > 0) {
    await removeConversationImages(removed)
  }
  const deduped = [...nextSet]
  writeManifest(deduped)
}

export const clearConversationImageManifest = (): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(IMAGE_MANIFEST_STORAGE_KEY)
  } catch {
    // Ignore manifest cleanup failures.
  }
}
