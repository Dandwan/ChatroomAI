export interface SkillFrontmatter {
  name: string
  description: string
  author?: string
  version?: string
  [key: string]: unknown
}

export interface SkillDocument {
  frontmatter: SkillFrontmatter
  body: string
  content: string
  sections: Record<string, string>
}

export type SkillSource = 'builtin' | 'installed'

export interface SkillRecord {
  id: string
  source: SkillSource
  installedAt: number
  enabled: boolean
  folderName: string
  overrideBuiltin: boolean
  frontmatter: SkillFrontmatter
  configTemplate: Record<string, unknown> | null
}

export interface SkillInstallResult {
  skill: SkillRecord
  replacedExisting: boolean
}

export type RuntimeType = 'python' | 'node' | 'unknown'

export interface RuntimeRecord {
  id: string
  type: RuntimeType
  version: string
  enabled: boolean
  isDefault?: boolean
  installedAt: number
  folderName: string
  executablePath: string
  displayName: string
  testStatus?: 'ok' | 'error'
  testMessage?: string
}

export interface RuntimeInstallResult {
  runtime: RuntimeRecord
  replacedExisting: boolean
}

export interface SkillExecutionRequest {
  skillId: string
  scriptPath: string
  argv: string[]
  stdin?: string
  env?: Record<string, string>
  timeoutMs?: number
}

export interface SkillExecutionResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number
  elapsedMs: number
  resolvedCommand: string[]
  inferredRuntime: RuntimeType | 'shell' | 'native'
}

export type AgentActionKind = 'none' | 'skill_read' | 'skill_call'

export interface SkillReadAction {
  kind: 'skill_read'
  skill: string
  sections?: string[]
}

export interface SkillCallAction {
  kind: 'skill_call'
  id: string
  skill: string
  script: string
  argv?: string[]
  stdin?: string
  env?: Record<string, string>
  timeoutMs?: number
}

export interface NoAction {
  kind: 'none'
  text: string
}

export type AgentAction = SkillReadAction | SkillCallAction | NoAction
export type ExecutableAgentAction = SkillReadAction | SkillCallAction

export interface ParsedAgentAction {
  action: AgentAction
  displayText: string
}

export interface ParsedAgentActions {
  actions: ExecutableAgentAction[]
  displayText: string
}

export type PromptBlockType =
  | 'app_policy'
  | 'skills_catalog'
  | 'runtime_catalog'
  | 'conversation_state'
  | 'user_input'
  | 'skill_doc'
  | 'skill_call'
  | 'skill_result'
  | 'skill_error'

export interface PromptBlock {
  type: PromptBlockType
  title: string
  content: string
}

export interface SearchItem {
  title: string
  url: string
  snippet: string
  source: string
  publishedAt?: string
  imageUrl?: string
}
