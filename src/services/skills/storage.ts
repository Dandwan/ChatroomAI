import JSZip from 'jszip'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

const DIRECTORY = Directory.Data

const SKILL_HOST_ROOT = 'skill-host'

export const SKILL_DIRECTORIES = {
  root: SKILL_HOST_ROOT,
  builtin: `${SKILL_HOST_ROOT}/builtin-skills`,
  skills: `${SKILL_HOST_ROOT}/skills`,
  runtimes: `${SKILL_HOST_ROOT}/runtimes`,
  state: `${SKILL_HOST_ROOT}/state`,
  temp: `${SKILL_HOST_ROOT}/temp`,
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
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`非法路径：${value}`)
  }
  return normalized
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
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

export const readTextFile = async (path: string): Promise<string> => {
  const result = await Filesystem.readFile({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
    encoding: Encoding.UTF8,
  })
  return result.data as string
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

export const writeBinaryFile = async (path: string, content: Uint8Array): Promise<void> => {
  await Filesystem.writeFile({
    path: ensureSafeRelativePath(path),
    directory: DIRECTORY,
    recursive: true,
    data: toBase64(content),
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

export const listDirectory = async (path: string): Promise<string[]> => {
  try {
    const result = await Filesystem.readdir({
      path: ensureSafeRelativePath(path),
      directory: DIRECTORY,
    })
    return result.files.map((item) => item.name)
  } catch {
    return []
  }
}

export const installZipDirectory = async (
  file: File,
  targetRoot: string,
): Promise<{
  rootFolder: string
  replacedExisting: boolean
  entries: string[]
  skillMarkdown?: string
  configTemplate?: Record<string, unknown> | null
}> => {
  const archive = await JSZip.loadAsync(await file.arrayBuffer())
  const files = Object.values(archive.files).filter((entry) => !entry.dir && !entry.name.startsWith('__MACOSX/'))
  const roots = new Set<string>()

  for (const entry of files) {
    const normalized = ensureSafeRelativePath(entry.name)
    const [root] = normalized.split('/')
    if (root) {
      roots.add(root)
    }
  }

  if (roots.size !== 1) {
    throw new Error('Skill 或 runtime 压缩包必须只包含一个顶层目录。')
  }

  const [rootFolder] = Array.from(roots)
  const skillMarkdownEntry = archive.file(`${rootFolder}/SKILL.md`)
  const skillMarkdown = skillMarkdownEntry ? await skillMarkdownEntry.async('text') : undefined
  let configTemplate: Record<string, unknown> | null = null
  const configTemplateEntry = archive.file(`${rootFolder}/config-template.json`)
  if (configTemplateEntry) {
    try {
      configTemplate = JSON.parse(await configTemplateEntry.async('text')) as Record<string, unknown>
    } catch {
      throw new Error('config-template.json 不是合法的 JSON。')
    }
  }

  const targetPath = joinRelativePath(targetRoot, rootFolder)
  const replacedExisting = await pathExists(targetPath)
  await deletePath(targetPath)
  await ensureDirectory(targetPath)

  const writtenEntries: string[] = []
  for (const entry of files) {
    const normalized = ensureSafeRelativePath(entry.name)
    if (!normalized.startsWith(`${rootFolder}/`)) {
      continue
    }
    const relative = normalized.slice(rootFolder.length + 1)
    const destination = joinRelativePath(targetPath, relative)
    const data = await entry.async('uint8array')
    await writeBinaryFile(destination, data)
    writtenEntries.push(destination)
  }

  return {
    rootFolder,
    replacedExisting,
    entries: writtenEntries,
    skillMarkdown,
    configTemplate,
  }
}

export const initializeStorage = async (): Promise<void> => {
  await ensureDirectory(SKILL_DIRECTORIES.builtin)
  await ensureDirectory(SKILL_DIRECTORIES.skills)
  await ensureDirectory(SKILL_DIRECTORIES.runtimes)
  await ensureDirectory(SKILL_DIRECTORIES.state)
  await ensureDirectory(SKILL_DIRECTORIES.temp)
}
