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

export type ReadRoot = 'skill' | 'workspace'
export type ReadOp = 'list' | 'read' | 'stat'

export interface ReadAction {
  kind: 'read'
  root: ReadRoot
  op: ReadOp
  skill?: string
  path?: string
  depth?: number
  startLine?: number
  endLine?: number
}

export interface ReadListEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  size?: number
}

export interface ReadListResult {
  kind: 'list'
  root: ReadRoot
  skill?: string
  path: string
  depth: number
  entries: ReadListEntry[]
  truncated: boolean
}

export interface ReadStatResult {
  kind: 'stat'
  root: ReadRoot
  skill?: string
  path: string
  entryType: 'file' | 'directory'
  size?: number
  textLikely?: boolean
}

export interface ReadTextResult {
  kind: 'read'
  root: ReadRoot
  skill?: string
  path: string
  content: string
  lineStart: number
  lineEnd: number
  truncated: boolean
}

export type ReadExecutionResult = ReadListResult | ReadStatResult | ReadTextResult

export type AgentActionKind = 'none' | 'read' | 'skill_call'

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

export type AgentAction = ReadAction | SkillCallAction | NoAction
export type ExecutableAgentAction = ReadAction | SkillCallAction

export interface ParsedAgentAction {
  action: AgentAction
  displayText: string
}

export interface ParsedAgentActions {
  actions: ExecutableAgentAction[]
  displayText: string
  hasFinalTag: boolean
  hasActionTag: boolean
  hasInvalidAction: boolean
}

export type PromptBlockType =
  | 'app_policy'
  | 'skills_catalog'
  | 'runtime_catalog'
  | 'conversation_state'
  | 'user_input'
  | 'read_result'
  | 'read_error'
  | 'skill_call'
  | 'skill_result'
  | 'skill_error'
  | 'tag_error'

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
