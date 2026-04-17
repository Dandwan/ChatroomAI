import { renderSkillsCatalogYaml } from './frontmatter'
import type {
  ExecutableAgentAction,
  ParsedAgentActions,
  PromptBlock,
  RuntimeRecord,
  SkillRecord,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const TAGS = {
  skillRead: 'skill_read',
  skillCall: 'skill_call',
}

const OPEN_TAGS = {
  skillRead: `<${TAGS.skillRead}>`,
  skillCall: `<${TAGS.skillCall}>`,
  think: '<think>',
} as const

const CLOSE_TAGS = {
  skillRead: `</${TAGS.skillRead}>`,
  skillCall: `</${TAGS.skillCall}>`,
  think: '</think>',
} as const

type StreamParserMode = 'root' | 'skill_read' | 'skill_call' | 'think'

export interface AgentStreamDelta {
  content: string
  reasoning: string
}

interface AgentStreamParser {
  push: (chunk: string) => AgentStreamDelta
  flush: () => AgentStreamDelta
}

const createAgentStreamDelta = (): AgentStreamDelta => ({
  content: '',
  reasoning: '',
})

const appendAgentStreamDelta = (
  delta: AgentStreamDelta,
  mode: StreamParserMode,
  value: string,
): void => {
  if (!value) {
    return
  }

  if (mode === 'root') {
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
      return [OPEN_TAGS.skillRead, OPEN_TAGS.skillCall, OPEN_TAGS.think]
    case 'skill_read':
      return [CLOSE_TAGS.skillRead]
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
    case OPEN_TAGS.skillRead:
      return 'skill_read'
    case OPEN_TAGS.skillCall:
      return 'skill_call'
    case OPEN_TAGS.think:
      return 'think'
    default:
      return null
  }
}

const getClosedModeForTag = (tag: string): StreamParserMode | null => {
  switch (tag) {
    case CLOSE_TAGS.skillRead:
      return 'skill_read'
    case CLOSE_TAGS.skillCall:
      return 'skill_call'
    case CLOSE_TAGS.think:
      return 'think'
    default:
      return null
  }
}

export const createAgentStreamParser = (): AgentStreamParser => {
  const modeStack: StreamParserMode[] = ['root']
  let pendingTag = ''

  const getCurrentMode = (): StreamParserMode => modeStack[modeStack.length - 1] ?? 'root'

  const handleCompletedTag = (tag: string): void => {
    const nextMode = getNextModeForTag(tag)
    if (nextMode) {
      modeStack.push(nextMode)
      return
    }

    const closedMode = getClosedModeForTag(tag)
    if (!closedMode) {
      return
    }

    if (getCurrentMode() === closedMode && modeStack.length > 1) {
      modeStack.pop()
    }
  }

  const push = (chunk: string): AgentStreamDelta => {
    const delta = createAgentStreamDelta()

    for (const character of chunk) {
      const currentMode = getCurrentMode()
      if (pendingTag.length > 0) {
        const candidate = `${pendingTag}${character}`
        const expectedTags = getExpectedTagsForMode(currentMode)

        if (expectedTags.some((tag) => tag.startsWith(candidate))) {
          pendingTag = candidate
          if (expectedTags.includes(candidate)) {
            handleCompletedTag(candidate)
            pendingTag = ''
          }
          continue
        }

        appendAgentStreamDelta(delta, currentMode, candidate)
        pendingTag = ''
        continue
      }

      if (character === '<') {
        pendingTag = character
        continue
      }

      appendAgentStreamDelta(delta, currentMode, character)
    }

    return delta
  }

  const flush = (): AgentStreamDelta => {
    const delta = createAgentStreamDelta()
    if (pendingTag.length > 0) {
      appendAgentStreamDelta(delta, getCurrentMode(), pendingTag)
      pendingTag = ''
    }
    return delta
  }

  return {
    push,
    flush,
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

const parseSkillReadAction = (body: string): ExecutableAgentAction | null => {
  try {
    const payload = JSON.parse(body) as unknown
    if (!isRecord(payload)) {
      return null
    }

    const skill = pickString(payload, ['skill', 'id', 'skillId', 'name'])
    if (!skill) {
      return null
    }

    return {
      kind: 'skill_read',
      skill,
      sections: pickStringArray(payload, ['sections', 'section']),
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
      argv: pickStringArray(payload, ['argv', 'args']) ?? [],
      stdin: pickString(payload, ['stdin', 'input']),
      env: pickStringRecord(payload, ['env']) ?? {},
      timeoutMs:
        typeof payload.timeoutMs === 'number' && Number.isFinite(payload.timeoutMs)
          ? Math.max(0, Math.round(payload.timeoutMs))
          : undefined,
    }
  } catch {
    return null
  }
}

export const parseAgentActions = (text: string): ParsedAgentActions => {
  const pattern = /<(skill_read|skill_call)>([\s\S]*?)<\/\1>/gi
  const actions: ExecutableAgentAction[] = []
  const textSegments: string[] = []
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const leadingText = text.slice(cursor, index).trim()
    if (leadingText) {
      textSegments.push(leadingText)
    }

    const tag = match[1]?.toLowerCase()
    const body = match[2]?.trim() ?? ''
    const action =
      tag === TAGS.skillRead
        ? parseSkillReadAction(body)
        : tag === TAGS.skillCall
          ? parseSkillCallAction(body)
          : null

    if (!action) {
      return {
        actions: [],
        displayText: text.trim(),
      }
    }

    actions.push(action)
    cursor = index + match[0].length
  }

  if (actions.length === 0) {
    return {
      actions,
      displayText: text.trim(),
    }
  }

  const trailingText = text.slice(cursor).trim()
  if (trailingText) {
    textSegments.push(trailingText)
  }

  return {
    actions,
    displayText: textSegments.join('\n\n').trim(),
  }
}

const renderBlock = (block: PromptBlock): string => [
  `<${block.type}>`,
  `# ${block.title}`,
  block.content.trim(),
  `</${block.type}>`,
].join('\n')

export const buildSkillsCatalogBlock = (skills: SkillRecord[]): PromptBlock => {
  const items = skills
    .filter((skill) => skill.enabled)
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
            ].join('\n'),
          )
          .join('\n'),
})

export const buildPromptBlocksText = (blocks: PromptBlock[]): string =>
  blocks.map((block) => renderBlock(block)).join('\n\n')

export const formatSkillResultBlock = (
  title: string,
  payload: Record<string, unknown>,
): PromptBlock => ({
  type: 'skill_result',
  title,
  content: ['```json', JSON.stringify(payload, null, 2), '```'].join('\n'),
})

export const formatSkillErrorBlock = (
  title: string,
  payload: Record<string, unknown>,
): PromptBlock => ({
  type: 'skill_error',
  title,
  content: ['```json', JSON.stringify(payload, null, 2), '```'].join('\n'),
})
