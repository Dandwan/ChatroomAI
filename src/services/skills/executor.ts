import { getBuiltinSkillRoot, getSkillDocument, listSkills, readSkillConfig } from './host'
import { executeDeviceInfoSkillCall } from './device-info'
import { nativeExecuteProcess } from './native-runtime'
import { getPreferredRuntimePaths } from './runtime'
import { joinRelativePath, pathExists } from './storage'
import type { SkillCallAction, SkillExecutionResult } from './types'

const INSTALLED_SKILL_ROOT = 'skill-host/skills'

const pickNumericArgValue = (argv: string[] | undefined, option: string): number | undefined => {
  if (!argv || argv.length === 0) {
    return undefined
  }
  const index = argv.findIndex((item) => item === option)
  if (index === -1) {
    return undefined
  }
  const raw = argv[index + 1]
  if (!raw) {
    return undefined
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return undefined
  }
  return parsed
}

const resolveTimeoutMs = (action: SkillCallAction): number => {
  if (typeof action.timeoutMs === 'number' && Number.isFinite(action.timeoutMs)) {
    return Math.max(0, Math.round(action.timeoutMs))
  }
  if (action.skill !== 'runtime-shell') {
    return 30000
  }
  const waitMs = pickNumericArgValue(action.argv, '--wait-ms')
  if (waitMs === undefined) {
    return 30000
  }
  return Math.max(30000, waitMs + 5000)
}

export const readSkillSections = async (
  skillId: string,
  sections?: string[],
): Promise<Record<string, unknown>> => {
  if (!skillId || !skillId.trim()) {
    throw new Error('skill_read 缺少 skill id')
  }
  const document = await getSkillDocument(skillId)
  if (!sections || sections.length === 0) {
    return {
      skill: skillId,
      content: document.content,
    }
  }

  const picked: Record<string, string> = {}
  for (const section of sections) {
    if (document.sections[section]) {
      picked[section] = document.sections[section]
    }
  }

  return {
    skill: skillId,
    sections: picked,
  }
}

export const executeSkillCall = async (action: SkillCallAction): Promise<SkillExecutionResult> => {
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
    pythonExecutablePath: runtimePaths.pythonExecutablePath,
    nodeExecutablePath: runtimePaths.nodeExecutablePath,
  })
}
