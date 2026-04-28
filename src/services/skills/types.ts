export interface SkillFrontmatter {
  name: string
  description: string
  author?: string
  version?: string
  hidden?: boolean
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
  binDirectoryPath?: string
  commands?: string[]
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

export interface RunExecutionResult {
  ok: boolean
  running: boolean
  session: string
  stdout: string
  stderr: string
  exitCode: number | null
  elapsedMs: number
  waitedMs: number
  resolvedCommand: string[]
  resolvedCwd: string
  inferredRuntime: RuntimeType | 'shell' | 'native' | 'system'
  pid?: number | null
  startedAt?: number
  updatedAt: number
  completedAt?: number
}

export interface BrowserVisitHeading {
  level: number
  text: string
}

export interface BrowserVisitLink {
  text: string
  url: string
  title?: string
}

export interface BrowserVisitImage {
  alt?: string
  url: string
  title?: string
}

export interface BrowserVisitMetadata {
  requestedUrl?: string
  finalUrl?: string
  title?: string
  description?: string
  lang?: string
  canonicalUrl?: string
  siteName?: string
  author?: string
  publishedAt?: string
  modifiedAt?: string
  keywords?: string
  contentType?: string
  status?: number
  blockedBy?: string
  questionId?: string
  challengeScriptUrl?: string
  [key: string]: unknown
}

export interface BrowserVisitResult {
  title: string
  url: string
  finalUrl?: string
  description?: string
  content: string
  contentFormat: 'markdown'
  contentText?: string
  engine: string
  headings?: BrowserVisitHeading[]
  links?: BrowserVisitLink[]
  images?: BrowserVisitImage[]
  metadata?: BrowserVisitMetadata
  warnings?: string[]
  truncated?: boolean
}

export type ReadRoot = 'skill' | 'workspace'
export type ReadOp = 'list' | 'read' | 'stat'
export type RunRoot = 'skill' | 'workspace' | 'home' | 'absolute'

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

export type AgentActionKind = 'none' | 'read' | 'run' | 'skill_call'

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

export interface RunAction {
  kind: 'run'
  id: string
  root: RunRoot
  skill?: string
  cwd?: string
  command?: string
  stdin?: string
  env?: Record<string, string>
  waitMs?: number
  session?: string
}

export interface RunCommandRegistration {
  command: string
  executablePath: string
  env?: Record<string, string>
  source: string
}

export type RunLaunchKind = 'file' | 'executable'

export interface RunResolvedLaunch {
  kind: RunLaunchKind
  targetPath: string
  args: string[]
  pythonExecutablePath?: string
  nodeExecutablePath?: string
  inferredRuntime?: RuntimeType | 'shell' | 'native' | 'system'
}

export interface NoAction {
  kind: 'none'
  text: string
}

export type AgentAction = ReadAction | RunAction | SkillCallAction | NoAction
export type ExecutableAgentAction = ReadAction | RunAction | SkillCallAction

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
  | 'run'
  | 'run_result'
  | 'run_error'
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
