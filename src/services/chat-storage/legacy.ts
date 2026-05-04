import { normalizeUsage } from '../chat-api'
import type {
  AssistantFlowNode,
  AssistantFlowSkillKind,
  AssistantFlowSkillNode,
} from '../../utils/assistant-flow'
import { loadConversationImageData } from '../../utils/conversation-image-storage'
import {
  createConversationFromTranscript,
  transcriptFromLegacyMessages,
  withConversationTranscript,
} from '../chat-transcript'
import type {
  ChatStorageConversation,
  ChatStorageImageAttachment,
  ChatStorageState,
  ChatStorageTokenUsage,
} from './types'

export const LEGACY_MESSAGES_STORAGE_KEY = 'chatroom.messages.v1'
export const LEGACY_CONVERSATIONS_STORAGE_KEY = 'chatroom.conversations.v2'
export const LEGACY_DRAFTS_STORAGE_KEY = 'chatroom.drafts.v1'
export const LEGACY_ACTIVE_CONVERSATION_STORAGE_KEY = 'chatroom.active-conversation.v2'
export const LEGACY_IMAGE_MANIFEST_STORAGE_KEY = 'chatroom.conversation-image-manifest.v1'

type LegacySkillStepKind = AssistantFlowSkillKind

type LegacyAssistantOutputObject =
  | {
      id: string
      kind: 'text'
      text: string
    }
  | {
      id: string
      kind: 'skill'
      token: string
    }
  | {
      id: string
      kind: 'divider'
    }

interface LegacySkillStep {
  id: string
  kind: LegacySkillStepKind
  token?: string
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
  status: 'running' | 'success' | 'error'
  error?: string
}

interface LegacySkillRound {
  id: string
  explanation?: string
  steps: LegacySkillStep[]
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const isLegacyReadLikeNode = (item: Record<string, unknown>): boolean => {
  if (item.root === 'skill' || item.root === 'workspace') {
    return true
  }
  if (item.op === 'list' || item.op === 'read' || item.op === 'stat') {
    return true
  }
  if (typeof item.path === 'string' && item.path.trim()) {
    return true
  }
  return (
    typeof item.skill === 'string' &&
    item.skill.trim().length > 0 &&
    !(typeof item.script === 'string' && item.script.trim().length > 0)
  )
}

const normalizeLegacyAssistantActionKind = (value: unknown): AssistantFlowSkillKind | undefined => {
  if (value === 'run') {
    return 'run'
  }
  if (value === 'edit') {
    return 'edit'
  }
  if (value === 'skill_call') {
    return 'run'
  }
  if (value === 'read') {
    return 'read'
  }
  return undefined
}

const normalizeLegacyReadRoot = (
  item: Record<string, unknown>,
): 'skill' | 'workspace' | 'home' | 'absolute' | undefined => {
  if (item.root === 'workspace' || item.root === 'skill' || item.root === 'home' || item.root === 'absolute') {
    return item.root
  }
  if (isLegacyReadLikeNode(item)) {
    return 'skill'
  }
  return undefined
}

const normalizeLegacyReadOp = (item: Record<string, unknown>): 'list' | 'read' | 'stat' | undefined => {
  if (item.op === 'list' || item.op === 'read' || item.op === 'stat') {
    return item.op
  }
  if (isLegacyReadLikeNode(item)) {
    return 'read'
  }
  return undefined
}

const normalizeLegacyReadPath = (item: Record<string, unknown>): string | undefined => {
  if (typeof item.path === 'string' && item.path.trim()) {
    return item.path
  }
  if (isLegacyReadLikeNode(item)) {
    return 'SKILL.md'
  }
  return undefined
}

const normalizeStoredUsage = (raw: unknown): ChatStorageTokenUsage | undefined => {
  if (!isRecord(raw)) {
    return undefined
  }
  const promptTokens = toFiniteNumber(raw.promptTokens ?? raw.prompt_tokens)
  const completionTokens = toFiniteNumber(raw.completionTokens ?? raw.completion_tokens)
  const totalTokens = toFiniteNumber(raw.totalTokens ?? raw.total_tokens)
  const reasoningTokens = toFiniteNumber(raw.reasoningTokens)

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined
  }

  const safePrompt = Math.max(0, Math.round(promptTokens ?? 0))
  const safeCompletion = Math.max(0, Math.round(completionTokens ?? 0))
  const safeTotal = Math.max(0, Math.round(totalTokens ?? safePrompt + safeCompletion))

  return {
    promptTokens: safePrompt,
    completionTokens: safeCompletion,
    totalTokens: safeTotal,
    reasoningTokens,
  }
}

const normalizeStoredAssistantFlow = (value: unknown): AssistantFlowNode[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const nodes: AssistantFlowNode[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.kind !== 'string') {
      continue
    }

    if (item.kind === 'text') {
      if (typeof item.text !== 'string' || item.text.length === 0) {
        continue
      }
      nodes.push({
        id: item.id,
        kind: 'text',
        roundId: typeof item.roundId === 'string' && item.roundId.trim() ? item.roundId : undefined,
        text: item.text,
      })
      continue
    }

    if (item.kind === 'skill') {
      if (item.status !== 'running' && item.status !== 'success' && item.status !== 'error') {
        continue
      }
      nodes.push({
        id: item.id,
        kind: 'skill',
        roundId: typeof item.roundId === 'string' && item.roundId.trim() ? item.roundId : undefined,
        token: typeof item.token === 'string' && item.token.trim() ? item.token.trim() : undefined,
        actionKind:
          normalizeLegacyAssistantActionKind(item.actionKind) ??
          (isLegacyReadLikeNode(item) ? 'read' : undefined),
        status: item.status,
        root: normalizeLegacyReadRoot(item),
        op: normalizeLegacyReadOp(item),
        skill: typeof item.skill === 'string' && item.skill.trim() ? item.skill : undefined,
        path: normalizeLegacyReadPath(item),
        depth: toFiniteNumber(item.depth),
        startLine: toFiniteNumber(item.startLine),
        endLine: toFiniteNumber(item.endLine),
        cwd: typeof item.cwd === 'string' && item.cwd.trim() ? item.cwd : undefined,
        command: typeof item.command === 'string' && item.command.trim() ? item.command : undefined,
        session: typeof item.session === 'string' && item.session.trim() ? item.session : undefined,
        script: typeof item.script === 'string' && item.script.trim() ? item.script : undefined,
        explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
        result: typeof item.result === 'string' ? item.result : undefined,
        error: typeof item.error === 'string' ? item.error : undefined,
      })
      continue
    }

    if (item.kind === 'divider') {
      nodes.push({
        id: item.id,
        kind: 'divider',
        roundId: typeof item.roundId === 'string' && item.roundId.trim() ? item.roundId : undefined,
        explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      })
    }
  }

  return nodes.length > 0 ? nodes : undefined
}

const normalizeStoredLegacyAssistantObjects = (value: unknown): LegacyAssistantOutputObject[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const objects: LegacyAssistantOutputObject[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.kind !== 'string') {
      continue
    }

    if (item.kind === 'text') {
      if (typeof item.text !== 'string' || item.text.length === 0) {
        continue
      }
      objects.push({
        id: item.id,
        kind: 'text',
        text: item.text,
      })
      continue
    }

    if (item.kind === 'skill') {
      if (typeof item.token !== 'string' || item.token.trim().length === 0) {
        continue
      }
      objects.push({
        id: item.id,
        kind: 'skill',
        token: item.token.trim(),
      })
      continue
    }

    if (item.kind === 'divider') {
      objects.push({
        id: item.id,
        kind: 'divider',
      })
    }
  }

  return objects.length > 0 ? objects : undefined
}

const normalizeStoredLegacySkillSteps = (value: unknown): LegacySkillStep[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const steps: LegacySkillStep[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      continue
    }
    if (item.status !== 'running' && item.status !== 'success' && item.status !== 'error') {
      continue
    }

    const kind: LegacySkillStepKind =
      item.kind === 'run'
        ? 'run'
        : item.kind === 'edit'
          ? 'edit'
          : item.kind === 'skill_call'
            ? 'run'
            : 'read'
    const script = typeof item.script === 'string' && item.script.trim() ? item.script : undefined
    if (item.kind === 'skill_call' && !script) {
      continue
    }
    const token = typeof item.token === 'string' && item.token.trim() ? item.token.trim() : undefined

    steps.push({
      id: item.id,
      kind,
      token,
      root:
        kind === 'read'
          ? 'skill'
          : item.root === 'skill' || item.root === 'workspace' || item.root === 'home' || item.root === 'absolute'
            ? item.root
            : undefined,
      op: kind === 'read' ? 'read' : undefined,
      skill:
        typeof item.skill === 'string' && item.skill.trim()
          ? item.skill
          : undefined,
      path: kind === 'read' ? 'SKILL.md' : undefined,
      cwd: typeof item.cwd === 'string' && item.cwd.trim() ? item.cwd : undefined,
      command: typeof item.command === 'string' && item.command.trim() ? item.command : undefined,
      session: typeof item.session === 'string' && item.session.trim() ? item.session : undefined,
      script,
      explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      result: typeof item.result === 'string' ? item.result : undefined,
      status: item.status,
      error: typeof item.error === 'string' ? item.error : undefined,
    })
  }

  return steps.length > 0 ? steps : undefined
}

const normalizeStoredLegacySkillRounds = (value: unknown): LegacySkillRound[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const rounds: LegacySkillRound[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      continue
    }
    const steps = normalizeStoredLegacySkillSteps(item.steps)
    if (!steps || steps.length === 0) {
      continue
    }
    rounds.push({
      id: item.id,
      explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      steps,
    })
  }
  return rounds.length > 0 ? rounds : undefined
}

const buildAssistantFlowFromLegacy = (
  assistantObjects: LegacyAssistantOutputObject[] | undefined,
  skillRounds: LegacySkillRound[] | undefined,
  skillSteps: LegacySkillStep[] | undefined,
  text: string,
): AssistantFlowNode[] | undefined => {
  const next: AssistantFlowNode[] = []
  const rounds: LegacySkillRound[] =
    (skillRounds?.length ?? 0) > 0
      ? skillRounds ?? []
      : (skillSteps?.length ?? 0) > 0
        ? [
            {
              id: 'legacy-round',
              steps: skillSteps ?? [],
            },
          ]
        : []

  const orderedSkillNodes: AssistantFlowSkillNode[] = []
  const skillNodeByToken = new Map<string, AssistantFlowSkillNode>()
  for (const round of rounds) {
    for (const step of round.steps) {
      const node: AssistantFlowSkillNode = {
        id: step.id,
        kind: 'skill',
        roundId: round.id,
        token: step.token,
        actionKind: step.kind,
        status: step.status,
        skill: step.skill,
        root: step.root,
        op: step.op,
        path: step.path,
        depth: step.depth,
        startLine: step.startLine,
        endLine: step.endLine,
        cwd: step.cwd,
        command: step.command,
        session: step.session,
        script: step.script,
        explanation: step.explanation,
        result: step.result,
        error: step.error,
      }
      orderedSkillNodes.push(node)
      if (step.token) {
        skillNodeByToken.set(step.token, node)
      }
    }
  }

  const consumedSkillIds = new Set<string>()

  for (const object of assistantObjects ?? []) {
    if (object.kind === 'text') {
      next.push({
        id: object.id,
        kind: 'text',
        text: object.text,
      })
      continue
    }

    if (object.kind === 'divider') {
      next.push({
        id: object.id,
        kind: 'divider',
      })
      continue
    }

    const matched = skillNodeByToken.get(object.token)
    if (matched) {
      consumedSkillIds.add(matched.id)
      next.push(matched)
      continue
    }

    next.push({
      id: object.id,
      kind: 'skill',
      token: object.token,
      status: 'running',
    })
  }

  for (const node of orderedSkillNodes) {
    if (!consumedSkillIds.has(node.id)) {
      next.push(node)
    }
  }

  if (next.length === 0 && text.trim()) {
    next.push({
      id: `legacy-text-${createId()}`,
      kind: 'text',
      text,
    })
  }

  return next.length > 0 ? next : undefined
}

interface LegacyNormalizedMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  assistantFlow?: AssistantFlowNode[]
  images?: ChatStorageImageAttachment[]
  reasoning?: string
  createdAt: number
  model?: string
  usage?: ChatStorageTokenUsage
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

const normalizeStoredImages = (value: unknown): ChatStorageImageAttachment[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const images: ChatStorageImageAttachment[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      continue
    }
    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl : ''
    const storageKey =
      typeof item.storageKey === 'string' && item.storageKey.trim().length > 0 ? item.storageKey : undefined
    if (!dataUrl && !storageKey) {
      continue
    }
    images.push({
      id: item.id,
      name: typeof item.name === 'string' ? item.name : 'image',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'image/*',
      size: Math.max(0, Math.round(toFiniteNumber(item.size) ?? 0)),
      dataUrl,
      storageKey,
    })
  }

  return images.length > 0 ? images : undefined
}

const normalizeStoredMessages = (value: unknown): LegacyNormalizedMessage[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const messages: LegacyNormalizedMessage[] = []
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.text !== 'string'
    ) {
      continue
    }

    const usage = normalizeStoredUsage(item.usage) ?? normalizeUsage(item.usage)
    const assistantFlow =
      normalizeStoredAssistantFlow(item.assistantFlow) ??
      buildAssistantFlowFromLegacy(
        normalizeStoredLegacyAssistantObjects(item.assistantObjects),
        normalizeStoredLegacySkillRounds(item.skillRounds),
        normalizeStoredLegacySkillSteps(item.skillSteps),
        item.role === 'assistant' && typeof item.text === 'string' ? item.text : '',
      )

    messages.push({
      id: item.id,
      role: item.role,
      text: item.text,
      assistantFlow,
      images: normalizeStoredImages(item.images),
      reasoning: typeof item.reasoning === 'string' ? item.reasoning : undefined,
      createdAt: Math.round(toFiniteNumber(item.createdAt) ?? Date.now()),
      model: typeof item.model === 'string' ? item.model : undefined,
      usage,
      usageEstimated: item.usageEstimated === true,
      firstTokenLatencyMs: toFiniteNumber(item.firstTokenLatencyMs),
      totalTimeMs: toFiniteNumber(item.totalTimeMs),
      error: typeof item.error === 'string' ? item.error : undefined,
    })
  }

  return messages
}

const readLocalStorageItem = (key: string): string | null => {
  if (typeof localStorage === 'undefined') {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const readDrafts = (): Record<string, string> => {
  const raw = readLocalStorageItem(LEGACY_DRAFTS_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string')
        .map(([conversationId, value]) => [conversationId, typeof value === 'string' ? value : ''])
        .filter(([, value]) => value.length > 0),
    )
  } catch {
    return {}
  }
}

const readActiveConversationId = (): string => readLocalStorageItem(LEGACY_ACTIVE_CONVERSATION_STORAGE_KEY) ?? ''

export const hasLegacyChatState = (): boolean =>
  readLocalStorageItem(LEGACY_CONVERSATIONS_STORAGE_KEY) !== null ||
  readLocalStorageItem(LEGACY_MESSAGES_STORAGE_KEY) !== null

export const loadLegacyChatState = async (): Promise<ChatStorageState> => {
  const draftsByConversation = readDrafts()
  const activeConversationId = readActiveConversationId()
  const rawConversations = readLocalStorageItem(LEGACY_CONVERSATIONS_STORAGE_KEY)
  if (rawConversations) {
    try {
      const parsed = JSON.parse(rawConversations) as unknown
      if (Array.isArray(parsed)) {
        const conversations: ChatStorageConversation[] = []
        for (const item of parsed) {
          if (!isRecord(item) || typeof item.id !== 'string') {
            continue
          }
          const messages = normalizeStoredMessages(item.messages)
          const transcript = transcriptFromLegacyMessages(messages)
          const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '新对话'
          const titleManuallyEdited =
            typeof item.titleManuallyEdited === 'boolean' ? item.titleManuallyEdited : false
          conversations.push(
            withConversationTranscript(
              {
                id: item.id,
                title,
                titleManuallyEdited,
                transcript,
                createdAt: Math.round(toFiniteNumber(item.createdAt) ?? Date.now()),
                updatedAt: Math.round(toFiniteNumber(item.updatedAt) ?? Date.now()),
              },
              transcript,
              { keepUpdatedAt: true },
            ),
          )
        }

        return {
          conversations,
          activeConversationId:
            conversations.some((conversation) => conversation.id === activeConversationId) ? activeConversationId : '',
          draftsByConversation,
        }
      }
    } catch {
      // Fall through to older format below.
    }
  }

  const rawLegacyMessages = readLocalStorageItem(LEGACY_MESSAGES_STORAGE_KEY)
  if (!rawLegacyMessages) {
    return {
      conversations: [],
      activeConversationId: '',
      draftsByConversation,
    }
  }

  try {
    const legacyMessages = normalizeStoredMessages(JSON.parse(rawLegacyMessages) as unknown)
    if (legacyMessages.length === 0) {
      return {
        conversations: [],
        activeConversationId: '',
        draftsByConversation,
      }
    }

    const transcript = transcriptFromLegacyMessages(legacyMessages)
    const conversation = createConversationFromTranscript(createId(), transcript)
    return {
      conversations: [conversation],
      activeConversationId: activeConversationId === conversation.id ? activeConversationId : '',
      draftsByConversation,
    }
  } catch {
    return {
      conversations: [],
      activeConversationId: '',
      draftsByConversation,
    }
  }
}

export const loadLegacyImageDataUrl = async (image: ChatStorageImageAttachment): Promise<string> => {
  if (image.dataUrl.trim()) {
    return image.dataUrl
  }
  if (!image.storageKey) {
    return ''
  }
  return (await loadConversationImageData(image.storageKey)) ?? ''
}
