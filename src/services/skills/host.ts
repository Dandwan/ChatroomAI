import { parseSkillDocument } from './frontmatter'
import {
  MAX_READ_LIST_ENTRIES,
  isTextFileLikely,
  normalizeReadRelativePath,
  sanitizeReadDepth,
} from '../read-utils'
import {
  SKILL_DIRECTORIES,
  deletePath,
  initializeStorage,
  installZipDirectory,
  joinRelativePath,
  listDirectory,
  pathExists,
  readJsonFile,
  readTextFile,
  statPath,
  writeTextFile,
  writeJsonFile,
} from './storage'
import type { ReadListEntry, SkillDocument, SkillInstallResult, SkillRecord } from './types'

const builtinUnionSearchFiles = import.meta.glob('../../../builtin-skills/union-search/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const builtinDeviceInfoFiles = import.meta.glob('../../../builtin-skills/device-info/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface SkillHostState {
  enabledById: Record<string, boolean>
  deletedBuiltinIds: string[]
  metadataById: Record<
    string,
    {
      installedAt: number
    }
  >
}

const DEFAULT_STATE: SkillHostState = {
  enabledById: {},
  deletedBuiltinIds: [],
  metadataById: {},
}

const STATE_PATH = joinRelativePath(SKILL_DIRECTORIES.state, 'skills.json')
const CONFIGS_PATH = joinRelativePath(SKILL_DIRECTORIES.state, 'skill-configs')
const INSTALLED_SKILLS_PATH = SKILL_DIRECTORIES.skills

const SKILL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type BuiltinSkillDefinition = {
  id: string
  markdown: string
  configTemplate: Record<string, unknown> | null
  files: Record<string, string>
}

const createFallbackSkillDocument = (skillId: string, markdown: string): SkillDocument => {
  const body = markdown.replace(/^---[\s\S]*?\r?\n---\s*\r?\n?/, '').trim()
  return {
    frontmatter: {
      name: skillId,
      description: `${skillId} 的 SKILL.md 解析失败，已使用降级元数据。`,
    },
    body,
    content: markdown,
  }
}

const toBuiltinFiles = (files: Record<string, string>, prefix: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(files)
      .map(([path, content]) => {
        const marker = `${prefix}/`
        const markerIndex = path.indexOf(marker)
        if (markerIndex === -1) {
          return null
        }
        const relativePath = path
          .slice(markerIndex + marker.length)
          .replace(/\\/g, '/')
          .replace(/^\/+/, '')
          .replace(/\?.*$/, '')
        if (!relativePath) {
          return null
        }
        return [relativePath, content] as const
      })
      .filter((entry): entry is [string, string] => entry !== null),
  )

const createBuiltinSkillDefinition = (
  id: string,
  files: Record<string, string>,
): BuiltinSkillDefinition | null => {
  const fileMap = toBuiltinFiles(files, `builtin-skills/${id}`)
  const markdown = fileMap['SKILL.md']
  if (!markdown) {
    return null
  }
  return {
    id,
    markdown,
    configTemplate: fileMap['config-template.json']
      ? (JSON.parse(fileMap['config-template.json']) as Record<string, unknown>)
      : null,
    files: fileMap,
  }
}

const BUILTIN_SKILLS: BuiltinSkillDefinition[] = [
  createBuiltinSkillDefinition('union-search', builtinUnionSearchFiles),
  createBuiltinSkillDefinition('device-info', builtinDeviceInfoFiles),
].filter((skill): skill is BuiltinSkillDefinition => skill !== null)

const toEntryKind = (type?: string): 'file' | 'directory' =>
  type === 'directory' ? 'directory' : 'file'

const sortReadEntries = (entries: ReadListEntry[]): ReadListEntry[] =>
  [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }
    return left.path.localeCompare(right.path)
  })

export const getBuiltinSkillRoot = (skillId: string): string =>
  joinRelativePath(SKILL_DIRECTORIES.builtin, skillId)

export const resolveSkillRoot = async (
  skillId: string,
): Promise<{
  root: string
  skill: SkillRecord
}> => {
  await initializeSkillHost()
  const skill = (await listSkills()).find((item) => item.id === skillId)
  if (!skill) {
    throw new Error(`未找到 skill：${skillId}`)
  }

  const root =
    skill.source === 'builtin'
      ? getBuiltinSkillRoot(skill.id)
      : joinRelativePath(INSTALLED_SKILLS_PATH, skill.id)

  if (!(await pathExists(root))) {
    throw new Error(`skill 根目录不存在：${skillId}`)
  }

  return {
    root,
    skill,
  }
}

const buildSkillTargetPath = (root: string, relativePath: string): string =>
  relativePath ? joinRelativePath(root, relativePath) : root

const enumerateSkillDirectory = async (
  root: string,
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

    const currentStoragePath = buildSkillTargetPath(root, current.path)
    const childNames = (await listDirectory(currentStoragePath)).sort((left, right) => left.localeCompare(right))

    for (const childName of childNames) {
      const childRelativePath = current.path ? joinRelativePath(current.path, childName) : childName
      const childStoragePath = buildSkillTargetPath(root, childRelativePath)
      const childStat = await statPath(childStoragePath)
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

export const listSkillDirectory = async (
  skillId: string,
  path?: string,
  depth?: number,
): Promise<{
  path: string
  depth: number
  entries: ReadListEntry[]
  truncated: boolean
}> => {
  const { root } = await resolveSkillRoot(skillId)
  const relativePath = normalizeReadRelativePath(path)
  const targetPath = buildSkillTargetPath(root, relativePath)
  const targetStat = await statPath(targetPath).catch(() => null)

  if (!targetStat) {
    throw new Error(`skill 路径不存在：${skillId}/${relativePath || '.'}`)
  }
  if (toEntryKind(targetStat.type) !== 'directory') {
    throw new Error(`目标不是目录：${skillId}/${relativePath || '.'}`)
  }

  const safeDepth = sanitizeReadDepth(depth)
  const result = await enumerateSkillDirectory(root, relativePath, safeDepth)
  return {
    path: relativePath || '.',
    depth: safeDepth,
    entries: result.entries,
    truncated: result.truncated,
  }
}

export const statSkillPath = async (
  skillId: string,
  path: string,
): Promise<{
  path: string
  entryType: 'file' | 'directory'
  size?: number
  textLikely?: boolean
}> => {
  const { root } = await resolveSkillRoot(skillId)
  const relativePath = normalizeReadRelativePath(path)
  if (!relativePath) {
    return {
      path: '.',
      entryType: 'directory',
    }
  }

  const targetPath = buildSkillTargetPath(root, relativePath)
  const targetStat = await statPath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`skill 路径不存在：${skillId}/${relativePath}`)
  }

  const entryType = toEntryKind(targetStat.type)
  return {
    path: relativePath,
    entryType,
    size: entryType === 'file' ? targetStat.size : undefined,
    textLikely: entryType === 'file' ? isTextFileLikely(relativePath) : undefined,
  }
}

export const readSkillFile = async (
  skillId: string,
  path: string,
): Promise<{
  path: string
  content: string
}> => {
  const { root } = await resolveSkillRoot(skillId)
  const relativePath = normalizeReadRelativePath(path)
  if (!relativePath) {
    throw new Error(`read 缺少 skill 文件路径：${skillId}`)
  }

  const targetPath = buildSkillTargetPath(root, relativePath)
  const targetStat = await statPath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`skill 路径不存在：${skillId}/${relativePath}`)
  }
  if (toEntryKind(targetStat.type) !== 'file') {
    throw new Error(`目标不是文件：${skillId}/${relativePath}`)
  }

  const content = await readTextFile(targetPath)
  if (!isTextFileLikely(relativePath, content)) {
    throw new Error(`目标不是可读取的文本文件：${skillId}/${relativePath}`)
  }

  return {
    path: relativePath,
    content,
  }
}

const materializeBuiltinSkill = async (skill: BuiltinSkillDefinition): Promise<void> => {
  const root = getBuiltinSkillRoot(skill.id)
  for (const [relativePath, content] of Object.entries(skill.files)) {
    await writeTextFile(joinRelativePath(root, relativePath), content)
  }
}

const synchronizeBuiltinSkills = async (): Promise<void> => {
  const expectedIds = new Set(BUILTIN_SKILLS.map((skill) => skill.id))
  const existingIds = await listDirectory(SKILL_DIRECTORIES.builtin)

  for (const existingId of existingIds) {
    if (!expectedIds.has(existingId)) {
      await deletePath(getBuiltinSkillRoot(existingId))
    }
  }

  for (const skill of BUILTIN_SKILLS) {
    const root = getBuiltinSkillRoot(skill.id)
    if (await pathExists(root)) {
      await deletePath(root)
    }
    await materializeBuiltinSkill(skill)
  }
}

const readState = async (): Promise<SkillHostState> =>
  readJsonFile<SkillHostState>(STATE_PATH, DEFAULT_STATE)

const writeState = async (state: SkillHostState): Promise<void> => {
  await writeJsonFile(STATE_PATH, state)
}

const getSkillConfigPath = (skillId: string): string => joinRelativePath(CONFIGS_PATH, `${skillId}.json`)

const loadBuiltinRecord = async (
  skill: BuiltinSkillDefinition,
  state: SkillHostState,
): Promise<SkillRecord | null> => {
  if (state.deletedBuiltinIds.includes(skill.id)) {
    return null
  }

  let document: SkillDocument
  try {
    document = parseSkillDocument(skill.markdown)
  } catch {
    document = createFallbackSkillDocument(skill.id, skill.markdown)
  }
  return {
    id: skill.id,
    source: 'builtin',
    installedAt: 0,
    enabled: state.enabledById[skill.id] ?? true,
    folderName: skill.id,
    overrideBuiltin: false,
    frontmatter: document.frontmatter,
    configTemplate: skill.configTemplate,
  }
}

const readInstalledSkillRecord = async (
  folderName: string,
  state: SkillHostState,
): Promise<SkillRecord | null> => {
  const safeId = folderName.trim()
  if (!SKILL_ID_PATTERN.test(safeId)) {
    return null
  }

  const markdownPath = joinRelativePath(INSTALLED_SKILLS_PATH, safeId, 'SKILL.md')
  if (!(await pathExists(markdownPath))) {
    return null
  }

  const content = await readTextFile(markdownPath)
  let document: SkillDocument
  try {
    document = parseSkillDocument(content)
  } catch {
    return null
  }
  const stat = Date.now()
  let configTemplate: Record<string, unknown> | null = null
  const configTemplatePath = joinRelativePath(INSTALLED_SKILLS_PATH, safeId, 'config-template.json')
  if (await pathExists(configTemplatePath)) {
    configTemplate = await readJsonFile<Record<string, unknown> | null>(configTemplatePath, null)
  }

  return {
    id: safeId,
    source: 'installed',
    installedAt: state.metadataById[safeId]?.installedAt ?? stat,
    enabled: state.enabledById[safeId] ?? true,
    folderName: safeId,
    overrideBuiltin: BUILTIN_SKILLS.some((builtin) => builtin.id === safeId),
    frontmatter: document.frontmatter,
    configTemplate,
  }
}

export const initializeSkillHost = async (): Promise<void> => {
  await initializeStorage()
  await synchronizeBuiltinSkills()
  const state = await readState()
  const deletedBuiltinIds = Array.isArray(state.deletedBuiltinIds)
    ? state.deletedBuiltinIds.filter((item) => BUILTIN_SKILLS.some((skill) => skill.id === item))
    : []
  const hasAllBuiltinsDeleted =
    BUILTIN_SKILLS.length > 0 && BUILTIN_SKILLS.every((skill) => deletedBuiltinIds.includes(skill.id))
  await writeState({
    ...DEFAULT_STATE,
    ...state,
    enabledById: { ...DEFAULT_STATE.enabledById, ...state.enabledById },
    deletedBuiltinIds: hasAllBuiltinsDeleted ? [] : deletedBuiltinIds,
    metadataById: { ...DEFAULT_STATE.metadataById, ...state.metadataById },
  })
}

export const listSkills = async (): Promise<SkillRecord[]> => {
  await initializeSkillHost()
  const state = await readState()
  const builtinRecords = (
    await Promise.all(BUILTIN_SKILLS.map((skill) => loadBuiltinRecord(skill, state)))
  ).filter((record): record is SkillRecord => record !== null)

  const installedFolders = await listDirectory(INSTALLED_SKILLS_PATH)
  const installedRecords = (
    await Promise.all(installedFolders.map((folderName) => readInstalledSkillRecord(folderName, state)))
  ).filter((record): record is SkillRecord => record !== null)

  const installedById = new Map(installedRecords.map((record) => [record.id, record]))
  const merged: SkillRecord[] = []

  for (const builtin of builtinRecords) {
    merged.push(installedById.get(builtin.id) ?? builtin)
    installedById.delete(builtin.id)
  }

  merged.push(...Array.from(installedById.values()))
  return merged.sort((left, right) => left.id.localeCompare(right.id))
}

export const readSkillConfig = async (skillId: string): Promise<Record<string, unknown>> => {
  await initializeSkillHost()
  const skill = (await listSkills()).find((item) => item.id === skillId)
  const fallback = skill?.configTemplate ?? {}
  return readJsonFile<Record<string, unknown>>(getSkillConfigPath(skillId), fallback)
}

export const writeSkillConfig = async (
  skillId: string,
  config: Record<string, unknown>,
): Promise<void> => {
  await initializeSkillHost()
  await writeJsonFile(getSkillConfigPath(skillId), config)
}

export const setSkillEnabled = async (skillId: string, enabled: boolean): Promise<void> => {
  await initializeSkillHost()
  const state = await readState()
  state.enabledById[skillId] = enabled
  await writeState(state)
}

export const deleteSkill = async (skillId: string): Promise<void> => {
  await initializeSkillHost()
  const state = await readState()
  const installedPath = joinRelativePath(INSTALLED_SKILLS_PATH, skillId)
  if (await pathExists(installedPath)) {
    await deletePath(installedPath)
  } else if (BUILTIN_SKILLS.some((item) => item.id === skillId)) {
    if (!state.deletedBuiltinIds.includes(skillId)) {
      state.deletedBuiltinIds.push(skillId)
    }
  }

  delete state.enabledById[skillId]
  delete state.metadataById[skillId]
  await writeState(state)
}

export const installSkillPackage = async (file: File): Promise<SkillInstallResult> => {
  await initializeSkillHost()
  const fallbackRootFolder = file.name.replace(/\.zip$/i, '')
  const { rootFolder, replacedExisting, skillMarkdown, configTemplate } = await installZipDirectory(
    file,
    INSTALLED_SKILLS_PATH,
    {
      allowFlatRoot: true,
      fallbackRootFolder,
    },
  )
  if (!skillMarkdown) {
    throw new Error('Skill 压缩包必须包含顶层 SKILL.md。')
  }
  if (!SKILL_ID_PATTERN.test(rootFolder)) {
    throw new Error('Skill 顶层目录名必须为 kebab-case。')
  }

  const document = parseSkillDocument(skillMarkdown)
  const state = await readState()
  state.enabledById[rootFolder] = true
  state.deletedBuiltinIds = state.deletedBuiltinIds.filter((item) => item !== rootFolder)
  state.metadataById[rootFolder] = {
    installedAt: Date.now(),
  }
  await writeState(state)

  if (configTemplate) {
    const existingConfig = await readJsonFile<Record<string, unknown>>(getSkillConfigPath(rootFolder), {})
    await writeSkillConfig(rootFolder, {
      ...configTemplate,
      ...existingConfig,
    })
  }

  const record: SkillRecord = {
    id: rootFolder,
    source: 'installed',
    installedAt: Date.now(),
    enabled: true,
    folderName: rootFolder,
    overrideBuiltin: BUILTIN_SKILLS.some((builtin) => builtin.id === rootFolder),
    frontmatter: document.frontmatter,
    configTemplate: configTemplate ?? null,
  }

  return {
    skill: record,
    replacedExisting: replacedExisting || record.overrideBuiltin,
  }
}
