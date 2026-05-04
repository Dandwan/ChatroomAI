import {
  getBuiltinSkillRoot,
  listSkills,
  readSkillConfig,
} from './host'
import { buildConversationWorkspaceDirectory } from '../chat-storage/repository'
import { ensureDirectory } from '../chat-storage/filesystem'
import { executeDeviceInfoSkillCall } from './device-info'
import { nativeExecuteProcess } from './native-runtime'
import { getPreferredRuntimePaths } from './runtime'
import { joinRelativePath, pathExists } from './storage'
export { executeRunAction, materializeRunAction } from './run-executor'
export { executeReadAction, executeEditAction } from './location-files'
import type {
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
