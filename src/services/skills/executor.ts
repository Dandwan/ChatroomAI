import { getBuiltinSkillRoot, getSkillDocument, listSkills, readSkillConfig } from './host'
import { nativeExecuteProcess } from './native-runtime'
import { getPreferredRuntimePaths } from './runtime'
import { joinRelativePath, pathExists } from './storage'
import type { SkillCallAction, SkillExecutionResult } from './types'

const INSTALLED_SKILL_ROOT = 'skill-host/skills'

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
    timeoutMs: action.timeoutMs ?? 30000,
    relativeSkillRoot,
    pythonExecutablePath: runtimePaths.pythonExecutablePath,
    nodeExecutablePath: runtimePaths.nodeExecutablePath,
  })
}
