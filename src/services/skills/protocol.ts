import { renderSkillsCatalogYaml } from './frontmatter'
import {
  parseInternalActionLocation,
  toExternalActionLocation,
} from './action-location'
import type {
  ExecutableAgentAction,
  EditAction,
  EditOperation,
  ParsedAgentActions,
  PromptBlock,
  RuntimeRecord,
  SkillRecord,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const TAGS = {
  progress: 'progress',
  read: 'read',
  run: 'run',
  edit: 'edit',
  skillCall: 'skill_call',
  final: 'final',
}

const OPEN_TAGS = {
  progress: `<${TAGS.progress}>`,
  read: `<${TAGS.read}>`,
  run: `<${TAGS.run}>`,
  edit: `<${TAGS.edit}>`,
  skillCall: `<${TAGS.skillCall}>`,
  think: '<think>',
  final: `<${TAGS.final}>`,
} as const

const CLOSE_TAGS = {
  progress: `</${TAGS.progress}>`,
  read: `</${TAGS.read}>`,
  run: `</${TAGS.run}>`,
  edit: `</${TAGS.edit}>`,
  skillCall: `</${TAGS.skillCall}>`,
  think: '</think>',
  final: `</${TAGS.final}>`,
} as const

type StreamParserMode = 'root' | 'progress' | 'final' | 'read' | 'run' | 'edit' | 'skill_call' | 'think'
type SkillActionTag = 'read' | 'run' | 'edit' | 'skill_call'

interface EditPreviewOperation {
  op: EditOperation['op']
  beforeLine?: number
  afterLine?: number
  startLine?: number
  endLine?: number
}

export interface SkillActionPreview {
  kind: 'read' | 'run' | 'edit' | 'skill_call'
  id?: string
  root?: string
  op?: string
  skill?: string
  path?: string
  depth?: number
  startLine?: number
  endLine?: number
  cwd?: string
  command?: string
  session?: string
  waitMs?: number
  script?: string
  argv?: string[]
  stdin?: string
  env?: Record<string, string>
  timeoutMs?: number
  createIfMissing?: boolean
  previewContextLines?: number
  editCount?: number
  edits?: EditPreviewOperation[]
}

export interface SkillActionStreamEvent {
  type: 'open' | 'update' | 'close'
  token: string
  tag: SkillActionTag
  body: string
  preview: SkillActionPreview
  action?: ExecutableAgentAction
  error?: string
}

const SKILL_ACTION_PLACEHOLDER_PREFIX = '[[SKILL_ACTION:'
const SKILL_ACTION_PLACEHOLDER_SUFFIX = ']]'

export const createSkillActionPlaceholder = (token: string): string =>
  `${SKILL_ACTION_PLACEHOLDER_PREFIX}${token}${SKILL_ACTION_PLACEHOLDER_SUFFIX}`

export interface SkillActionPlaceholderSegment {
  kind: 'text' | 'token'
  value: string
}

export const splitSkillActionPlaceholders = (text: string): SkillActionPlaceholderSegment[] => {
  const pattern = /\[\[SKILL_ACTION:([^\]]+)\]\]/g
  const segments: SkillActionPlaceholderSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const leading = text.slice(cursor, index)
    if (leading) {
      segments.push({ kind: 'text', value: leading })
    }
    const token = match[1]?.trim()
    if (token) {
      segments.push({ kind: 'token', value: token })
    }
    cursor = index + match[0].length
  }

  const trailing = text.slice(cursor)
  if (trailing) {
    segments.push({ kind: 'text', value: trailing })
  }

  if (segments.length === 0) {
    return [{ kind: 'text', value: text }]
  }
  return segments
}

export interface AgentStreamDelta {
  content: string
  reasoning: string
  actionEvents: SkillActionStreamEvent[]
}

export interface SkillAgentProtocolExtraction {
  cleanedText: string
  reasoningText: string
}

export type SkillAgentProtocolRepairCode =
  | 'wrapped_plain_text_in_final'
  | 'wrapped_action_text_in_progress'
  | 'collapsed_duplicate_progress_tags'
  | 'collapsed_duplicate_final_tags'
  | 'merged_mixed_top_level_tags'
  | 'converted_final_with_actions_to_progress'
  | 'closed_unterminated_progress_tag'
  | 'closed_unterminated_final_tag'
  | 'ignored_orphan_progress_closer'
  | 'ignored_orphan_final_closer'

export interface SkillAgentProtocolRepair {
  code: SkillAgentProtocolRepairCode
}

export type SkillAgentProtocolRetryReason =
  | 'empty_response'
  | 'invalid_action_payload'
  | 'progress_without_actions'

export interface SkillAgentProgressOutcome {
  kind: 'progress'
  normalizedEnvelope: string
  normalizedBody: string
  displayText: string
  actions: ExecutableAgentAction[]
  repairs: SkillAgentProtocolRepair[]
  reasoningText: string
}

export interface SkillAgentFinalOutcome {
  kind: 'final'
  normalizedEnvelope: string
  normalizedBody: string
  finalText: string
  repairs: SkillAgentProtocolRepair[]
  reasoningText: string
}

export interface SkillAgentRetryOutcome {
  kind: 'retry'
  displayText: string
  retryReason: SkillAgentProtocolRetryReason
  retryPrompt: string
  repairs: SkillAgentProtocolRepair[]
  reasoningText: string
}

export type SkillAgentProtocolOutcome =
  | SkillAgentProgressOutcome
  | SkillAgentFinalOutcome
  | SkillAgentRetryOutcome

interface AgentStreamParser {
  push: (chunk: string) => AgentStreamDelta
  flush: () => AgentStreamDelta
  hasSeenFinalTag: () => boolean
  hasOpenAction: () => boolean
}

const createAgentStreamDelta = (): AgentStreamDelta => ({
  content: '',
  reasoning: '',
  actionEvents: [],
})

const appendAgentStreamDelta = (
  delta: AgentStreamDelta,
  mode: StreamParserMode,
  value: string,
): void => {
  if (!value) {
    return
  }

  if (mode === 'root' || mode === 'progress' || mode === 'final') {
    delta.content += value
    return
  }

  if (mode === 'think') {
    delta.reasoning += value
  }
}

const getExpectedTagsForMode = (mode: StreamParserMode): string[] => {
  switch (mode) {
    case 'root':
      return [
        OPEN_TAGS.progress,
        CLOSE_TAGS.progress,
        OPEN_TAGS.read,
        OPEN_TAGS.run,
        OPEN_TAGS.edit,
        OPEN_TAGS.skillCall,
        OPEN_TAGS.think,
        OPEN_TAGS.final,
        CLOSE_TAGS.final,
      ]
    case 'progress':
      return [OPEN_TAGS.read, OPEN_TAGS.run, OPEN_TAGS.edit, OPEN_TAGS.skillCall, OPEN_TAGS.think, CLOSE_TAGS.progress]
    case 'final':
      return [OPEN_TAGS.read, OPEN_TAGS.run, OPEN_TAGS.edit, OPEN_TAGS.skillCall, OPEN_TAGS.think, CLOSE_TAGS.final]
    case 'read':
      return [CLOSE_TAGS.read]
    case 'run':
      return [CLOSE_TAGS.run]
    case 'edit':
      return [CLOSE_TAGS.edit]
    case 'skill_call':
      return [CLOSE_TAGS.skillCall]
    case 'think':
      return [CLOSE_TAGS.think]
    default:
      return []
  }
}

const getNextModeForTag = (tag: string): StreamParserMode | null => {
  switch (tag) {
    case OPEN_TAGS.progress:
      return 'progress'
    case OPEN_TAGS.read:
      return 'read'
    case OPEN_TAGS.run:
      return 'run'
    case OPEN_TAGS.edit:
      return 'edit'
    case OPEN_TAGS.skillCall:
      return 'skill_call'
    case OPEN_TAGS.think:
      return 'think'
    case OPEN_TAGS.final:
      return 'final'
    default:
      return null
  }
}

const getClosedModeForTag = (tag: string): StreamParserMode | null => {
  switch (tag) {
    case CLOSE_TAGS.progress:
      return 'progress'
    case CLOSE_TAGS.read:
      return 'read'
    case CLOSE_TAGS.run:
      return 'run'
    case CLOSE_TAGS.edit:
      return 'edit'
    case CLOSE_TAGS.skillCall:
      return 'skill_call'
    case CLOSE_TAGS.think:
      return 'think'
    case CLOSE_TAGS.final:
      return 'final'
    default:
      return null
  }
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeJsonString = (value: string): string => {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
  }
}

const pickPartialString = (body: string, keys: string[]): string | undefined => {
  for (const key of keys) {
    const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`)
    const match = body.match(pattern)
    if (match && match[1]) {
      const decoded = decodeJsonString(match[1]).trim()
      if (decoded) {
        return decoded
      }
    }
  }
  return undefined
}

const pickPartialStringArray = (body: string, keys: string[]): string[] | undefined => {
  for (const key of keys) {
    const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(\\[[\\s\\S]*?\\])`)
    const match = body.match(pattern)
    if (!match || !match[1]) {
      continue
    }

    try {
      const parsed = JSON.parse(match[1]) as unknown
      if (!Array.isArray(parsed)) {
        continue
      }
      const values = parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
      if (values.length > 0) {
        return values
      }
    } catch {
      // Ignore partial JSON fragments until they become valid.
    }
  }
  return undefined
}

const pickPartialStringRecord = (body: string, keys: string[]): Record<string, string> | undefined => {
  for (const key of keys) {
    const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(\\{[\\s\\S]*?\\})`)
    const match = body.match(pattern)
    if (!match || !match[1]) {
      continue
    }

    try {
      const parsed = JSON.parse(match[1]) as unknown
      if (!isRecord(parsed)) {
        continue
      }
      const entries = Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([entryKey, entryValue]) => [entryKey, entryValue.trim()] as const)
        .filter(([, entryValue]) => entryValue.length > 0)
      if (entries.length > 0) {
        return Object.fromEntries(entries)
      }
    } catch {
      // Ignore partial JSON fragments until they become valid.
    }
  }
  return undefined
}

const pickPartialNumber = (body: string, keys: string[]): number | undefined => {
  for (const key of keys) {
    const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`)
    const match = body.match(pattern)
    if (!match || !match[1]) {
      continue
    }
    const parsed = Number(match[1])
    if (Number.isFinite(parsed)) {
      return Math.round(parsed)
    }
  }
  return undefined
}

const pickPartialBoolean = (body: string, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(true|false)`, 'i')
    const match = body.match(pattern)
    if (!match || !match[1]) {
      continue
    }
    return match[1].toLowerCase() === 'true'
  }
  return undefined
}

const pickPartialActionRoot = (body: string): string | undefined =>
  parseInternalActionLocation(pickPartialString(body, ['location', 'root']))

const pickActionRoot = (
  payload: Record<string, unknown>,
): string | undefined => {
  const location = pickString(payload, ['location', 'root'])
  return parseInternalActionLocation(location)
}

const buildSkillActionPreview = (
  tag: SkillActionTag,
  body: string,
): SkillActionPreview => {
  if (tag === 'read') {
    return {
      kind: 'read',
      root: pickPartialActionRoot(body),
      op: pickPartialString(body, ['op']),
      skill: pickPartialString(body, ['skill', 'skillId', 'name']),
      path: pickPartialString(body, ['path']),
      depth: pickPartialNumber(body, ['depth']),
      startLine: pickPartialNumber(body, ['startLine']),
      endLine: pickPartialNumber(body, ['endLine']),
    }
  }

  if (tag === 'run') {
    return {
      kind: 'run',
      id: pickPartialString(body, ['id', 'callId']),
      root: pickPartialActionRoot(body),
      skill: pickPartialString(body, ['skill', 'skillId', 'name']),
      cwd: pickPartialString(body, ['cwd']),
      command: pickPartialString(body, ['command']),
      session: pickPartialString(body, ['session']),
      stdin: pickPartialString(body, ['stdin', 'input']),
      env: pickPartialStringRecord(body, ['env']),
      waitMs: pickPartialNumber(body, ['waitMs']),
    }
  }

  if (tag === 'edit') {
    const preview: SkillActionPreview = {
      kind: 'edit',
      root: pickPartialActionRoot(body),
      path: pickPartialString(body, ['path']),
      createIfMissing: pickPartialBoolean(body, ['createIfMissing']),
      previewContextLines: pickPartialNumber(body, ['previewContextLines']),
    }

    try {
      const payload = JSON.parse(body) as unknown
      if (!isRecord(payload)) {
        return preview
      }
      const edits = Array.isArray(payload.edits)
        ? payload.edits
            .filter((value): value is Record<string, unknown> => isRecord(value) && typeof value.op === 'string')
            .map((value) => ({
              op: value.op as EditOperation['op'],
              beforeLine:
                typeof value.beforeLine === 'number' && Number.isFinite(value.beforeLine)
                  ? Math.round(value.beforeLine)
                  : undefined,
              afterLine:
                typeof value.afterLine === 'number' && Number.isFinite(value.afterLine)
                  ? Math.round(value.afterLine)
                  : undefined,
              startLine:
                typeof value.startLine === 'number' && Number.isFinite(value.startLine)
                  ? Math.round(value.startLine)
                  : undefined,
              endLine:
                typeof value.endLine === 'number' && Number.isFinite(value.endLine)
                  ? Math.round(value.endLine)
                  : undefined,
            }))
        : []
      return {
        ...preview,
        editCount: edits.length,
        edits: edits.length > 0 ? edits : undefined,
      }
    } catch {
      return preview
    }
  }

  return {
    kind: 'skill_call',
    id: pickPartialString(body, ['id', 'callId']),
    skill: pickPartialString(body, ['skill', 'skillId', 'name']),
    script: pickPartialString(body, ['script', 'scriptPath', 'path', 'entry']),
    argv: pickPartialStringArray(body, ['argv', 'args']),
    stdin: pickPartialString(body, ['stdin', 'input']),
    env: pickPartialStringRecord(body, ['env']),
    timeoutMs: pickPartialNumber(body, ['timeoutMs']),
  }
}

export const createAgentStreamParser = (): AgentStreamParser => {
  const modeStack: StreamParserMode[] = ['root']
  let pendingTag = ''
  let activeActionToken = 0
  let hasSeenFinalTag = false
  let activeAction:
    | {
        token: string
        tag: SkillActionTag
        body: string
      }
    | null = null

  const getCurrentMode = (): StreamParserMode => modeStack[modeStack.length - 1] ?? 'root'

  const handleCompletedTag = (
    tag: string,
    delta: AgentStreamDelta,
  ): void => {
    if (tag === OPEN_TAGS.final) {
      hasSeenFinalTag = true
    }

    const nextMode = getNextModeForTag(tag)
    if (nextMode) {
      modeStack.push(nextMode)
      if (nextMode === 'read' || nextMode === 'run' || nextMode === 'edit' || nextMode === 'skill_call') {
        activeActionToken += 1
        activeAction = {
          token: `action-${activeActionToken}`,
          tag: nextMode,
          body: '',
        }
        appendAgentStreamDelta(delta, getCurrentMode(), createSkillActionPlaceholder(activeAction.token))
        delta.actionEvents.push({
          type: 'open',
          token: activeAction.token,
          tag: nextMode,
          body: '',
          preview: buildSkillActionPreview(nextMode, ''),
        })
      }
      return
    }

    const closedMode = getClosedModeForTag(tag)
    if (!closedMode) {
      return
    }

    if (getCurrentMode() === closedMode && modeStack.length > 1) {
      if (
        (closedMode === 'read' || closedMode === 'run' || closedMode === 'edit' || closedMode === 'skill_call') &&
        activeAction &&
        activeAction.tag === closedMode
      ) {
        const body = activeAction.body.trim()
        const preview = buildSkillActionPreview(closedMode, body)
        const parsedAction =
          closedMode === 'read'
            ? parseReadAction(body)
            : closedMode === 'run'
              ? parseRunAction(body)
              : closedMode === 'edit'
                ? parseEditAction(body)
              : parseSkillCallAction(body)
        delta.actionEvents.push({
          type: 'close',
          token: activeAction.token,
          tag: closedMode,
          body,
          preview,
          action: parsedAction ?? undefined,
          error: parsedAction ? undefined : '指令体不是合法 JSON 或缺少必填字段',
        })
        activeAction = null
      }
      modeStack.pop()
    }
  }

  const push = (chunk: string): AgentStreamDelta => {
    const delta = createAgentStreamDelta()
    let hasActionBodyUpdate = false

    const appendValue = (
      mode: StreamParserMode,
      value: string,
    ): void => {
      appendAgentStreamDelta(delta, mode, value)
      if (
        (mode === 'read' || mode === 'run' || mode === 'edit' || mode === 'skill_call') &&
        activeAction &&
        activeAction.tag === mode
      ) {
        activeAction.body += value
        hasActionBodyUpdate = true
      }
    }

    for (const character of chunk) {
      const currentMode = getCurrentMode()
      if (pendingTag.length > 0) {
        const candidate = `${pendingTag}${character}`
        const expectedTags = getExpectedTagsForMode(currentMode)

        if (expectedTags.some((tag) => tag.startsWith(candidate))) {
          pendingTag = candidate
          if (expectedTags.includes(candidate)) {
            handleCompletedTag(candidate, delta)
            pendingTag = ''
          }
          continue
        }

        appendValue(currentMode, candidate)
        pendingTag = ''
        continue
      }

      if (character === '<') {
        pendingTag = character
        continue
      }

      appendValue(currentMode, character)
    }

    if (hasActionBodyUpdate && activeAction) {
      delta.actionEvents.push({
        type: 'update',
        token: activeAction.token,
        tag: activeAction.tag,
        body: activeAction.body,
        preview: buildSkillActionPreview(activeAction.tag, activeAction.body),
      })
    }

    return delta
  }

  const flush = (): AgentStreamDelta => {
    const delta = createAgentStreamDelta()
    let hasActionBodyUpdate = false

    const appendValue = (
      mode: StreamParserMode,
      value: string,
    ): void => {
      appendAgentStreamDelta(delta, mode, value)
      if (
        (mode === 'read' || mode === 'run' || mode === 'edit' || mode === 'skill_call') &&
        activeAction &&
        activeAction.tag === mode
      ) {
        activeAction.body += value
        hasActionBodyUpdate = true
      }
    }

    if (pendingTag.length > 0) {
      appendValue(getCurrentMode(), pendingTag)
      pendingTag = ''
    }
    if (hasActionBodyUpdate && activeAction) {
      delta.actionEvents.push({
        type: 'update',
        token: activeAction.token,
        tag: activeAction.tag,
        body: activeAction.body,
        preview: buildSkillActionPreview(activeAction.tag, activeAction.body),
      })
    }
    return delta
  }

  return {
    push,
    flush,
    hasSeenFinalTag: () => hasSeenFinalTag,
    hasOpenAction: () =>
      activeAction !== null ||
      modeStack.some((mode) => mode === 'read' || mode === 'run' || mode === 'edit' || mode === 'skill_call'),
  }
}

const pickString = (
  source: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

const pickStringArray = (
  source: Record<string, unknown>,
  keys: string[],
): string[] | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) {
      const items = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
      return items.length > 0 ? items : undefined
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }
  return undefined
}

const pickStringRecord = (
  source: Record<string, unknown>,
  keys: string[],
): Record<string, string> | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (!isRecord(value)) {
      continue
    }
    const entries = Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([entryKey, entryValue]) => [entryKey, entryValue.trim()] as const)
      .filter(([, entryValue]) => entryValue.length > 0)
    if (entries.length > 0) {
      return Object.fromEntries(entries)
    }
  }
  return undefined
}

const parseReadAction = (body: string): ExecutableAgentAction | null => {
  try {
    const payload = JSON.parse(body) as unknown
    if (!isRecord(payload)) {
      return null
    }

    const root = pickActionRoot(payload)
    const op = pickString(payload, ['op'])
    if (
      (root !== 'skill' && root !== 'workspace' && root !== 'home' && root !== 'absolute') ||
      (op !== 'list' && op !== 'read' && op !== 'stat')
    ) {
      return null
    }

    const skill = pickString(payload, ['skill', 'skillId', 'name'])
    if (root === 'skill' && !skill) {
      return null
    }

    return {
      kind: 'read',
      root,
      op,
      skill,
      path: pickString(payload, ['path']),
      depth:
        typeof payload.depth === 'number' && Number.isFinite(payload.depth)
          ? Math.max(1, Math.round(payload.depth))
          : undefined,
      startLine:
        typeof payload.startLine === 'number' && Number.isFinite(payload.startLine)
          ? Math.max(1, Math.round(payload.startLine))
          : undefined,
      endLine:
        typeof payload.endLine === 'number' && Number.isFinite(payload.endLine)
          ? Math.max(1, Math.round(payload.endLine))
          : undefined,
    }
  } catch {
    return null
  }
}

const parseEditAction = (body: string): ExecutableAgentAction | null => {
  try {
    const payload = JSON.parse(body) as unknown
    if (!isRecord(payload)) {
      return null
    }

    const root = pickActionRoot(payload)
    const path = pickString(payload, ['path'])
    const edits = Array.isArray(payload.edits) ? payload.edits : null
    if ((root !== 'workspace' && root !== 'home' && root !== 'absolute') || !path || !edits || edits.length === 0) {
      return null
    }

    const normalizedEdits: EditAction['edits'] = []
    for (const rawEdit of edits) {
      if (!isRecord(rawEdit)) {
        return null
      }
      const op = pickString(rawEdit, ['op'])
      if (op === 'insert') {
        const text = typeof rawEdit.text === 'string' ? rawEdit.text : undefined
        if (text === undefined) {
          return null
        }
        normalizedEdits.push({
          op: 'insert',
          beforeLine:
            typeof rawEdit.beforeLine === 'number' && Number.isFinite(rawEdit.beforeLine)
              ? Math.round(rawEdit.beforeLine)
              : undefined,
          afterLine:
            typeof rawEdit.afterLine === 'number' && Number.isFinite(rawEdit.afterLine)
              ? Math.round(rawEdit.afterLine)
              : undefined,
          text,
          expectedText: typeof rawEdit.expectedText === 'string' ? rawEdit.expectedText : undefined,
        })
        continue
      }

      if (op === 'delete') {
        if (
          typeof rawEdit.startLine !== 'number' ||
          !Number.isFinite(rawEdit.startLine) ||
          typeof rawEdit.endLine !== 'number' ||
          !Number.isFinite(rawEdit.endLine)
        ) {
          return null
        }
        normalizedEdits.push({
          op: 'delete',
          startLine: Math.round(rawEdit.startLine),
          endLine: Math.round(rawEdit.endLine),
          expectedText: typeof rawEdit.expectedText === 'string' ? rawEdit.expectedText : undefined,
        })
        continue
      }

      if (op === 'replace') {
        if (
          typeof rawEdit.startLine !== 'number' ||
          !Number.isFinite(rawEdit.startLine) ||
          typeof rawEdit.endLine !== 'number' ||
          !Number.isFinite(rawEdit.endLine) ||
          typeof rawEdit.text !== 'string'
        ) {
          return null
        }
        normalizedEdits.push({
          op: 'replace',
          startLine: Math.round(rawEdit.startLine),
          endLine: Math.round(rawEdit.endLine),
          text: rawEdit.text,
          expectedText: typeof rawEdit.expectedText === 'string' ? rawEdit.expectedText : undefined,
        })
        continue
      }

      return null
    }

    return {
      kind: 'edit',
      root,
      path,
      createIfMissing: payload.createIfMissing === true,
      previewContextLines:
        typeof payload.previewContextLines === 'number' && Number.isFinite(payload.previewContextLines)
          ? Math.round(payload.previewContextLines)
          : undefined,
      edits: normalizedEdits,
    }
  } catch {
    return null
  }
}

const parseSkillCallAction = (body: string): ExecutableAgentAction | null => {
  try {
    const payload = JSON.parse(body) as unknown
    if (!isRecord(payload)) {
      return null
    }

    const skill = pickString(payload, ['skill', 'skillId', 'name'])
    const script = pickString(payload, ['script', 'scriptPath', 'path', 'entry'])
    if (!skill || !script) {
      return null
    }

    return {
      kind: 'skill_call',
      id: pickString(payload, ['id', 'callId']) ?? `${skill}:${script}`,
      skill,
      script,
      argv: pickStringArray(payload, ['argv', 'args']),
      stdin: pickString(payload, ['stdin', 'input']),
      env: pickStringRecord(payload, ['env']),
      timeoutMs:
        typeof payload.timeoutMs === 'number' && Number.isFinite(payload.timeoutMs)
          ? Math.max(0, Math.round(payload.timeoutMs))
          : undefined,
    }
  } catch {
    return null
  }
}

const parseRunAction = (body: string): ExecutableAgentAction | null => {
  try {
    const payload = JSON.parse(body) as unknown
    if (!isRecord(payload)) {
      return null
    }

    const root = pickActionRoot(payload)
    if (root !== 'skill' && root !== 'workspace' && root !== 'home' && root !== 'absolute') {
      return null
    }

    const skill = pickString(payload, ['skill', 'skillId', 'name'])
    if (root === 'skill' && !skill) {
      return null
    }

    const command = pickString(payload, ['command'])
    const session = pickString(payload, ['session'])

    return {
      kind: 'run',
      id:
        pickString(payload, ['id', 'callId']) ??
        `${root}:${skill ?? ''}:${pickString(payload, ['cwd']) ?? '.'}:${session ?? 'auto'}`,
      root,
      skill,
      cwd: pickString(payload, ['cwd']),
      command,
      stdin: pickString(payload, ['stdin', 'input']),
      env: pickStringRecord(payload, ['env']),
      waitMs:
        typeof payload.waitMs === 'number' && Number.isFinite(payload.waitMs)
          ? Math.max(0, Math.round(payload.waitMs))
          : undefined,
      session,
    }
  } catch {
    return null
  }
}

type ProtocolTopLevelKind = 'progress' | 'final'

interface ParsedTopLevelEnvelope {
  kind: ProtocolTopLevelKind
  bodyText: string
  repairs: SkillAgentProtocolRepair[]
}

type ActionBodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'action'; action: ExecutableAgentAction }

interface ParsedActionBody {
  segments: ActionBodySegment[]
  displayText: string
  actions: ExecutableAgentAction[]
  hasActionTag: boolean
  hasInvalidAction: boolean
}

const normalizeProtocolText = (value: string): string => value.replace(/\r\n/g, '\n')

export const extractSkillAgentProtocolText = (text: string): SkillAgentProtocolExtraction => {
  const reasoningChunks: string[] = []
  const cleanedText = normalizeProtocolText(
    text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, captured: string) => {
      const normalized = captured.trim()
      if (normalized) {
        reasoningChunks.push(normalized)
      }
      return ''
    }),
  ).trim()

  return {
    cleanedText,
    reasoningText: reasoningChunks.join('\n\n').trim(),
  }
}

const countTag = (text: string, pattern: RegExp): number => [...text.matchAll(pattern)].length

const hasActionMarkup = (text: string): boolean => /<\/?(read|run|edit|skill_call)>/i.test(text)

const parseTopLevelEnvelope = (text: string): ParsedTopLevelEnvelope | null => {
  const trimmed = normalizeProtocolText(text).trim()
  if (!trimmed) {
    return null
  }

  const repairs: SkillAgentProtocolRepair[] = []
  const progressOpenCount = countTag(trimmed, /<progress>/gi)
  const progressCloseCount = countTag(trimmed, /<\/progress>/gi)
  const finalOpenCount = countTag(trimmed, /<final>/gi)
  const finalCloseCount = countTag(trimmed, /<\/final>/gi)
  const hasProgressMarkers = progressOpenCount > 0 || progressCloseCount > 0
  const hasFinalMarkers = finalOpenCount > 0 || finalCloseCount > 0
  const containsActions = hasActionMarkup(trimmed)

  let kind: ProtocolTopLevelKind
  if (!hasProgressMarkers && !hasFinalMarkers) {
    kind = containsActions ? 'progress' : 'final'
    repairs.push({
      code: containsActions ? 'wrapped_action_text_in_progress' : 'wrapped_plain_text_in_final',
    })
  } else if (hasProgressMarkers && hasFinalMarkers) {
    kind = containsActions ? 'progress' : 'final'
    repairs.push({ code: 'merged_mixed_top_level_tags' })
  } else if (hasProgressMarkers) {
    kind = 'progress'
  } else {
    kind = containsActions ? 'progress' : 'final'
    if (containsActions) {
      repairs.push({ code: 'converted_final_with_actions_to_progress' })
    }
  }

  if (progressOpenCount > 1 || progressCloseCount > 1) {
    repairs.push({ code: 'collapsed_duplicate_progress_tags' })
  }
  if (finalOpenCount > 1 || finalCloseCount > 1) {
    repairs.push({ code: 'collapsed_duplicate_final_tags' })
  }
  if (progressCloseCount > progressOpenCount) {
    repairs.push({ code: 'ignored_orphan_progress_closer' })
  }
  if (finalCloseCount > finalOpenCount) {
    repairs.push({ code: 'ignored_orphan_final_closer' })
  }
  if (kind === 'progress' && progressOpenCount > progressCloseCount) {
    repairs.push({ code: 'closed_unterminated_progress_tag' })
  }
  if (kind === 'final' && finalOpenCount > finalCloseCount) {
    repairs.push({ code: 'closed_unterminated_final_tag' })
  }

  const bodyText = trimmed
    .replace(/<\/?progress>/gi, '')
    .replace(/<\/?final>/gi, '')
    .trim()

  return {
    kind,
    bodyText,
    repairs,
  }
}

const ACTION_TAG_PATTERN = /<(read|run|edit|skill_call)>([\s\S]*?)<\/\1>/gi
const LOOSE_ACTION_TAG_PATTERN = /<\/?(read|run|edit|skill_call)>/i

const parseActionBody = (bodyText: string): ParsedActionBody => {
  const normalizedBody = normalizeProtocolText(bodyText)
  const segments: ActionBodySegment[] = []
  const actions: ExecutableAgentAction[] = []
  let hasInvalidAction = false
  let hasActionTag = false
  let cursor = 0

  for (const match of normalizedBody.matchAll(ACTION_TAG_PATTERN)) {
    const index = match.index ?? 0
    const leading = normalizedBody.slice(cursor, index)
    if (leading) {
      segments.push({ kind: 'text', text: leading })
    }

    hasActionTag = true
    const tag = match[1]?.toLowerCase()
    const body = match[2]?.trim() ?? ''
    const action =
      tag === 'read'
        ? parseReadAction(body)
        : tag === 'run'
          ? parseRunAction(body)
          : tag === 'edit'
            ? parseEditAction(body)
          : tag === 'skill_call'
            ? parseSkillCallAction(body)
            : null
    if (!action) {
      hasInvalidAction = true
      break
    }
    segments.push({ kind: 'action', action })
    actions.push(action)
    cursor = index + match[0].length
  }

  const trailing = normalizedBody.slice(cursor)
  if (trailing) {
    segments.push({ kind: 'text', text: trailing })
  }

  if (!hasInvalidAction) {
    const hasLooseActionTag = segments.some(
      (segment) => segment.kind === 'text' && LOOSE_ACTION_TAG_PATTERN.test(segment.text),
    )
    if (hasLooseActionTag) {
      hasInvalidAction = true
    }
  }

  const displayText = segments
    .flatMap((segment) => (segment.kind === 'text' ? [segment.text.trim()] : []))
    .filter(Boolean)
    .join('\n\n')
    .trim()

  return {
    segments,
    displayText,
    actions: hasInvalidAction ? [] : actions,
    hasActionTag,
    hasInvalidAction,
  }
}

const serializeAction = (action: ExecutableAgentAction): string => {
  if (action.kind === 'read') {
    return [
      '<read>',
      JSON.stringify(
        {
          location: toExternalActionLocation(action.root),
          op: action.op,
          ...(action.skill ? { skill: action.skill } : {}),
          ...(action.path ? { path: action.path } : {}),
          ...(action.depth !== undefined ? { depth: action.depth } : {}),
          ...(action.startLine !== undefined ? { startLine: action.startLine } : {}),
          ...(action.endLine !== undefined ? { endLine: action.endLine } : {}),
        },
      ),
      '</read>',
    ].join('')
  }

  if (action.kind === 'run') {
    return [
      '<run>',
      JSON.stringify(
        {
          id: action.id,
          location: toExternalActionLocation(action.root),
          ...(action.skill ? { skill: action.skill } : {}),
          ...(action.cwd ? { cwd: action.cwd } : {}),
          ...(action.command ? { command: action.command } : {}),
          ...(action.stdin ? { stdin: action.stdin } : {}),
          ...(action.env && Object.keys(action.env).length > 0 ? { env: action.env } : {}),
          ...(action.waitMs !== undefined ? { waitMs: action.waitMs } : {}),
          ...(action.session ? { session: action.session } : {}),
        },
      ),
      '</run>',
    ].join('')
  }

  if (action.kind === 'edit') {
    return [
      '<edit>',
      JSON.stringify(
        {
          location: toExternalActionLocation(action.root),
          path: action.path,
          ...(action.createIfMissing ? { createIfMissing: true } : {}),
          ...(action.previewContextLines !== undefined
            ? { previewContextLines: action.previewContextLines }
            : {}),
          edits: action.edits.map((edit) =>
            edit.op === 'insert'
              ? {
                  op: edit.op,
                  ...(edit.beforeLine !== undefined ? { beforeLine: edit.beforeLine } : {}),
                  ...(edit.afterLine !== undefined ? { afterLine: edit.afterLine } : {}),
                  text: edit.text,
                  ...(edit.expectedText !== undefined ? { expectedText: edit.expectedText } : {}),
                }
              : edit.op === 'delete'
                ? {
                    op: edit.op,
                    startLine: edit.startLine,
                    endLine: edit.endLine,
                    ...(edit.expectedText !== undefined ? { expectedText: edit.expectedText } : {}),
                  }
                : {
                    op: edit.op,
                    startLine: edit.startLine,
                    endLine: edit.endLine,
                    text: edit.text,
                    ...(edit.expectedText !== undefined ? { expectedText: edit.expectedText } : {}),
                  },
          ),
        },
      ),
      '</edit>',
    ].join('')
  }

  return [
    '<skill_call>',
    JSON.stringify(
      {
        id: action.id,
        skill: action.skill,
        script: action.script,
        ...(action.argv && action.argv.length > 0 ? { argv: action.argv } : {}),
        ...(action.stdin ? { stdin: action.stdin } : {}),
        ...(action.env && Object.keys(action.env).length > 0 ? { env: action.env } : {}),
        ...(action.timeoutMs !== undefined ? { timeoutMs: action.timeoutMs } : {}),
      },
    ),
    '</skill_call>',
  ].join('')
}

const serializeNormalizedBody = (segments: ActionBodySegment[]): string =>
  segments
    .flatMap((segment) =>
      segment.kind === 'text'
        ? (() => {
            const normalized = segment.text.trim()
            return normalized ? [normalized] : []
          })()
        : [serializeAction(segment.action)],
    )
    .join('\n\n')
    .trim()

const buildNormalizedEnvelope = (kind: ProtocolTopLevelKind, bodyText: string): string => {
  const trimmed = bodyText.trim()
  if (!trimmed) {
    return kind === 'progress' ? '<progress></progress>' : '<final></final>'
  }
  return kind === 'progress'
    ? `<progress>\n${trimmed}\n</progress>`
    : `<final>\n${trimmed}\n</final>`
}

const buildProtocolRetryPrompt = (reason: SkillAgentProtocolRetryReason): string => {
  switch (reason) {
    case 'empty_response':
      return '上一轮回复为空。请重发一条完整回复：继续处理时输出 `<progress>...</progress>`；直接交付用户时输出 `<final>...</final>`。'
    case 'progress_without_actions':
      return '上一轮使用了 `<progress>`，但其中没有合法的 `<read>`、`<run>` 或 `<edit>` 动作，宿主无法继续。请重发：继续处理时输出包含合法动作的 `<progress>...</progress>`；若应直接交付用户，请输出 `<final>...</final>`。'
    case 'invalid_action_payload':
    default:
      return '上一轮回复中的动作标签格式不合法，宿主未执行。请重发一条完整回复：继续处理时输出包含合法 `<read>` / `<run>` / `<edit>` 的 `<progress>...</progress>`；若已完成或需直接交付用户，请输出 `<final>...</final>`。'
  }
}

export const normalizeSkillAgentProtocolResponse = (text: string): SkillAgentProtocolOutcome => {
  const extracted = extractSkillAgentProtocolText(text)
  if (!extracted.cleanedText) {
    return {
      kind: 'retry',
      displayText: '',
      retryReason: 'empty_response',
      retryPrompt: buildProtocolRetryPrompt('empty_response'),
      repairs: [],
      reasoningText: extracted.reasoningText,
    }
  }

  const envelope = parseTopLevelEnvelope(extracted.cleanedText)
  if (!envelope) {
    return {
      kind: 'retry',
      displayText: '',
      retryReason: 'empty_response',
      retryPrompt: buildProtocolRetryPrompt('empty_response'),
      repairs: [],
      reasoningText: extracted.reasoningText,
    }
  }

  const parsedBody = parseActionBody(envelope.bodyText)
  if (parsedBody.hasInvalidAction) {
    return {
      kind: 'retry',
      displayText: parsedBody.displayText || envelope.bodyText.trim(),
      retryReason: 'invalid_action_payload',
      retryPrompt: buildProtocolRetryPrompt('invalid_action_payload'),
      repairs: envelope.repairs,
      reasoningText: extracted.reasoningText,
    }
  }

  if (envelope.kind === 'progress') {
    if (parsedBody.actions.length === 0) {
      return {
        kind: 'retry',
        displayText: parsedBody.displayText || envelope.bodyText.trim(),
        retryReason: 'progress_without_actions',
        retryPrompt: buildProtocolRetryPrompt('progress_without_actions'),
        repairs: envelope.repairs,
        reasoningText: extracted.reasoningText,
      }
    }

    const normalizedBody = serializeNormalizedBody(parsedBody.segments)
    return {
      kind: 'progress',
      normalizedEnvelope: buildNormalizedEnvelope('progress', normalizedBody),
      normalizedBody,
      displayText: parsedBody.displayText,
      actions: parsedBody.actions,
      repairs: envelope.repairs,
      reasoningText: extracted.reasoningText,
    }
  }

  const normalizedBody = parsedBody.displayText || envelope.bodyText.trim()
  if (!normalizedBody) {
    return {
      kind: 'retry',
      displayText: '',
      retryReason: 'empty_response',
      retryPrompt: buildProtocolRetryPrompt('empty_response'),
      repairs: envelope.repairs,
      reasoningText: extracted.reasoningText,
    }
  }

  return {
    kind: 'final',
    normalizedEnvelope: buildNormalizedEnvelope('final', normalizedBody),
    normalizedBody,
    finalText: normalizedBody,
    repairs: envelope.repairs,
    reasoningText: extracted.reasoningText,
  }
}

export const parseAgentActions = (text: string): ParsedAgentActions => {
  const parsedBody = parseActionBody(text)
  return {
    actions: parsedBody.actions,
    displayText: parsedBody.displayText,
    hasFinalTag: false,
    hasActionTag: parsedBody.hasActionTag,
    hasInvalidAction: parsedBody.hasInvalidAction,
  }
}

const renderBlock = (block: PromptBlock): string => [
  `<${block.type}>`,
  `# ${block.title}`,
  block.content.trim(),
  `</${block.type}>`,
].join('\n')

const MAX_INLINE_VALUE_LENGTH = 200

const escapeMarkdownInline = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')

const normalizeInlineString = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .trim()

const toInlineScalar = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return '`null`'
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `\`${String(value)}\``
  }
  if (typeof value === 'string') {
    if (value.includes('\n')) {
      return null
    }
    const normalized = normalizeInlineString(value)
    if (!normalized) {
      return '`""`'
    }
    const truncated =
      normalized.length > MAX_INLINE_VALUE_LENGTH
        ? `${normalized.slice(0, MAX_INLINE_VALUE_LENGTH - 1)}…`
        : normalized
    return escapeMarkdownInline(truncated)
  }
  return null
}

const renderMarkdownValue = (value: unknown, indent: number): string[] => {
  const indentText = '  '.repeat(indent)
  const inline = toInlineScalar(value)
  if (inline !== null) {
    return [`${indentText}${inline}`]
  }

  if (typeof value === 'string') {
    const body = value.trim()
    if (!body) {
      return [`${indentText}\`""\``]
    }
    return [
      `${indentText}\`\`\`text`,
      ...body.split(/\r?\n/).map((line) => `${indentText}${line}`),
      `${indentText}\`\`\``,
    ]
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indentText}(empty)`]
    }
    const lines: string[] = []
    for (const item of value) {
      const itemInline = toInlineScalar(item)
      if (itemInline !== null) {
        lines.push(`${indentText}- ${itemInline}`)
        continue
      }
      lines.push(`${indentText}-`)
      lines.push(...renderMarkdownValue(item, indent + 1))
    }
    return lines
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return [`${indentText}(empty)`]
    }
    const lines: string[] = []
    for (const [key, item] of entries) {
      const itemInline = toInlineScalar(item)
      if (itemInline !== null) {
        lines.push(`${indentText}- **${escapeMarkdownInline(key)}**: ${itemInline}`)
        continue
      }
      lines.push(`${indentText}- **${escapeMarkdownInline(key)}**:`)
      lines.push(...renderMarkdownValue(item, indent + 1))
    }
    return lines
  }

  return [`${indentText}${escapeMarkdownInline(String(value))}`]
}

export const formatStructuredMarkdown = (value: unknown): string => renderMarkdownValue(value, 0).join('\n')

export const buildSkillsCatalogBlock = (skills: SkillRecord[]): PromptBlock => {
  const items = skills
    .filter((skill) => skill.enabled && skill.frontmatter.hidden !== true)
    .map((skill) => ({
      id: skill.id,
      source: skill.source,
      enabled: skill.enabled,
      ...skill.frontmatter,
    }))

  return {
    type: 'skills_catalog',
    title: 'Skills Catalog',
    content: ['```yaml', renderSkillsCatalogYaml(items), '```'].join('\n'),
  }
}

export const buildRuntimeCatalogBlock = (runtimes: RuntimeRecord[]): PromptBlock => ({
  type: 'runtime_catalog',
  title: 'Runtime Catalog',
  content:
    runtimes.length === 0
      ? '当前没有已安装的外部运行时。'
      : runtimes
          .map((runtime) =>
            [
              `- id: ${runtime.id}`,
              `  type: ${runtime.type}`,
              `  version: ${runtime.version}`,
              `  enabled: ${runtime.enabled}`,
              `  executablePath: ${runtime.executablePath || '(missing)'}`,
              ...(runtime.binDirectoryPath ? [`  binDirectoryPath: ${runtime.binDirectoryPath}`] : []),
              ...(runtime.commands && runtime.commands.length > 0
                ? [`  commands: ${runtime.commands.join(', ')}`]
                : []),
            ].join('\n'),
          )
          .join('\n'),
})

export const buildPromptBlocksText = (blocks: PromptBlock[]): string =>
  blocks.map((block) => renderBlock(block)).join('\n\n')

export const formatSkillResultBlock = (
  title: string,
  payload: unknown,
): PromptBlock => ({
  type: 'skill_result',
  title,
  content: formatStructuredMarkdown(payload),
})

export const formatSkillErrorBlock = (
  title: string,
  payload: unknown,
): PromptBlock => ({
  type: 'skill_error',
  title,
  content: formatStructuredMarkdown(payload),
})

export const formatReadResultBlock = (
  title: string,
  payload: unknown,
): PromptBlock => ({
  type: 'read_result',
  title,
  content: formatStructuredMarkdown(payload),
})

export const formatReadErrorBlock = (
  title: string,
  payload: unknown,
): PromptBlock => ({
  type: 'read_error',
  title,
  content: formatStructuredMarkdown(payload),
})

export const formatTagErrorBlock = (
  title: string,
  payload: unknown,
): PromptBlock => ({
  type: 'tag_error',
  title,
  content: formatStructuredMarkdown(payload),
})
