import {
  getBuiltinSkillRoot,
  listSkillDirectory,
  listSkills,
  readSkillConfig,
  readSkillFile,
  statSkillPath,
} from './host'
import {
  buildConversationWorkspaceDirectory,
  listConversationWorkspace,
  readConversationWorkspaceFile,
  statConversationWorkspacePath,
} from '../chat-storage/repository'
import { ensureDirectory } from '../chat-storage/filesystem'
import { sliceTextByLineWindow } from '../read-utils'
import { executeDeviceInfoSkillCall } from './device-info'
import { nativeExecuteProcess } from './native-runtime'
import { getPreferredRuntimePaths } from './runtime'
import { joinRelativePath, pathExists } from './storage'
export { executeRunAction, materializeRunAction } from './run-executor'
import type {
  ReadAction,
  ReadExecutionResult,
  SkillCallAction,
  SkillExecutionResult,
} from './types'

const INSTALLED_SKILL_ROOT = 'skill-host/skills'

const resolveTimeoutMs = (action: SkillCallAction): number => {
  if (typeof action.timeoutMs === 'number' && Number.isFinite(action.timeoutMs)) {
    return Math.max(0, Math.round(action.timeoutMs))
  }
  return 30000
}

const normalizeLineNumber = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback

const buildReadTextResult = (
  action: ReadAction,
  path: string,
  content: string,
): ReadExecutionResult => {
  const requestedStartLine = normalizeLineNumber(action.startLine, 1)
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

export const executeReadAction = async (
  action: ReadAction,
  conversationId: string,
): Promise<ReadExecutionResult> => {
  if (action.root !== 'skill' && action.root !== 'workspace') {
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

export const executeSkillCall = async (
  action: SkillCallAction,
  conversationId: string,
): Promise<SkillExecutionResult> => {
  if (!action.skill?.trim()) {
    throw new Error('skill_call 缺少 skill id')
  }
  if (!action.script?.trim()) {
    throw new Error('skill_call 缺少 script 路径')
  }
  const skills = await listSkills()
  const skill = skills.find((item) => item.id === action.skill)
  if (!skill) {
    throw new Error(`未找到 skill：${action.skill}`)
  }
  if (!skill.enabled) {
    throw new Error(`skill 已停用：${action.skill}`)
  }

  const config = await readSkillConfig(skill.id)

  const relativeSkillRoot =
    skill.source === 'builtin'
      ? getBuiltinSkillRoot(skill.id)
      : joinRelativePath(INSTALLED_SKILL_ROOT, skill.id)
  if (!(await pathExists(joinRelativePath(relativeSkillRoot, action.script)))) {
    throw new Error(`skill 脚本不存在：${action.script}`)
  }

  if (skill.id === 'device-info') {
    return executeDeviceInfoSkillCall(action)
  }

  const runtimePaths = await getPreferredRuntimePaths()
  const relativeWorkingDirectory = buildConversationWorkspaceDirectory(conversationId)
  await ensureDirectory(relativeWorkingDirectory)
  return nativeExecuteProcess({
    skillId: action.skill,
    scriptPath: action.script,
    argv: action.argv ?? [],
    stdin: action.stdin,
    env: {
      ...(action.env ?? {}),
      SKILL_CONFIG_JSON: JSON.stringify(config),
    },
    timeoutMs: resolveTimeoutMs(action),
    relativeSkillRoot,
    relativeWorkingDirectory,
    pythonExecutablePath: runtimePaths.pythonExecutablePath,
    nodeExecutablePath: runtimePaths.nodeExecutablePath,
  })
}
