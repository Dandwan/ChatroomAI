import { splitSkillActionPlaceholders } from '../services/skills/protocol'

export type AssistantFlowSkillKind = 'read' | 'run' | 'edit' | 'skill_call'
export type AssistantFlowSkillStatus = 'running' | 'success' | 'error'

export interface AssistantFlowTextNode {
  id: string
  kind: 'text'
  roundId?: string
  text: string
}

export interface AssistantFlowSkillNode {
  id: string
  kind: 'skill'
  roundId?: string
  token?: string
  actionKind?: AssistantFlowSkillKind
  status: AssistantFlowSkillStatus
  root?: 'skill' | 'workspace' | 'home' | 'absolute'
  op?: 'list' | 'read' | 'stat'
  skill?: string
  path?: string
  depth?: number
  startLine?: number
  endLine?: number
  cwd?: string
  command?: string
  session?: string
  script?: string
  explanation?: string
  result?: string
  error?: string
}

export interface AssistantFlowDividerNode {
  id: string
  kind: 'divider'
  roundId?: string
  explanation?: string
}

export type AssistantFlowNode =
  | AssistantFlowTextNode
  | AssistantFlowSkillNode
  | AssistantFlowDividerNode

interface CreateIdOptions {
  createId: () => string
}

interface FlowOptions extends CreateIdOptions {
  roundId?: string
}

interface SkillNodePatch {
  roundId?: string
  token?: string
  actionKind?: AssistantFlowSkillKind
  status?: AssistantFlowSkillStatus
  root?: 'skill' | 'workspace' | 'home' | 'absolute'
  op?: 'list' | 'read' | 'stat'
  skill?: string
  path?: string
  depth?: number
  startLine?: number
  endLine?: number
  cwd?: string
  command?: string
  session?: string
  script?: string
  explanation?: string
  result?: string
  error?: string
}

const matchesScopedSkillNode = (
  node: AssistantFlowNode,
  token: string,
  roundId?: string,
): node is AssistantFlowSkillNode => {
  if (node.kind !== 'skill' || node.token !== token) {
    return false
  }
  if (roundId) {
    return node.roundId === roundId
  }
  return node.roundId === undefined
}

const isUnscopedSkillPlaceholder = (
  node: AssistantFlowNode,
  token: string,
): node is AssistantFlowSkillNode =>
  node.kind === 'skill' &&
  node.token === token &&
  node.roundId === undefined

export const isAssistantFlowTextNode = (node: AssistantFlowNode): node is AssistantFlowTextNode =>
  node.kind === 'text'

export const isAssistantFlowSkillNode = (node: AssistantFlowNode): node is AssistantFlowSkillNode =>
  node.kind === 'skill'

export const assistantFlowToPlainText = (flow: AssistantFlowNode[] | undefined): string =>
  (flow ?? [])
    .filter(isAssistantFlowTextNode)
    .map((node) => node.text)
    .join('')

export const createAssistantTextFlow = (
  text: string,
  { createId, roundId }: FlowOptions,
): AssistantFlowNode[] | undefined =>
  text
    ? [
        {
          id: createId(),
          kind: 'text',
          roundId,
          text,
        },
      ]
    : undefined

export const appendAssistantFlowContent = (
  previous: AssistantFlowNode[] | undefined,
  content: string,
  { createId, roundId }: FlowOptions,
): { flow: AssistantFlowNode[] | undefined; plainTextDelta: string } => {
  if (!content) {
    return { flow: previous, plainTextDelta: '' }
  }

  const segments = splitSkillActionPlaceholders(content)
  const next = previous ? [...previous] : []
  let plainTextDelta = ''

  for (const segment of segments) {
    if (segment.kind === 'text') {
      if (!segment.value) {
        continue
      }
      plainTextDelta += segment.value
      const last = next[next.length - 1]
      if (last && last.kind === 'text' && last.roundId === roundId) {
        next[next.length - 1] = {
          ...last,
          text: `${last.text}${segment.value}`,
        }
      } else {
        next.push({
          id: createId(),
          kind: 'text',
          roundId,
          text: segment.value,
        })
      }
      continue
    }

    const token = segment.value.trim()
    if (!token) {
      continue
    }
    const exists = next.some((node) => node.kind === 'skill' && node.token === token)
    if (exists) {
      continue
    }
    next.push({
      id: createId(),
      kind: 'skill',
      roundId,
      token,
      status: 'running',
    })
  }

  return {
    flow: next.length > 0 ? next : undefined,
    plainTextDelta,
  }
}

export const appendAssistantFlowDivider = (
  previous: AssistantFlowNode[] | undefined,
  { createId, roundId }: FlowOptions,
  explanation?: string,
): AssistantFlowNode[] | undefined => {
  const next = previous ? [...previous] : []
  if (next.length === 0) {
    return previous
  }
  const last = next[next.length - 1]
  if (last?.kind === 'divider') {
    return previous
  }
  next.push({
    id: createId(),
    kind: 'divider',
    roundId,
    explanation: explanation?.trim() || undefined,
  })
  return next
}

export const patchAssistantFlowSkillNodeById = (
  previous: AssistantFlowNode[] | undefined,
  nodeId: string,
  patch: SkillNodePatch,
): AssistantFlowNode[] | undefined => {
  if (!previous || previous.length === 0) {
    return previous
  }

  let hasUpdated = false
  const next = previous.map((node) => {
    if (node.kind !== 'skill' || node.id !== nodeId) {
      return node
    }
    hasUpdated = true
    return {
      ...node,
      ...patch,
      roundId: patch.roundId ?? node.roundId,
      token: patch.token ?? node.token,
    }
  })

  return hasUpdated ? next : previous
}

export const upsertAssistantFlowSkillNodeByToken = (
  previous: AssistantFlowNode[] | undefined,
  token: string,
  patch: SkillNodePatch,
  { createId, roundId }: FlowOptions,
): { flow: AssistantFlowNode[] | undefined; nodeId: string } => {
  const next = previous ? [...previous] : []
  const resolvedRoundId = patch.roundId ?? roundId
  const targetIndex = next.findIndex((node) => matchesScopedSkillNode(node, token, resolvedRoundId))
  const placeholderIndex =
    targetIndex >= 0 || !resolvedRoundId
      ? -1
      : next.findIndex((node) => isUnscopedSkillPlaceholder(node, token))

  if (targetIndex >= 0 || placeholderIndex >= 0) {
    const resolvedIndex = targetIndex >= 0 ? targetIndex : placeholderIndex
    const current = next[resolvedIndex] as AssistantFlowSkillNode
    const updated: AssistantFlowSkillNode = {
      ...current,
      ...patch,
      roundId: patch.roundId ?? current.roundId ?? roundId,
      token: patch.token ?? current.token ?? token,
    }
    next[resolvedIndex] = updated
    return {
      flow: next,
      nodeId: updated.id,
    }
  }

  const nodeId = createId()
  next.push({
    id: nodeId,
    kind: 'skill',
    roundId: patch.roundId ?? roundId,
    token: patch.token ?? token,
    status: patch.status ?? 'running',
    actionKind: patch.actionKind,
    skill: patch.skill,
    root: patch.root,
    op: patch.op,
    path: patch.path,
    depth: patch.depth,
    startLine: patch.startLine,
    endLine: patch.endLine,
    cwd: patch.cwd,
    command: patch.command,
    session: patch.session,
    script: patch.script,
    explanation: patch.explanation,
    result: patch.result,
    error: patch.error,
  })

  return {
    flow: next,
    nodeId,
  }
}

export const findAssistantFlowSkillNodeByToken = (
  flow: AssistantFlowNode[] | undefined,
  token: string,
  roundId?: string,
): AssistantFlowSkillNode | undefined =>
  flow?.find((node): node is AssistantFlowSkillNode => matchesScopedSkillNode(node, token, roundId))

export const clearAssistantFlowRound = (
  previous: AssistantFlowNode[] | undefined,
  roundId: string,
): AssistantFlowNode[] | undefined => {
  if (!previous || previous.length === 0) {
    return previous
  }
  const next = previous.filter((node) => node.roundId !== roundId)
  if (next.length === previous.length) {
    return previous
  }
  return next.length > 0 ? next : undefined
}

export const markAssistantFlowRoundError = (
  previous: AssistantFlowNode[] | undefined,
  roundId: string,
  error: string,
): AssistantFlowNode[] | undefined => {
  if (!previous || previous.length === 0) {
    return previous
  }

  let hasUpdated = false
  const next = previous.map((node) => {
    if (node.kind !== 'skill' || node.roundId !== roundId || node.status !== 'running') {
      return node
    }
    hasUpdated = true
    const updated: AssistantFlowSkillNode = {
      ...node,
      status: 'error',
      error,
    }
    return updated
  })

  return hasUpdated ? next : previous
}
