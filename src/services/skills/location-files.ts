import {
  buildConversationWorkspaceDirectory,
  listConversationWorkspace,
  readConversationWorkspaceFile,
  statConversationWorkspacePath,
} from '../chat-storage/repository'
import {
  ensureDirectory as ensureChatDirectory,
  joinRelativePath as joinChatRelativePath,
  pathExists as chatPathExists,
  readTextFile as readChatTextFile,
  statPath as statChatPath,
  writeTextFile as writeChatTextFile,
} from '../chat-storage/filesystem'
import {
  MAX_READ_LIST_ENTRIES,
  isTextFileLikely,
  normalizeReadRelativePath,
  sanitizeReadDepth,
  sliceTextByLineWindow,
} from '../read-utils'
import {
  listSkillDirectory,
  readSkillFile,
  statSkillPath,
} from './host'
import {
  nativeListAbsoluteDirectory,
  nativeReadAbsoluteTextFile,
  nativeStatAbsolutePath,
  nativeWriteAbsoluteTextFile,
} from './native-runtime'
import {
  SKILL_DIRECTORIES,
  ensureDirectory as ensureSkillDirectory,
  joinRelativePath as joinSkillRelativePath,
  listDirectory as listSkillStorageDirectory,
  pathExists as skillPathExists,
  readTextFile as readSkillStorageTextFile,
  statPath as statSkillStoragePath,
  writeTextFile as writeSkillStorageTextFile,
} from './storage'
import { applyTextEdits } from './text-edit'
import type {
  EditAction,
  EditExecutionResult,
  ReadAction,
  ReadExecutionResult,
  ReadListEntry,
} from './types'

const toEntryKind = (type?: string): 'file' | 'directory' =>
  type === 'directory' ? 'directory' : 'file'

const sortReadEntries = (entries: ReadListEntry[]): ReadListEntry[] =>
  [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }
    return left.path.localeCompare(right.path)
  })

const normalizeAbsolutePath = (value?: string): string => {
  const normalized = (value ?? '').replace(/\\/g, '/').trim()
  if (!normalized) {
    return ''
  }
  if (normalized.startsWith('/')) {
    return normalized.replace(/\/{2,}/g, '/')
  }
  if (/^[A-Za-z]:\//.test(normalized)) {
    return normalized
  }
  throw new Error(`非法绝对路径：${value ?? ''}`)
}

const buildWorkspaceTargetPath = (conversationId: string, relativePath: string): string =>
  relativePath
    ? joinChatRelativePath(buildConversationWorkspaceDirectory(conversationId), relativePath)
    : buildConversationWorkspaceDirectory(conversationId)

const buildHomeTargetPath = (relativePath: string): string =>
  relativePath ? joinSkillRelativePath(SKILL_DIRECTORIES.home, relativePath) : SKILL_DIRECTORIES.home

const enumerateHomeDirectory = async (
  relativePath: string,
  depth: number,
): Promise<{
  entries: ReadListEntry[]
  truncated: boolean
}> => {
  const queue: Array<{ path: string; level: number }> = [{ path: relativePath, level: 1 }]
  const entries: ReadListEntry[] = []
  let truncated = false

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const currentStoragePath = buildHomeTargetPath(current.path)
    const childNames = (await listSkillStorageDirectory(currentStoragePath)).sort((left, right) =>
      left.localeCompare(right),
    )

    for (const childName of childNames) {
      const childRelativePath = current.path ? joinSkillRelativePath(current.path, childName) : childName
      const childStoragePath = buildHomeTargetPath(childRelativePath)
      const childStat = await statSkillStoragePath(childStoragePath)
      const kind = toEntryKind(childStat.type)
      entries.push({
        path: childRelativePath,
        name: childName,
        kind,
        size: kind === 'file' ? childStat.size : undefined,
      })

      if (entries.length >= MAX_READ_LIST_ENTRIES) {
        truncated = true
        return {
          entries: sortReadEntries(entries),
          truncated,
        }
      }

      if (kind === 'directory' && current.level < depth) {
        queue.push({
          path: childRelativePath,
          level: current.level + 1,
        })
      }
    }
  }

  return {
    entries: sortReadEntries(entries),
    truncated,
  }
}

const listHomeDirectory = async (
  path?: string,
  depth?: number,
): Promise<{
  path: string
  depth: number
  entries: ReadListEntry[]
  truncated: boolean
}> => {
  const relativePath = normalizeReadRelativePath(path)
  const targetPath = buildHomeTargetPath(relativePath)
  const targetStat = await statSkillStoragePath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`home 路径不存在：${relativePath || '.'}`)
  }
  if (toEntryKind(targetStat.type) !== 'directory') {
    throw new Error(`目标不是目录：${relativePath || '.'}`)
  }

  const safeDepth = sanitizeReadDepth(depth)
  const result = await enumerateHomeDirectory(relativePath, safeDepth)
  return {
    path: relativePath || '.',
    depth: safeDepth,
    entries: result.entries,
    truncated: result.truncated,
  }
}

const statHomePath = async (
  path: string,
): Promise<{
  path: string
  entryType: 'file' | 'directory'
  size?: number
  textLikely?: boolean
}> => {
  const relativePath = normalizeReadRelativePath(path)
  if (!relativePath) {
    return {
      path: '.',
      entryType: 'directory',
    }
  }

  const targetPath = buildHomeTargetPath(relativePath)
  const targetStat = await statSkillStoragePath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`home 路径不存在：${relativePath}`)
  }

  const entryType = toEntryKind(targetStat.type)
  return {
    path: relativePath,
    entryType,
    size: entryType === 'file' ? targetStat.size : undefined,
    textLikely: entryType === 'file' ? isTextFileLikely(relativePath) : undefined,
  }
}

const readHomeFile = async (
  path: string,
): Promise<{
  path: string
  content: string
}> => {
  const relativePath = normalizeReadRelativePath(path)
  if (!relativePath) {
    throw new Error('read 缺少 home 文件路径')
  }

  const targetPath = buildHomeTargetPath(relativePath)
  const targetStat = await statSkillStoragePath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`home 路径不存在：${relativePath}`)
  }
  if (toEntryKind(targetStat.type) !== 'file') {
    throw new Error(`目标不是文件：${relativePath}`)
  }

  const content = await readSkillStorageTextFile(targetPath)
  if (!isTextFileLikely(relativePath, content)) {
    throw new Error(`目标不是可读取的文本文件：${relativePath}`)
  }

  return {
    path: relativePath,
    content,
  }
}

const enumerateAbsoluteDirectory = async (
  absolutePath: string,
  depth: number,
): Promise<{
  entries: ReadListEntry[]
  truncated: boolean
}> => {
  const queue: Array<{ path: string; level: number }> = [{ path: absolutePath, level: 1 }]
  const entries: ReadListEntry[] = []
  let truncated = false

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const result = await nativeListAbsoluteDirectory(current.path)
    const children = [...result.entries].sort((left, right) => left.path.localeCompare(right.path))
    for (const child of children) {
      entries.push(child)

      if (entries.length >= MAX_READ_LIST_ENTRIES) {
        truncated = true
        return {
          entries: sortReadEntries(entries),
          truncated,
        }
      }

      if (child.kind === 'directory' && current.level < depth) {
        queue.push({
          path: child.path,
          level: current.level + 1,
        })
      }
    }
  }

  return {
    entries: sortReadEntries(entries),
    truncated,
  }
}

const buildReadTextResult = (
  action: ReadAction,
  path: string,
  content: string,
): ReadExecutionResult => {
  const requestedStartLine =
    typeof action.startLine === 'number' && Number.isFinite(action.startLine)
      ? Math.max(1, Math.round(action.startLine))
      : 1
  const sliced = sliceTextByLineWindow(content, action.startLine, action.endLine)

  if (requestedStartLine > sliced.totalLines) {
    throw new Error(`起始行超出文件总行数：${requestedStartLine} > ${sliced.totalLines}`)
  }

  return {
    kind: 'read',
    root: action.root,
    skill: action.root === 'skill' ? action.skill : undefined,
    path,
    content: sliced.content,
    lineStart: sliced.lineStart,
    lineEnd: sliced.lineEnd,
    truncated: sliced.truncated,
  }
}

const ensureWorkspaceParentDirectory = async (
  conversationId: string,
  relativeFilePath: string,
): Promise<void> => {
  const segments = relativeFilePath.split('/').slice(0, -1)
  if (segments.length === 0) {
    await ensureChatDirectory(buildConversationWorkspaceDirectory(conversationId))
    return
  }
  await ensureChatDirectory(buildWorkspaceTargetPath(conversationId, segments.join('/')))
}

const ensureHomeParentDirectory = async (relativeFilePath: string): Promise<void> => {
  const segments = relativeFilePath.split('/').slice(0, -1)
  if (segments.length === 0) {
    await ensureSkillDirectory(SKILL_DIRECTORIES.home)
    return
  }
  await ensureSkillDirectory(buildHomeTargetPath(segments.join('/')))
}

const readExistingEditableFile = async (
  root: EditAction['root'],
  conversationId: string,
  path: string,
): Promise<{
  path: string
  content: string
}> => {
  if (root === 'workspace') {
    const relativePath = normalizeReadRelativePath(path)
    if (!relativePath) {
      throw new Error('edit 缺少 workspace 文件路径')
    }
    const targetPath = buildWorkspaceTargetPath(conversationId, relativePath)
    const stat = await statChatPath(targetPath).catch(() => null)
    if (!stat) {
      throw new Error(`workspace 路径不存在：${relativePath}`)
    }
    if (toEntryKind(stat.type) !== 'file') {
      throw new Error(`目标不是文件：${relativePath}`)
    }
    const content = await readChatTextFile(targetPath)
    if (!isTextFileLikely(relativePath, content)) {
      throw new Error(`目标不是可编辑的文本文件：${relativePath}`)
    }
    return {
      path: relativePath,
      content,
    }
  }

  if (root === 'home') {
    return readHomeFile(path)
  }

  const absolutePath = normalizeAbsolutePath(path)
  if (!absolutePath) {
    throw new Error('edit 缺少 root 文件路径')
  }
  const stat = await nativeStatAbsolutePath(absolutePath).catch(() => null)
  if (!stat) {
    throw new Error(`root 路径不存在：${absolutePath}`)
  }
  if (stat.entryType !== 'file') {
    throw new Error(`目标不是文件：${absolutePath}`)
  }
  const file = await nativeReadAbsoluteTextFile(absolutePath)
  if (!isTextFileLikely(absolutePath, file.content)) {
    throw new Error(`目标不是可编辑的文本文件：${absolutePath}`)
  }
  return file
}

const editableFileExists = async (
  root: EditAction['root'],
  conversationId: string,
  path: string,
): Promise<boolean> => {
  if (root === 'workspace') {
    return chatPathExists(buildWorkspaceTargetPath(conversationId, path))
  }
  if (root === 'home') {
    return skillPathExists(buildHomeTargetPath(path))
  }
  return (await nativeStatAbsolutePath(path).catch(() => null)) !== null
}

export const executeReadAction = async (
  action: ReadAction,
  conversationId: string,
): Promise<ReadExecutionResult> => {
  if (
    action.root !== 'skill' &&
    action.root !== 'workspace' &&
    action.root !== 'home' &&
    action.root !== 'absolute'
  ) {
    throw new Error('read 缺少合法 root')
  }
  if (action.op !== 'list' && action.op !== 'read' && action.op !== 'stat') {
    throw new Error('read 缺少合法 op')
  }
  if (action.root === 'skill' && !action.skill?.trim()) {
    throw new Error('read 在 skill root 下缺少 skill id')
  }
  if ((action.op === 'read' || action.op === 'stat') && !action.path?.trim()) {
    throw new Error(`read 在 ${action.op} 操作下缺少 path`)
  }

  if (action.root === 'skill') {
    if (action.op === 'list') {
      const result = await listSkillDirectory(action.skill!, action.path, action.depth)
      return {
        kind: 'list',
        root: 'skill',
        skill: action.skill,
        path: result.path,
        depth: result.depth,
        entries: result.entries,
        truncated: result.truncated,
      }
    }

    if (action.op === 'stat') {
      const result = await statSkillPath(action.skill!, action.path!)
      return {
        kind: 'stat',
        root: 'skill',
        skill: action.skill,
        path: result.path,
        entryType: result.entryType,
        size: result.size,
        textLikely: result.textLikely,
      }
    }

    const file = await readSkillFile(action.skill!, action.path!)
    return buildReadTextResult(action, file.path, file.content)
  }

  if (action.root === 'workspace') {
    if (action.op === 'list') {
      const result = await listConversationWorkspace(conversationId, action.path, action.depth)
      return {
        kind: 'list',
        root: 'workspace',
        path: result.path,
        depth: result.depth,
        entries: result.entries,
        truncated: result.truncated,
      }
    }

    if (action.op === 'stat') {
      const result = await statConversationWorkspacePath(conversationId, action.path!)
      return {
        kind: 'stat',
        root: 'workspace',
        path: result.path,
        entryType: result.entryType,
        size: result.size,
        textLikely: result.textLikely,
      }
    }

    const file = await readConversationWorkspaceFile(conversationId, action.path!)
    return buildReadTextResult(action, file.path, file.content)
  }

  if (action.root === 'home') {
    if (action.op === 'list') {
      const result = await listHomeDirectory(action.path, action.depth)
      return {
        kind: 'list',
        root: 'home',
        path: result.path,
        depth: result.depth,
        entries: result.entries,
        truncated: result.truncated,
      }
    }

    if (action.op === 'stat') {
      const result = await statHomePath(action.path!)
      return {
        kind: 'stat',
        root: 'home',
        path: result.path,
        entryType: result.entryType,
        size: result.size,
        textLikely: result.textLikely,
      }
    }

    const file = await readHomeFile(action.path!)
    return buildReadTextResult(action, file.path, file.content)
  }

  if (action.op === 'list') {
    const absolutePath = normalizeAbsolutePath(action.path) || '/'
    const safeDepth = sanitizeReadDepth(action.depth)
    const result = await enumerateAbsoluteDirectory(absolutePath, safeDepth)
    return {
      kind: 'list',
      root: 'absolute',
      path: absolutePath,
      depth: safeDepth,
      entries: result.entries,
      truncated: result.truncated,
    }
  }

  if (action.op === 'stat') {
    const absolutePath = normalizeAbsolutePath(action.path)
    if (!absolutePath) {
      throw new Error('read 在 stat 操作下缺少 root 绝对路径')
    }
    const result = await nativeStatAbsolutePath(absolutePath)
    return {
      kind: 'stat',
      root: 'absolute',
      path: result.path,
      entryType: result.entryType,
      size: result.size,
      textLikely: result.entryType === 'file' ? isTextFileLikely(result.path) : undefined,
    }
  }

  const absolutePath = normalizeAbsolutePath(action.path)
  if (!absolutePath) {
    throw new Error('read 在 read 操作下缺少 root 绝对路径')
  }
  const file = await nativeReadAbsoluteTextFile(absolutePath)
  if (!isTextFileLikely(file.path, file.content)) {
    throw new Error(`目标不是可读取的文本文件：${file.path}`)
  }
  return buildReadTextResult(action, file.path, file.content)
}

export const executeEditAction = async (
  action: EditAction,
  conversationId: string,
): Promise<EditExecutionResult> => {
  if (action.root !== 'workspace' && action.root !== 'home' && action.root !== 'absolute') {
    throw new Error('edit 缺少合法 root')
  }

  const targetPath =
    action.root === 'absolute'
      ? normalizeAbsolutePath(action.path)
      : normalizeReadRelativePath(action.path)
  if (!targetPath) {
    throw new Error('edit 缺少合法 path')
  }

  let existingContent = ''
  const fileExists = await editableFileExists(action.root, conversationId, targetPath)
  const created = !fileExists

  if (fileExists) {
    const existing = await readExistingEditableFile(action.root, conversationId, targetPath)
    existingContent = existing.content
  } else if (action.createIfMissing !== true) {
    const errorPrefix = action.root === 'absolute' ? 'root' : action.root
    throw new Error(`${errorPrefix} 路径不存在：${targetPath}`)
  }

  const result = applyTextEdits({
    originalContent: existingContent,
    action: {
      ...action,
      path: targetPath,
    },
  })

  if (action.root === 'workspace') {
    await ensureWorkspaceParentDirectory(conversationId, targetPath)
    await writeChatTextFile(buildWorkspaceTargetPath(conversationId, targetPath), result.nextContent)
  } else if (action.root === 'home') {
    await ensureHomeParentDirectory(targetPath)
    await writeSkillStorageTextFile(buildHomeTargetPath(targetPath), result.nextContent)
  } else {
    await nativeWriteAbsoluteTextFile(targetPath, result.nextContent)
  }

  return {
    ...result,
    created,
  }
}
