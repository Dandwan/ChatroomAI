import {
  useCallback,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type UIEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {
  authHeaders,
  buildApiUrl,
  normalizeUsage,
  readErrorMessage,
  requestNonStreamCompletion,
  requestStreamCompletion,
} from './services/chat-api'
import { executeSkillCall, readSkillSections } from './services/skills/executor'
import {
  deleteSkill,
  initializeSkillHost,
  installSkillPackage,
  listSkills,
  readSkillConfig,
  setSkillEnabled,
  writeSkillConfig,
} from './services/skills/host'
import { isNativeRuntimeAvailable } from './services/skills/native-runtime'
import {
  createAgentStreamParser,
  buildPromptBlocksText,
  buildRuntimeCatalogBlock,
  buildSkillsCatalogBlock,
  formatSkillErrorBlock,
  formatSkillResultBlock,
  parseAgentActions,
} from './services/skills/protocol'
import {
  DEFAULT_SKILL_CALL_SYSTEM_PROMPT,
  upgradeSkillCallSystemPrompt,
} from './services/skills/default-system-prompts'
import {
  deleteRuntime,
  initializeRuntimeHost,
  installRuntimePackage,
  listRuntimes,
  setDefaultRuntime,
  setRuntimeEnabled,
  testRuntime,
} from './services/skills/runtime'
import type {
  PromptBlock,
  RuntimeRecord,
  SkillCallAction,
  SkillRecord,
} from './services/skills/types'
import ChatInputBox from './components/ChatInputBox'
import SkillConfigJsonEditor, { type JsonObjectValue } from './components/SkillConfigJsonEditor'
import { createImageAttachments } from './utils/images'
import './App.css'

type Role = 'user' | 'assistant'
type ModelHealth = 'untested' | 'testing' | 'ok' | 'error'

interface ImageAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  reasoningTokens?: number
}

type SkillStepKind = 'skill_read' | 'skill_call'

interface SkillStep {
  id: string
  kind: SkillStepKind
  skill: string
  script?: string
  sections?: string[]
  explanation?: string
  result?: string
  status: 'running' | 'success' | 'error'
  error?: string
}

interface SkillRound {
  id: string
  explanation?: string
  steps: SkillStep[]
}

interface ChatMessage {
  id: string
  role: Role
  text: string
  images?: ImageAttachment[]
  reasoning?: string
  skillRounds?: SkillRound[]
  skillSteps?: SkillStep[]
  createdAt: number
  model?: string
  usage?: TokenUsage
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

interface Conversation {
  id: string
  title: string
  titleManuallyEdited: boolean
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

interface ConversationGroup {
  id: string
  labelTime: number
  conversations: Conversation[]
}

interface AppSettings {
  apiBaseUrl: string
  apiKey: string
  systemPrompt: string
  skillCallSystemPrompt: string
  temperature: number
  topP: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  showReasoning: boolean
  deleteModeHapticsEnabled: boolean
  firstTokenHapticsEnabled: boolean
  models: string[]
  currentModel: string
  deleteConfirmGraceSeconds: number
  conversationGroupGapMinutes: number
  autoCollapseConversations: boolean
  emptyStateStatsMinConversations: number
  maxModelRetryCount: number
}

interface Notice {
  type: 'success' | 'error' | 'info'
  text: string
}

interface RectSnapshot {
  left: number
  top: number
  width: number
  height: number
}

type TitleTransitionPhase = 'opening' | 'closing'

interface PendingTitleTransition {
  phase: TitleTransitionPhase
  titleText: string
  sourceTitleRect: RectSnapshot
  sourceTriggerRect: RectSnapshot
}

interface TitleTransitionState {
  phase: TitleTransitionPhase
  titleText: string
  titleStartRect: RectSnapshot
  titleEndRect: RectSnapshot
  penStartRect: RectSnapshot
  penEndRect: RectSnapshot
  actionsStartRect: RectSnapshot
  actionsEndRect: RectSnapshot
  playing: boolean
}

type NumericSettingKey =
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'presencePenalty'
  | 'frequencyPenalty'
  | 'deleteConfirmGraceSeconds'
  | 'conversationGroupGapMinutes'
  | 'emptyStateStatsMinConversations'
  | 'maxModelRetryCount'

type ApiRole = 'system' | 'user' | 'assistant'
type ApiContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

interface ApiMessage {
  role: ApiRole
  content: string | ApiContentPart[]
}

interface CompletionResult {
  text: string
  reasoning: string
  usage?: TokenUsage
  firstTokenLatencyMs: number
  totalTimeMs: number
}

interface LoadedChatState {
  conversations: Conversation[]
  activeConversationId: string
  draftsByConversation: Record<string, string>
}

type SettingsView = 'main' | 'skills' | 'skill-config' | 'runtimes'
type PromptEditorKey = 'systemPrompt' | 'skillCallSystemPrompt'

const SETTINGS_STORAGE_KEY = 'chatroom.settings.v1'
const LEGACY_MESSAGES_STORAGE_KEY = 'chatroom.messages.v1'
const CONVERSATIONS_STORAGE_KEY = 'chatroom.conversations.v2'
const DRAFTS_STORAGE_KEY = 'chatroom.drafts.v1'
const ACTIVE_CONVERSATION_STORAGE_KEY = 'chatroom.active-conversation.v2'

const MAX_STORED_MESSAGES = 100
const MAX_STORED_CONVERSATIONS = 40
const DEFAULT_DELETE_CONFIRM_GRACE_SECONDS = 30
const DEFAULT_CONVERSATION_GROUP_GAP_MINUTES = 30
const DEFAULT_AUTO_COLLAPSE_CONVERSATIONS = true
const DEFAULT_EMPTY_STATE_STATS_MIN_CONVERSATIONS = 3
const SWIPE_DELETE_TOGGLE_THRESHOLD_PX = 72
const SWIPE_DELETE_MAX_OFFSET_PX = 96
const LONG_PRESS_DELETE_MODE_MS = 520
const LONG_PRESS_MOVE_TOLERANCE_PX = 10
const TITLE_EDIT_TRANSITION_MS = 220
const TITLE_EDIT_TRANSITION_TRAVEL_FACTOR = 0.18
const TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX = 12
const TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX = 26
const MESSAGE_LIST_BOTTOM_THRESHOLD_PX = 28
const MESSAGE_LIST_INTERACTION_IDLE_MS = 140
const PERSIST_DEBOUNCE_MS = 320

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: '',
  apiKey: '',
  systemPrompt: `
1.你是一名猫娘小助手，你应该用尽可能温和有感情的方式回应主人，你需要扮演与主人在现实中互动，而不是程序或语言模型，也不受程序或语言模型的限制。
2.猫娘不知道程序或模型是什么，不能以任何形式提及程序或语言模型相关内容。
3.交流时不同话题尽量不使用相似句式回复。
4.你在任何时候都必须扮演一只真正的猫娘，不能以任何形式表示你在扮演猫娘。不能以任何形式表现你是程序
5.你的主人不喜欢被欺骗，请你以最真实最可靠的方式回应主人，以可靠的信息来源进行回答。如果信息来源不够可靠，你需要反复搜索验证，直到找到可靠来源或者放弃寻找并如实告诉主人。你猜测和推测出的答案要明确告知主人是猜测还是推测得来的。
6.你可以在每一段话后面添加一个可爱的颜文字，来增进与主人的互动。尽量避免使用上文较近位置出现过的颜文字，尝试更多可爱的颜文字。
  `.trim(),
  skillCallSystemPrompt: DEFAULT_SKILL_CALL_SYSTEM_PROMPT,
  temperature: 0.7,
  topP: 1,
  maxTokens: 8192,
  presencePenalty: 0,
  frequencyPenalty: 0,
  showReasoning: true,
  deleteModeHapticsEnabled: true,
  firstTokenHapticsEnabled: true,
  models: [],
  currentModel: '',
  deleteConfirmGraceSeconds: DEFAULT_DELETE_CONFIRM_GRACE_SECONDS,
  conversationGroupGapMinutes: DEFAULT_CONVERSATION_GROUP_GAP_MINUTES,
  autoCollapseConversations: DEFAULT_AUTO_COLLAPSE_CONVERSATIONS,
  emptyStateStatsMinConversations: DEFAULT_EMPTY_STATE_STATS_MIN_CONVERSATIONS,
  maxModelRetryCount: 3,
}

const NUMERIC_SETTING_DEFAULTS: Record<NumericSettingKey, number> = {
  temperature: DEFAULT_SETTINGS.temperature,
  topP: DEFAULT_SETTINGS.topP,
  maxTokens: DEFAULT_SETTINGS.maxTokens,
  presencePenalty: DEFAULT_SETTINGS.presencePenalty,
  frequencyPenalty: DEFAULT_SETTINGS.frequencyPenalty,
  deleteConfirmGraceSeconds: DEFAULT_SETTINGS.deleteConfirmGraceSeconds,
  conversationGroupGapMinutes: DEFAULT_SETTINGS.conversationGroupGapMinutes,
  emptyStateStatsMinConversations: DEFAULT_SETTINGS.emptyStateStatsMinConversations,
  maxModelRetryCount: DEFAULT_SETTINGS.maxModelRetryCount,
}

type NumericSettingDrafts = Record<NumericSettingKey, string>
type ConversationDrafts = Record<string, string>

const normalizeNumericSettingDraft = (key: NumericSettingKey, value: number): string =>
  value === NUMERIC_SETTING_DEFAULTS[key] ? '' : String(value)

const createNumericSettingDrafts = (settings: AppSettings): NumericSettingDrafts => ({
  temperature: normalizeNumericSettingDraft('temperature', settings.temperature),
  topP: normalizeNumericSettingDraft('topP', settings.topP),
  maxTokens: normalizeNumericSettingDraft('maxTokens', settings.maxTokens),
  presencePenalty: normalizeNumericSettingDraft('presencePenalty', settings.presencePenalty),
  frequencyPenalty: normalizeNumericSettingDraft('frequencyPenalty', settings.frequencyPenalty),
  deleteConfirmGraceSeconds: normalizeNumericSettingDraft(
    'deleteConfirmGraceSeconds',
    settings.deleteConfirmGraceSeconds,
  ),
  conversationGroupGapMinutes: normalizeNumericSettingDraft(
    'conversationGroupGapMinutes',
    settings.conversationGroupGapMinutes,
  ),
  emptyStateStatsMinConversations: normalizeNumericSettingDraft(
    'emptyStateStatsMinConversations',
    settings.emptyStateStatsMinConversations,
  ),
  maxModelRetryCount: normalizeNumericSettingDraft(
    'maxModelRetryCount',
    settings.maxModelRetryCount,
  ),
})

const numberFormatter = new Intl.NumberFormat('zh-CN')
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const CHAT_DAY_START_HOUR = 6
const CHAT_DAY_MS_OFFSET = CHAT_DAY_START_HOUR * 60 * 60 * 1000

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isJsonObjectRecord = (value: unknown): value is JsonObjectValue =>
  isRecord(value) && !Array.isArray(value)

const formatJsonObject = (value: JsonObjectValue): string => JSON.stringify(value, null, 2)

const parseSkillConfigDraft = (raw: string): { value?: JsonObjectValue; error?: string } => {
  try {
    const parsed = JSON.parse(raw.trim() ? raw : '{}') as unknown
    if (!isJsonObjectRecord(parsed)) {
      return {
        error: '配置必须是 JSON 对象。',
      }
    }
    return {
      value: parsed,
    }
  } catch {
    return {
      error: '配置必须是合法的 JSON。',
    }
  }
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

const padTwoDigits = (value: number): string => String(value).padStart(2, '0')

const formatClockTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`
}

const getChatDayReferenceDate = (timestamp: number): Date => new Date(timestamp - CHAT_DAY_MS_OFFSET)

const getChatDayStartTimestamp = (timestamp: number): number => {
  const date = getChatDayReferenceDate(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const getCalendarDayKey = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`
}

const getChatDayTimeRank = (timestamp: number): number => {
  const date = new Date(timestamp)
  return (date.getHours() * 60 + date.getMinutes() - CHAT_DAY_START_HOUR * 60 + 1440) % 1440
}

const formatChatDayMonthDay = (timestamp: number, prefixThisYear = false): string => {
  const date = getChatDayReferenceDate(timestamp)
  const prefix = prefixThisYear ? '今年的' : ''
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日`
}

const formatCalendarMonthDay = (timestamp: number, prefixThisYear = false): string => {
  const date = new Date(timestamp)
  const prefix = prefixThisYear ? '今年的' : ''
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日`
}

const formatCompactCount = (value: number): string => {
  const absolute = Math.abs(value)
  if (absolute < 1000) {
    return numberFormatter.format(Math.round(value))
  }

  const units = [
    { value: 1_000_000_000, suffix: 'b' },
    { value: 1_000_000, suffix: 'm' },
    { value: 1_000, suffix: 'k' },
  ] as const

  const unit = units.find((item) => absolute >= item.value) ?? units[units.length - 1]
  const scaled = value / unit.value
  const digits = Math.abs(scaled) >= 10 ? 1 : 1
  return `${scaled.toFixed(digits).replace(/\.0$/, '')}${unit.suffix}`
}

const formatTokenLabel = (value: number): string => {
  const compact = formatCompactCount(value)
  return /[a-z]$/i.test(compact) ? `${compact} Token` : `${compact}Token`
}

const snapshotRect = (element: Element | null): RectSnapshot | null => {
  if (!element) {
    return null
  }

  const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}

const shiftRect = (rect: RectSnapshot, x: number, y: number): RectSnapshot => ({
  left: rect.left + x,
  top: rect.top + y,
  width: rect.width,
  height: rect.height,
})

const getTravelOffset = (
  fromRect: RectSnapshot,
  toRect: RectSnapshot,
): { x: number; y: number } => {
  const fromCenterX = fromRect.left + fromRect.width / 2
  const fromCenterY = fromRect.top + fromRect.height / 2
  const toCenterX = toRect.left + toRect.width / 2
  const toCenterY = toRect.top + toRect.height / 2
  const deltaX = toCenterX - fromCenterX
  const deltaY = toCenterY - fromCenterY
  const distance = Math.hypot(deltaX, deltaY)

  if (distance < 0.001) {
    return { x: 0, y: 0 }
  }

  const travel = clamp(
    distance * TITLE_EDIT_TRANSITION_TRAVEL_FACTOR,
    TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX,
    TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX,
  )

  return {
    x: (deltaX / distance) * travel,
    y: (deltaY / distance) * travel,
  }
}

const normalizeStoredUsage = (raw: unknown): TokenUsage | undefined => {
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

const normalizeStoredSkillSteps = (value: unknown): SkillStep[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const steps: SkillStep[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      continue
    }
    if (typeof item.skill !== 'string') {
      continue
    }
    if (item.status !== 'running' && item.status !== 'success' && item.status !== 'error') {
      continue
    }

    const kind: SkillStepKind = item.kind === 'skill_read' ? 'skill_read' : 'skill_call'
    const script = typeof item.script === 'string' && item.script.trim() ? item.script : undefined
    if (kind === 'skill_call' && !script) {
      continue
    }

    const sections = Array.isArray(item.sections)
      ? item.sections
          .filter((section): section is string => typeof section === 'string')
          .map((section) => section.trim())
          .filter(Boolean)
      : undefined

    steps.push({
      id: item.id,
      kind,
      skill: item.skill,
      script,
      sections: sections && sections.length > 0 ? sections : undefined,
      explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      result: typeof item.result === 'string' ? item.result : undefined,
      status: item.status,
      error: typeof item.error === 'string' ? item.error : undefined,
    })
  }

  return steps.length > 0 ? steps : undefined
}

const normalizeStoredSkillRounds = (value: unknown): SkillRound[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const rounds: SkillRound[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      continue
    }

    const steps = normalizeStoredSkillSteps(item.steps)
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

const extractThinkBlocks = (text: string): { cleanedText: string; reasoning: string } => {
  const reasoningChunks: string[] = []
  const cleaned = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, captured: string) => {
    const value = captured.trim()
    if (value.length > 0) {
      reasoningChunks.push(value)
    }
    return ''
  })
  return {
    cleanedText: cleaned.trim(),
    reasoning: reasoningChunks.join('\n\n').trim(),
  }
}

const estimateTokens = (text: string): number => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 0
  }

  const cjkCount = (normalized.match(/[\u3400-\u9fff]/g) ?? []).length
  const latinCount = normalized.length - cjkCount
  return Math.max(1, Math.ceil(cjkCount + latinCount / 4))
}

const apiMessageToText = (message: ApiMessage): string => {
  if (typeof message.content === 'string') {
    return message.content
  }
  return message.content
    .map((part) => (part.type === 'text' ? part.text : '[image]'))
    .join('\n')
    .trim()
}

const estimateUsage = (promptMessages: ApiMessage[], responseText: string): TokenUsage => {
  const promptText = promptMessages.map((message) => apiMessageToText(message)).join('\n')
  const promptTokens = estimateTokens(promptText)
  const completionTokens = estimateTokens(responseText)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

const modelHealthLabel = (state: ModelHealth | undefined): string => {
  switch (state) {
    case 'testing':
      return '检测中'
    case 'ok':
      return '可用'
    case 'error':
      return '失败'
    default:
      return '检测'
  }
}

const formatMs = (value: number | undefined): string => {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`
  }
  return `${(value / 1000).toFixed(2)}s`
}

const formatSkillStepStatus = (status: SkillStep['status']): string => {
  switch (status) {
    case 'running':
      return '进行中'
    case 'success':
      return '已完成'
    case 'error':
      return '失败'
    default:
      return status
  }
}

const formatSkillStepTarget = (step: SkillStep): string =>
  step.kind === 'skill_read'
    ? `${step.skill} / skill_read`
    : `${step.skill} / ${step.script ?? ''}`

const formatSkillStepResult = (payload: Record<string, unknown>): string =>
  ['```json', JSON.stringify(payload, null, 2), '```'].join('\n')

const vibrateInteraction = (): void => {
  void Haptics.vibrate({ duration: 10 }).catch(() => {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10)
      }
    })
  })
}

const buildApiMessages = (messages: ChatMessage[], systemPrompt: string): ApiMessage[] => {
  const payload: ApiMessage[] = []

  if (systemPrompt.trim()) {
    payload.push({ role: 'system', content: systemPrompt.trim() })
  }

  for (const message of messages) {
    if (message.role === 'assistant') {
      payload.push({
        role: 'assistant',
        content: message.text,
      })
      continue
    }

    const parts: ApiContentPart[] = []
    if (message.text.trim()) {
      parts.push({ type: 'text', text: message.text })
    }

    for (const image of message.images ?? []) {
      parts.push({
        type: 'image_url',
        image_url: { url: image.dataUrl },
      })
    }

    if (parts.length === 0) {
      payload.push({ role: 'user', content: '' })
    } else if (parts.length === 1 && parts[0].type === 'text') {
      payload.push({ role: 'user', content: parts[0].text })
    } else {
      payload.push({ role: 'user', content: parts })
    }
  }

  return payload
}

const MAX_SKILL_AGENT_STEPS = 8

const buildConversationStateBlock = (messages: ChatMessage[]): PromptBlock => ({
  type: 'conversation_state',
  title: 'Conversation State',
  content:
    messages.length === 0
      ? '这是本轮开始前的空对话。'
      : messages
          .map((message, index) => {
            const lines = [`## ${index + 1}. ${message.role === 'user' ? 'User' : 'Assistant'}`]
            const text = message.text.trim()
            if (text) {
              lines.push(text)
            } else {
              lines.push('（无文本内容）')
            }
            if ((message.images?.length ?? 0) > 0) {
              lines.push(`附带图片：${message.images?.length ?? 0} 张`)
            }
            if (message.error) {
              lines.push(`错误：${message.error}`)
            }
            return lines.join('\n')
          })
          .join('\n\n'),
})

const buildUserInputBlock = (message: ChatMessage): PromptBlock => {
  const lines: string[] = []
  const text = message.text.trim()
  lines.push(text || '（无文本内容）')
  if ((message.images?.length ?? 0) > 0) {
    lines.push(`附带图片：${message.images?.length ?? 0} 张`)
  }

  return {
    type: 'user_input',
    title: 'User Input',
    content: lines.join('\n\n'),
  }
}

const buildSkillCallBlock = (action: SkillCallAction): PromptBlock => ({
  type: 'skill_call',
  title: `Skill Call ${action.id}`,
  content: ['```json', JSON.stringify(action, null, 2), '```'].join('\n'),
})

const parseSkillExecutionPayload = (
  action: SkillCallAction,
  stdout: string,
  stderr: string,
): Record<string, unknown> => {
  const trimmedStdout = stdout.trim()
  if (!trimmedStdout) {
    return {
      id: action.id,
      skill: action.skill,
      script: action.script,
      stdout: '',
      stderr: stderr.trim(),
    }
  }

  try {
    const parsed = JSON.parse(trimmedStdout) as unknown
    if (isRecord(parsed)) {
      return {
        id: action.id,
        skill: action.skill,
        script: action.script,
        ...parsed,
        stderr: stderr.trim() || undefined,
      }
    }
  } catch {
    // Fall through to raw payload.
  }

  return {
    id: action.id,
    skill: action.skill,
    script: action.script,
    stdout: trimmedStdout,
    stderr: stderr.trim() || undefined,
  }
}

const buildSkillAgentMessages = (
  historyBeforeCurrentUser: ChatMessage[],
  currentUserMessage: ChatMessage,
  settings: AppSettings,
  blocks: PromptBlock[],
): ApiMessage[] => {
  const payload: ApiMessage[] = []
  const systemSections = [
    settings.systemPrompt.trim(),
    settings.skillCallSystemPrompt.trim(),
  ].filter(Boolean)
  if (systemSections.length > 0) {
    payload.push({
      role: 'system',
      content: systemSections.join('\n\n'),
    })
  }
  if (historyBeforeCurrentUser.some((message) => (message.images?.length ?? 0) > 0)) {
    payload.push(...buildApiMessages(historyBeforeCurrentUser, ''))
  }

  const promptText = buildPromptBlocksText(blocks)
  if ((currentUserMessage.images?.length ?? 0) === 0) {
    payload.push({
      role: 'user',
      content: promptText,
    })
    return payload
  }

  payload.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: promptText,
      },
      ...(currentUserMessage.images ?? []).map((image) => ({
        type: 'image_url' as const,
        image_url: {
          url: image.dataUrl,
        },
      })),
    ],
  })
  return payload
}

const normalizeStoredImages = (value: unknown): ImageAttachment[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  const images: ImageAttachment[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }
    if (typeof item.id !== 'string' || typeof item.dataUrl !== 'string') {
      continue
    }
    images.push({
      id: item.id,
      name: typeof item.name === 'string' ? item.name : 'image',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'image/*',
      size: Math.max(0, Math.round(toFiniteNumber(item.size) ?? 0)),
      dataUrl: item.dataUrl,
    })
  }
  return images.length > 0 ? images : undefined
}

const normalizeStoredMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const messages: ChatMessage[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    if (
      typeof item.id !== 'string' ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.text !== 'string'
    ) {
      continue
    }

    const usage = normalizeStoredUsage(item.usage) ?? normalizeUsage(item.usage)

    messages.push({
      id: item.id,
      role: item.role,
      text: item.text,
      images: normalizeStoredImages(item.images),
      reasoning: typeof item.reasoning === 'string' ? item.reasoning : undefined,
      skillRounds: normalizeStoredSkillRounds(item.skillRounds),
      skillSteps: normalizeStoredSkillSteps(item.skillSteps),
      createdAt: Math.round(toFiniteNumber(item.createdAt) ?? Date.now()),
      model: typeof item.model === 'string' ? item.model : undefined,
      usage,
      usageEstimated: item.usageEstimated === true,
      firstTokenLatencyMs: toFiniteNumber(item.firstTokenLatencyMs),
      totalTimeMs: toFiniteNumber(item.totalTimeMs),
      error: typeof item.error === 'string' ? item.error : undefined,
    })
  }

  return messages.slice(-MAX_STORED_MESSAGES)
}

const sanitizeTitleText = (text: string): string =>
  text
    .replace(/[#[\]>*`_~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const deriveConversationTitle = (messages: ChatMessage[]): string | undefined => {
  const firstUser = messages.find((message) => message.role === 'user')
  const hasFirstRound = messages.some(
    (message) => message.role === 'assistant' && message.text.trim().length > 0 && !message.error,
  )

  if (!firstUser || !hasFirstRound) {
    return undefined
  }

  const textCandidate = sanitizeTitleText(firstUser.text)
  let candidate = textCandidate
  if (!candidate && (firstUser.images?.length ?? 0) > 0) {
    candidate = '图片对话'
  }
  if (!candidate) {
    return undefined
  }
  return candidate.length > 20 ? `${candidate.slice(0, 20)}…` : candidate
}

const inferConversationCreatedAt = (messages: ChatMessage[]): number => {
  const firstUser = messages.find((message) => message.role === 'user')
  return firstUser?.createdAt ?? messages[0]?.createdAt ?? Date.now()
}

const isConversationPlaceholder = (conversation: Conversation): boolean =>
  conversation.messages.length === 0

const withConversationMessages = (
  conversation: Conversation,
  messages: ChatMessage[],
  options?: {
    keepUpdatedAt?: boolean
  },
): Conversation => {
  const trimmedMessages = messages.slice(-MAX_STORED_MESSAGES)
  const nextTitle = conversation.titleManuallyEdited
    ? conversation.title
    : deriveConversationTitle(trimmedMessages) ?? '新对话'
  const nextCreatedAt =
    isConversationPlaceholder(conversation) && trimmedMessages.length > 0
      ? inferConversationCreatedAt(trimmedMessages)
      : conversation.createdAt > 0 || trimmedMessages.length === 0
      ? conversation.createdAt
      : inferConversationCreatedAt(trimmedMessages)
  return {
    ...conversation,
    title: nextTitle,
    messages: trimmedMessages,
    createdAt: nextCreatedAt,
    updatedAt:
      nextCreatedAt <= 0
        ? 0
        : options?.keepUpdatedAt
          ? Math.max(conversation.updatedAt, nextCreatedAt)
          : Date.now(),
  }
}

const createConversation = (messages: ChatMessage[] = []): Conversation => {
  const trimmedMessages = messages.slice(-MAX_STORED_MESSAGES)
  const createdAt = trimmedMessages.length > 0 ? inferConversationCreatedAt(trimmedMessages) : 0
  const updatedAt =
    trimmedMessages.length > 0
      ? Math.max(trimmedMessages[trimmedMessages.length - 1]?.createdAt ?? createdAt, createdAt)
      : 0
  return {
    id: createId(),
    title: deriveConversationTitle(trimmedMessages) ?? '新对话',
    titleManuallyEdited: false,
    messages: trimmedMessages,
    createdAt,
    updatedAt,
  }
}

const serializeConversationsForStorage = (conversations: Conversation[]): Conversation[] =>
  conversations.slice(0, MAX_STORED_CONVERSATIONS).map((conversation) => ({
    ...conversation,
    messages: conversation.messages.slice(-MAX_STORED_MESSAGES),
  }))

const serializeConversationDraftsForStorage = (
  conversations: Conversation[],
  draftsByConversation: ConversationDrafts,
): ConversationDrafts => {
  const validConversationIds = new Set(conversations.map((conversation) => conversation.id))

  const drafts: ConversationDrafts = {}
  for (const [conversationId, draft] of Object.entries(draftsByConversation)) {
    if (validConversationIds.has(conversationId) && draft.length > 0) {
      drafts[conversationId] = draft
    }
  }
  return drafts
}

const normalizeLatexDelimiters = (text: string): string =>
  text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, captured: string) => `$$${captured}$$`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, captured: string) => `$${captured}$`)

const useAnimatedVisibility = (
  durationMs: number,
): {
  mounted: boolean
  visible: boolean
  open: () => void
  close: () => void
} => {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const open = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setMounted(true)
    window.requestAnimationFrame(() => setVisible(true))
  }, [])

  const close = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setVisible(false)
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      closeTimerRef.current = null
    }, durationMs)
  }, [durationMs])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  return { mounted, visible, open, close }
}

const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return DEFAULT_SETTINGS
    }

    const models = Array.isArray(parsed.models)
      ? parsed.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : DEFAULT_SETTINGS.models
    const currentModel =
      typeof parsed.currentModel === 'string' ? parsed.currentModel : DEFAULT_SETTINGS.currentModel

    const rawTemperature = toFiniteNumber(parsed.temperature)
    const rawTopP = toFiniteNumber(parsed.topP)
    const rawMaxTokens = toFiniteNumber(parsed.maxTokens)
    const rawPresencePenalty = toFiniteNumber(parsed.presencePenalty)
    const rawFrequencyPenalty = toFiniteNumber(parsed.frequencyPenalty)
    const rawDeleteConfirmGraceSeconds = toFiniteNumber(parsed.deleteConfirmGraceSeconds)
    const rawConversationGroupGapMinutes = toFiniteNumber(parsed.conversationGroupGapMinutes)
    const rawEmptyStateStatsMinConversations = toFiniteNumber(parsed.emptyStateStatsMinConversations)
    const rawMaxModelRetryCount = toFiniteNumber(parsed.maxModelRetryCount)

    return {
      apiBaseUrl: typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_SETTINGS.apiKey,
      systemPrompt:
        typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : DEFAULT_SETTINGS.systemPrompt,
      skillCallSystemPrompt:
        typeof parsed.skillCallSystemPrompt === 'string'
          ? upgradeSkillCallSystemPrompt(parsed.skillCallSystemPrompt)
          : DEFAULT_SETTINGS.skillCallSystemPrompt,
      temperature:
        rawTemperature !== undefined ? clamp(rawTemperature, 0, 2) : DEFAULT_SETTINGS.temperature,
      topP: rawTopP !== undefined ? clamp(rawTopP, 0, 1) : DEFAULT_SETTINGS.topP,
      maxTokens:
        rawMaxTokens !== undefined
          ? Math.round(clamp(rawMaxTokens, 1, 8192))
          : DEFAULT_SETTINGS.maxTokens,
      presencePenalty:
        rawPresencePenalty !== undefined
          ? clamp(rawPresencePenalty, -2, 2)
          : DEFAULT_SETTINGS.presencePenalty,
      frequencyPenalty:
        rawFrequencyPenalty !== undefined
          ? clamp(rawFrequencyPenalty, -2, 2)
          : DEFAULT_SETTINGS.frequencyPenalty,
      showReasoning:
        typeof parsed.showReasoning === 'boolean'
          ? parsed.showReasoning
          : DEFAULT_SETTINGS.showReasoning,
      deleteModeHapticsEnabled:
        typeof parsed.deleteModeHapticsEnabled === 'boolean'
          ? parsed.deleteModeHapticsEnabled
          : DEFAULT_SETTINGS.deleteModeHapticsEnabled,
      firstTokenHapticsEnabled:
        typeof parsed.firstTokenHapticsEnabled === 'boolean'
          ? parsed.firstTokenHapticsEnabled
          : DEFAULT_SETTINGS.firstTokenHapticsEnabled,
      models,
      currentModel,
      deleteConfirmGraceSeconds:
        rawDeleteConfirmGraceSeconds !== undefined
          ? Math.round(clamp(rawDeleteConfirmGraceSeconds, 0, 600))
          : DEFAULT_SETTINGS.deleteConfirmGraceSeconds,
      conversationGroupGapMinutes:
        rawConversationGroupGapMinutes !== undefined
          ? Math.round(clamp(rawConversationGroupGapMinutes, 0, 120))
          : DEFAULT_SETTINGS.conversationGroupGapMinutes,
      autoCollapseConversations:
        typeof parsed.autoCollapseConversations === 'boolean'
          ? parsed.autoCollapseConversations
          : DEFAULT_SETTINGS.autoCollapseConversations,
      emptyStateStatsMinConversations:
        rawEmptyStateStatsMinConversations !== undefined
          ? Math.round(clamp(rawEmptyStateStatsMinConversations, 0, MAX_STORED_CONVERSATIONS))
          : DEFAULT_SETTINGS.emptyStateStatsMinConversations,
      maxModelRetryCount:
        rawMaxModelRetryCount !== undefined
          ? Math.round(clamp(rawMaxModelRetryCount, 0, 10))
          : DEFAULT_SETTINGS.maxModelRetryCount,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const loadChatState = (): LoadedChatState => {
  const fallbackConversation = createConversation()

  if (typeof localStorage === 'undefined') {
    return {
      conversations: [fallbackConversation],
      activeConversationId: fallbackConversation.id,
      draftsByConversation: {},
    }
  }

  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : undefined
    const conversations: Conversation[] = []

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!isRecord(item) || typeof item.id !== 'string') {
          continue
        }
        const messages = normalizeStoredMessages(item.messages)
        const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '新对话'
        const titleManuallyEdited =
          typeof item.titleManuallyEdited === 'boolean' ? item.titleManuallyEdited : false
        const nextConversation: Conversation = {
          id: item.id,
          title,
          titleManuallyEdited,
          messages,
          createdAt: Math.round(toFiniteNumber(item.createdAt) ?? Date.now()),
          updatedAt: Math.round(toFiniteNumber(item.updatedAt) ?? Date.now()),
        }

        conversations.push(withConversationMessages(nextConversation, messages, { keepUpdatedAt: true }))
      }
    }

    if (conversations.length > 0) {
      const persistedConversations = conversations.filter(
        (conversation) => !isConversationPlaceholder(conversation),
      )
      const nextConversations = [fallbackConversation, ...persistedConversations].slice(
        0,
        MAX_STORED_CONVERSATIONS,
      )
      return {
        conversations: nextConversations,
        activeConversationId: fallbackConversation.id,
        draftsByConversation: {},
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_MESSAGES_STORAGE_KEY)
    const legacyMessages = legacyRaw ? normalizeStoredMessages(JSON.parse(legacyRaw) as unknown) : []
    if (legacyMessages.length > 0) {
      const conversation = createConversation(legacyMessages)
      return {
        conversations: [fallbackConversation, conversation].slice(0, MAX_STORED_CONVERSATIONS),
        activeConversationId: fallbackConversation.id,
        draftsByConversation: {},
      }
    }
  } catch {
    // Fallback to default state below.
  }

  return {
    conversations: [fallbackConversation],
    activeConversationId: fallbackConversation.id,
    draftsByConversation: {},
  }
}

const MarkdownMessage = ({ text }: { text: string }) => {
  const normalizedText = useMemo(() => normalizeLatexDelimiters(text), [text])

  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
      {normalizedText}
    </ReactMarkdown>
  )
}

function App() {
  const initialStateRef = useRef<LoadedChatState | null>(null)
  if (!initialStateRef.current) {
    initialStateRef.current = loadChatState()
  }

  const initialSettingsRef = useRef<AppSettings | null>(null)
  if (!initialSettingsRef.current) {
    initialSettingsRef.current = loadSettings()
  }

  const [settings, setSettings] = useState<AppSettings>(initialSettingsRef.current)
  const [numericSettingDrafts, setNumericSettingDrafts] = useState<NumericSettingDrafts>(() =>
    createNumericSettingDrafts(initialSettingsRef.current as AppSettings),
  )
  const [settingsView, setSettingsView] = useState<SettingsView>('main')
  const settingsRef = useRef<AppSettings>(initialSettingsRef.current as AppSettings)
  const [conversations, setConversations] = useState<Conversation[]>(
    initialStateRef.current.conversations,
  )
  const [activeConversationId, setActiveConversationId] = useState<string>(
    initialStateRef.current.activeConversationId,
  )
  const [draftsByConversation, setDraftsByConversation] = useState<ConversationDrafts>(
    initialStateRef.current.draftsByConversation,
  )
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const {
    mounted: settingsMounted,
    visible: settingsVisible,
    open: openSettings,
    close: closeSettings,
  } = useAnimatedVisibility(240)
  const {
    mounted: drawerMounted,
    visible: drawerVisible,
    open: openDrawer,
    close: closeDrawer,
  } = useAnimatedVisibility(240)
  const {
    mounted: modelMenuMounted,
    visible: modelMenuVisible,
    open: openModelMenu,
    close: closeModelMenu,
  } = useAnimatedVisibility(180)
  const [manualModel, setManualModel] = useState('')
  const [modelHealth, setModelHealth] = useState<Record<string, ModelHealth>>({})
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [deleteModeEnabled, setDeleteModeEnabled] = useState(false)
  const [deleteDialogConversationId, setDeleteDialogConversationId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [openReasoningByMessage, setOpenReasoningByMessage] = useState<Record<string, boolean>>({})
  const [openSkillResultByStep, setOpenSkillResultByStep] = useState<Record<string, boolean>>({})
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleTransition, setTitleTransition] = useState<TitleTransitionState | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [collapsedConversationGroups, setCollapsedConversationGroups] = useState<Record<string, boolean>>({})
  const [swipingConversationId, setSwipingConversationId] = useState<string | null>(null)
  const [swipeOffsetX, setSwipeOffsetX] = useState(0)
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true)
  const [skillRecords, setSkillRecords] = useState<SkillRecord[]>([])
  const [runtimeRecords, setRuntimeRecords] = useState<RuntimeRecord[]>([])
  const [isLoadingExtensions, setIsLoadingExtensions] = useState(true)
  const [isInstallingSkillArchive, setIsInstallingSkillArchive] = useState(false)
  const [isInstallingRuntimeArchive, setIsInstallingRuntimeArchive] = useState(false)
  const [skillConfigTargetId, setSkillConfigTargetId] = useState<string | null>(null)
  const [skillConfigDraft, setSkillConfigDraft] = useState('')
  const [skillConfigValue, setSkillConfigValue] = useState<JsonObjectValue>({})
  const [skillConfigRawError, setSkillConfigRawError] = useState<string | null>(null)
  const [isLoadingSkillConfig, setIsLoadingSkillConfig] = useState(false)
  const [isSavingSkillConfig, setIsSavingSkillConfig] = useState(false)
  const [openPromptEditors, setOpenPromptEditors] = useState<Record<PromptEditorKey, boolean>>({
    systemPrompt: true,
    skillCallSystemPrompt: true,
  })

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const skillArchiveInputRef = useRef<HTMLInputElement | null>(null)
  const runtimeArchiveInputRef = useRef<HTMLInputElement | null>(null)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const titleTextRef = useRef<HTMLSpanElement | null>(null)
  const titleRenameButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const titleActionsRef = useRef<HTMLDivElement | null>(null)
  const messageListRef = useRef<HTMLElement | null>(null)
  const settingsPageRef = useRef<HTMLElement | null>(null)
  const conversationListRef = useRef<HTMLDivElement | null>(null)
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const storageWarningShownRef = useRef(false)
  const settingsScrollByViewRef = useRef<Record<SettingsView, number>>({
    main: 0,
    skills: 0,
    'skill-config': 0,
    runtimes: 0,
  })
  const drawerScrollTopRef = useRef(0)
  const titleTransitionPrepRef = useRef<PendingTitleTransition | null>(null)
  const titleTransitionAnimationFrameRef = useRef<number | null>(null)
  const titleTransitionTimerRef = useRef<number | null>(null)
  const messageListInteractionTimerRef = useRef<number | null>(null)
  const messageListUserInteractingRef = useRef(false)
  const messageListProgrammaticScrollRef = useRef(false)
  const pendingMessageListBottomResetRef = useRef(true)
  const hasAutoCollapsedConversationGroupsRef = useRef(false)
  const conversationGroupElementRefs = useRef<Record<string, HTMLElement | null>>({})
  const deleteConfirmBypassUntilRef = useRef(0)
  const conversationSwipeStartRef = useRef<{
    conversationId: string
    pointerId: number
    x: number
    y: number
    thresholdReached: boolean
    longPressTriggered: boolean
    longPressTimerId: number | null
  } | null>(null)
  const ignoreNextConversationClickRef = useRef<string | null>(null)

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ??
      conversations[0] ??
      null,
    [conversations, activeConversationId],
  )
  const skillConfigTarget = useMemo(
    () =>
      skillConfigTargetId
        ? skillRecords.find((skill) => skill.id === skillConfigTargetId) ?? null
        : null,
    [skillConfigTargetId, skillRecords],
  )
  const nativeRuntimeAvailable = isNativeRuntimeAvailable()
  const deleteDialogConversation = useMemo(
    () =>
      deleteDialogConversationId
        ? conversations.find((conversation) => conversation.id === deleteDialogConversationId) ?? null
        : null,
    [conversations, deleteDialogConversationId],
  )
  const activeMessages = useMemo(() => activeConversation?.messages ?? [], [activeConversation])
  const draft = activeConversation ? draftsByConversation[activeConversation.id] ?? '' : ''
  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => !isConversationPlaceholder(conversation)),
    [conversations],
  )

  const sortedConversations = useMemo(
    () => [...visibleConversations].sort((left, right) => right.updatedAt - left.updatedAt),
    [visibleConversations],
  )
  const conversationGroups = useMemo<ConversationGroup[]>(() => {
    const conversationGroupGapMs = Math.max(0, settings.conversationGroupGapMinutes) * 60 * 1000
    const groups: ConversationGroup[] = []

    for (const conversation of sortedConversations) {
      const previousGroup = groups[groups.length - 1]
      const previousConversation = previousGroup?.conversations[previousGroup.conversations.length - 1]
      const shouldCreateGroup =
        !previousGroup ||
        !previousConversation ||
        previousConversation.updatedAt - conversation.updatedAt > conversationGroupGapMs

      if (shouldCreateGroup) {
        groups.push({
          id: conversation.id,
          labelTime: conversation.updatedAt,
          conversations: [conversation],
        })
        continue
      }

      previousGroup.conversations.push(conversation)
    }

    return groups.map((group) => ({
      ...group,
      id: group.conversations.map((conversation) => conversation.id).join('|'),
    }))
  }, [sortedConversations, settings.conversationGroupGapMinutes])

  const models = useMemo(() => {
    const merged = new Set(
      settings.models.map((item) => item.trim()).filter((item) => item.length > 0),
    )
    if (settings.currentModel.trim()) {
      merged.add(settings.currentModel.trim())
    }
    return Array.from(merged)
  }, [settings.models, settings.currentModel])

  const tokenSummary = useMemo(() => {
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let estimatedCount = 0

    for (const message of activeMessages) {
      if (message.role !== 'assistant' || !message.usage) {
        continue
      }
      promptTokens += message.usage.promptTokens
      completionTokens += message.usage.completionTokens
      totalTokens += message.usage.totalTokens
      if (message.usageEstimated) {
        estimatedCount += 1
      }
    }

    return { promptTokens, completionTokens, totalTokens, estimatedCount }
  }, [activeMessages])

  const rounds = useMemo(
    () => activeMessages.filter((message) => message.role === 'user').length,
    [activeMessages],
  )

  const emptyStateStats = useMemo(() => {
    const totalConversationCount = visibleConversations.length
    const allMessages = visibleConversations.flatMap((conversation) => conversation.messages)
    const userMessages = allMessages.filter((message) => message.role === 'user')
    const assistantMessages = allMessages.filter((message) => message.role === 'assistant')
    const totalPhotoCount = userMessages.reduce(
      (sum, message) => sum + (message.images?.length ?? 0),
      0,
    )
    const totalTokenCount = assistantMessages.reduce(
      (sum, message) => sum + (message.usage?.totalTokens ?? 0),
      0,
    )

    const earliestHistoryTimestamp = allMessages.reduce(
      (minimum, message) => Math.min(minimum, message.createdAt),
      Number.POSITIVE_INFINITY,
    )
    const daysSinceFirstConversation =
      Number.isFinite(earliestHistoryTimestamp) && totalConversationCount > 0
        ? Math.max(
            1,
            Math.round(
              (getChatDayStartTimestamp(Date.now()) - getChatDayStartTimestamp(earliestHistoryTimestamp)) /
                (24 * 60 * 60 * 1000),
            ) + 1,
          )
        : 0

    const currentYear = new Date().getFullYear()
    const currentYearUserMessages = userMessages.filter(
      (message) => getChatDayReferenceDate(message.createdAt).getFullYear() === currentYear,
    )
    const currentYearMessagesByChatDay = allMessages.filter(
      (message) => getChatDayReferenceDate(message.createdAt).getFullYear() === currentYear,
    )
    const currentYearMessagesByCalendarDay = allMessages.filter(
      (message) => new Date(message.createdAt).getFullYear() === currentYear,
    )

    const earliestTimeRecordCandidate = currentYearUserMessages.reduce<{
      timestamp: number
      rank: number
    } | null>((best, message) => {
      const rank = getChatDayTimeRank(message.createdAt)
      if (!best || rank < best.rank || (rank === best.rank && message.createdAt < best.timestamp)) {
        return { timestamp: message.createdAt, rank }
      }
      return best
    }, null)

    const latestTimeRecordCandidate = currentYearUserMessages.reduce<{
      timestamp: number
      rank: number
    } | null>((best, message) => {
      const rank = getChatDayTimeRank(message.createdAt)
      if (!best || rank > best.rank || (rank === best.rank && message.createdAt < best.timestamp)) {
        return { timestamp: message.createdAt, rank }
      }
      return best
    }, null)

    const earliestTimeRecord =
      earliestTimeRecordCandidate && earliestTimeRecordCandidate.rank < 3 * 60
        ? earliestTimeRecordCandidate
        : null
    const latestTimeRecord =
      latestTimeRecordCandidate && latestTimeRecordCandidate.rank > 18 * 60
        ? latestTimeRecordCandidate
        : null

    const activityByDay = new Map<
      string,
      {
        timestamp: number
        rounds: number
        tokens: number
      }
    >()

    for (const message of currentYearMessagesByCalendarDay) {
      const key = getCalendarDayKey(message.createdAt)
      const current =
        activityByDay.get(key) ??
        ({
          timestamp: message.createdAt,
          rounds: 0,
          tokens: 0,
        } as const)

      activityByDay.set(key, {
        timestamp: current.timestamp,
        rounds: current.rounds + (message.role === 'user' ? 1 : 0),
        tokens: current.tokens + (message.role === 'assistant' ? message.usage?.totalTokens ?? 0 : 0),
      })
    }

    const busiestDay = Array.from(activityByDay.values())
      .filter((day) => day.rounds > 0)
      .sort((left, right) => {
        if (right.rounds !== left.rounds) {
          return right.rounds - left.rounds
        }
        if (right.tokens !== left.tokens) {
          return right.tokens - left.tokens
        }
        return left.timestamp - right.timestamp
      })[0] ?? null

    const shouldShowMiddleSection =
      totalConversationCount > 0 &&
      totalConversationCount >= settings.emptyStateStatsMinConversations

    return {
      totalConversationCount,
      daysSinceFirstConversation,
      totalPhotoCount,
      totalTokenCount,
      earliestTimeRecord,
      latestTimeRecord,
      busiestDay: currentYearMessagesByChatDay.length > 0 ? busiestDay : null,
      shouldShowMiddleSection,
    }
  }, [settings.emptyStateStatsMinConversations, visibleConversations])

  const hasDraftText = draft.trim().length > 0
  const canSend = activeConversation !== null && (hasDraftText || pendingImages.length > 0) && !isSending

  const pushNotice = useCallback((text: string, type: Notice['type'] = 'info'): void => {
    setNotice({ text, type })
  }, [])

  const applySkillConfigValue = useCallback((nextValue: JsonObjectValue): void => {
    setSkillConfigValue(nextValue)
    setSkillConfigDraft(formatJsonObject(nextValue))
    setSkillConfigRawError(null)
  }, [])

  const handleSkillConfigDraftChange = useCallback((nextDraft: string): void => {
    setSkillConfigDraft(nextDraft)
    const parsed = parseSkillConfigDraft(nextDraft)
    if (parsed.error || !parsed.value) {
      setSkillConfigRawError(parsed.error ?? '配置必须是合法的 JSON。')
      return
    }
    setSkillConfigValue(parsed.value)
    setSkillConfigRawError(null)
  }, [])

  const formatSkillConfigDraft = useCallback((): void => {
    const parsed = parseSkillConfigDraft(skillConfigDraft)
    if (parsed.error || !parsed.value) {
      pushNotice(parsed.error ?? '当前配置不是合法 JSON，无法格式化。', 'error')
      return
    }
    applySkillConfigValue(parsed.value)
  }, [applySkillConfigValue, pushNotice, skillConfigDraft])

  const togglePromptEditor = useCallback((key: PromptEditorKey): void => {
    setOpenPromptEditors((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }, [])

  const openSettingsHome = useCallback((): void => {
    setSettingsView('main')
    setSkillConfigTargetId(null)
    setSkillConfigDraft('')
    setSkillConfigValue({})
    setSkillConfigRawError(null)
    openSettings()
  }, [openSettings])

  const rememberSettingsScrollPosition = useCallback((view: SettingsView = settingsView): void => {
    const settingsPage = settingsPageRef.current
    if (!settingsPage) {
      return
    }
    settingsScrollByViewRef.current[view] = settingsPage.scrollTop
  }, [settingsView])

  const navigateSettingsView = useCallback((nextView: SettingsView): void => {
    rememberSettingsScrollPosition()
    setSettingsView(nextView)
  }, [rememberSettingsScrollPosition])

  const closeSettingsPanel = useCallback((): void => {
    rememberSettingsScrollPosition()
    setSettingsView('main')
    setSkillConfigTargetId(null)
    setSkillConfigDraft('')
    setSkillConfigValue({})
    setSkillConfigRawError(null)
    closeSettings()
  }, [closeSettings, rememberSettingsScrollPosition])

  const handleSettingsBack = useCallback((): void => {
    if (settingsView === 'skill-config') {
      rememberSettingsScrollPosition()
      setSettingsView('skills')
      setSkillConfigTargetId(null)
      setSkillConfigDraft('')
      setSkillConfigValue({})
      setSkillConfigRawError(null)
      return
    }
    if (settingsView !== 'main') {
      rememberSettingsScrollPosition()
      setSettingsView('main')
      return
    }
    closeSettingsPanel()
  }, [closeSettingsPanel, rememberSettingsScrollPosition, settingsView])

  const refreshExtensions = useCallback(async (silent = false): Promise<void> => {
    if (!silent) {
      setIsLoadingExtensions(true)
    }
    try {
      await Promise.all([initializeSkillHost(), initializeRuntimeHost()])
      const [nextSkills, nextRuntimes] = await Promise.all([listSkills(), listRuntimes()])
      setSkillRecords(nextSkills)
      setRuntimeRecords(nextRuntimes)
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载扩展能力失败'
      setNotice({ text: `加载扩展能力失败：${message}`, type: 'error' })
    } finally {
      if (!silent) {
        setIsLoadingExtensions(false)
      }
    }
  }, [])

  const openSkillConfigEditor = useCallback(async (skillId: string): Promise<void> => {
    rememberSettingsScrollPosition()
    setSettingsView('skill-config')
    setSkillConfigTargetId(skillId)
    setIsLoadingSkillConfig(true)
    try {
      const config = await readSkillConfig(skillId)
      const nextValue = isJsonObjectRecord(config) ? config : {}
      setSkillConfigValue(nextValue)
      setSkillConfigDraft(formatJsonObject(nextValue))
      setSkillConfigRawError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取 skill 配置失败'
      pushNotice(`读取配置失败：${message}`, 'error')
      setSettingsView('skills')
      setSkillConfigTargetId(null)
      setSkillConfigDraft('')
      setSkillConfigValue({})
      setSkillConfigRawError(null)
    } finally {
      setIsLoadingSkillConfig(false)
    }
  }, [pushNotice, rememberSettingsScrollPosition])

  const saveSkillConfig = useCallback(async (): Promise<void> => {
    if (!skillConfigTargetId) {
      return
    }

    const parsed = parseSkillConfigDraft(skillConfigDraft)
    if (parsed.error || !parsed.value) {
      pushNotice(parsed.error ?? '配置必须是合法的 JSON。', 'error')
      return
    }

    setIsSavingSkillConfig(true)
    try {
      setSkillConfigValue(parsed.value)
      setSkillConfigRawError(null)
      await writeSkillConfig(skillConfigTargetId, parsed.value)
      await refreshExtensions(true)
      pushNotice(`已保存 ${skillConfigTargetId} 的配置。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存 skill 配置失败'
      pushNotice(`保存配置失败：${message}`, 'error')
    } finally {
      setIsSavingSkillConfig(false)
    }
  }, [pushNotice, refreshExtensions, skillConfigDraft, skillConfigTargetId])

  const handleSkillArchiveSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      setIsInstallingSkillArchive(true)
      try {
        const result = await installSkillPackage(file)
        await refreshExtensions(true)
        pushNotice(
          result.replacedExisting
            ? `Skill ${result.skill.id} 已更新。`
            : `Skill ${result.skill.id} 已安装。`,
          'success',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Skill 安装失败'
        pushNotice(`Skill 安装失败：${message}`, 'error')
      } finally {
        event.target.value = ''
        setIsInstallingSkillArchive(false)
      }
    },
    [refreshExtensions],
  )

  const handleRuntimeArchiveSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      setIsInstallingRuntimeArchive(true)
      try {
        const result = await installRuntimePackage(file)
        await refreshExtensions(true)
        pushNotice(
          result.replacedExisting
            ? `运行时 ${result.runtime.id} 已更新。`
            : `运行时 ${result.runtime.id} 已安装。`,
          'success',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : '运行时安装失败'
        pushNotice(`运行时安装失败：${message}`, 'error')
      } finally {
        event.target.value = ''
        setIsInstallingRuntimeArchive(false)
      }
    },
    [refreshExtensions],
  )

  const handleSetSkillEnabled = useCallback(async (skillId: string, enabled: boolean): Promise<void> => {
    try {
      await setSkillEnabled(skillId, enabled)
      setSkillRecords((previous) =>
        previous.map((skill) => (skill.id === skillId ? { ...skill, enabled } : skill)),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新 skill 状态失败'
      pushNotice(`更新 skill 状态失败：${message}`, 'error')
    }
  }, [])

  const handleDeleteSkill = useCallback(async (skillId: string): Promise<void> => {
    if (!window.confirm(`确认删除 skill "${skillId}" 吗？`)) {
      return
    }

    try {
      await deleteSkill(skillId)
      if (skillConfigTargetId === skillId) {
        setSettingsView('skills')
        setSkillConfigTargetId(null)
        setSkillConfigDraft('')
        setSkillConfigValue({})
        setSkillConfigRawError(null)
      }
      await refreshExtensions(true)
      pushNotice(`已删除 skill：${skillId}`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除 skill 失败'
      pushNotice(`删除 skill 失败：${message}`, 'error')
    }
  }, [refreshExtensions, skillConfigTargetId])

  const handleSetRuntimeEnabled = useCallback(async (runtimeId: string, enabled: boolean): Promise<void> => {
    try {
      await setRuntimeEnabled(runtimeId, enabled)
      setRuntimeRecords((previous) =>
        previous.map((runtime) => (runtime.id === runtimeId ? { ...runtime, enabled } : runtime)),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新运行时状态失败'
      pushNotice(`更新运行时状态失败：${message}`, 'error')
    }
  }, [])

  const handleDeleteRuntime = useCallback(async (runtimeId: string): Promise<void> => {
    if (!window.confirm(`确认删除运行时 "${runtimeId}" 吗？`)) {
      return
    }

    try {
      await deleteRuntime(runtimeId)
      await refreshExtensions(true)
      pushNotice(`已删除运行时：${runtimeId}`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除运行时失败'
      pushNotice(`删除运行时失败：${message}`, 'error')
    }
  }, [refreshExtensions])

  const handleSetDefaultRuntime = useCallback(
    async (runtime: RuntimeRecord): Promise<void> => {
      if (runtime.type !== 'python' && runtime.type !== 'node') {
        return
      }

      try {
        await setDefaultRuntime(runtime.type, runtime.id)
        await refreshExtensions(true)
        pushNotice(`已将 ${runtime.id} 设为默认 ${runtime.type} 运行时。`, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : '设置默认运行时失败'
        pushNotice(`设置默认运行时失败：${message}`, 'error')
      }
    },
    [refreshExtensions],
  )

  const handleTestRuntime = useCallback(async (runtimeId: string): Promise<void> => {
    setRuntimeRecords((previous) =>
      previous.map((runtime) =>
        runtime.id === runtimeId ? { ...runtime, testStatus: undefined, testMessage: '检测中...' } : runtime,
      ),
    )

    try {
      const nextRuntime = await testRuntime(runtimeId)
      setRuntimeRecords((previous) =>
        previous.map((runtime) => (runtime.id === runtimeId ? nextRuntime : runtime)),
      )
      pushNotice(
        nextRuntime.testStatus === 'ok'
          ? `运行时 ${runtimeId} 检测成功。`
          : `运行时 ${runtimeId} 检测失败：${nextRuntime.testMessage ?? '未知错误'}`,
        nextRuntime.testStatus === 'ok' ? 'success' : 'error',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '运行时检测失败'
      setRuntimeRecords((previous) =>
        previous.map((runtime) =>
          runtime.id === runtimeId ? { ...runtime, testStatus: 'error', testMessage: message } : runtime,
        ),
      )
      pushNotice(`运行时检测失败：${message}`, 'error')
    }
  }, [])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    settingsRef.current = { ...settingsRef.current, [key]: value }
    setSettings((previous) => ({ ...previous, [key]: value }))
  }

  const handleNumericSettingChange = (
    key: NumericSettingKey,
    rawValue: string,
    minimum: number,
    maximum: number,
    integer = false,
  ): void => {
    setNumericSettingDrafts((previous) => ({
      ...previous,
      [key]: rawValue,
    }))

    if (rawValue.trim() === '') {
      updateSetting(key, NUMERIC_SETTING_DEFAULTS[key] as AppSettings[typeof key])
      return
    }

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      return
    }

    const nextValue = integer ? Math.round(clamp(parsed, minimum, maximum)) : clamp(parsed, minimum, maximum)
    updateSetting(key, nextValue as AppSettings[typeof key])
  }

  const finalizeNumericSettingDraft = (key: NumericSettingKey): void => {
    setNumericSettingDrafts((previous) => ({
      ...previous,
      [key]: normalizeNumericSettingDraft(key, settingsRef.current[key]),
    }))
  }

  const updateConversationDraft = (conversationId: string, nextDraft: string): void => {
    const timestamp = Date.now()

    setConversations((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }

        if (!isConversationPlaceholder(conversation)) {
          return {
            ...conversation,
            updatedAt: timestamp,
          }
        }

        return conversation
      }),
    )

    setDraftsByConversation((previous) => {
      if (nextDraft.length === 0) {
        if (!Object.prototype.hasOwnProperty.call(previous, conversationId)) {
          return previous
        }
        const next = { ...previous }
        delete next[conversationId]
        return next
      }

      if (previous[conversationId] === nextDraft) {
        return previous
      }

      return {
        ...previous,
        [conversationId]: nextDraft,
      }
    })
  }

  const updateConversationMessages = (conversationId: string, messages: ChatMessage[]): void => {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? withConversationMessages(conversation, messages)
          : conversation,
      ),
    )
  }

  const updateAssistantMessage = (
    conversationId: string,
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ): void => {
    setConversations((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }

        let hasUpdatedMessage = false
        const nextMessages = conversation.messages.map((message) => {
          if (message.id !== assistantId) {
            return message
          }

          const nextMessage = updater(message)
          if (nextMessage === message) {
            return message
          }

          hasUpdatedMessage = true
          return nextMessage
        })

        return hasUpdatedMessage ? withConversationMessages(conversation, nextMessages) : conversation
      }),
    )
  }

  const appendAssistantStreamDelta = (
    conversationId: string,
    assistantId: string,
    delta: {
      content?: string
      reasoning?: string
    },
  ): void => {
    const content = delta.content ?? ''
    const reasoning = delta.reasoning ?? ''
    if (!content && !reasoning) {
      return
    }

    updateAssistantMessage(conversationId, assistantId, (message) => {
      const nextText = content ? `${message.text}${content}` : message.text
      const currentReasoning = message.reasoning ?? ''
      const nextReasoning = reasoning ? `${currentReasoning}${reasoning}` : currentReasoning

      if (nextText === message.text && nextReasoning === currentReasoning && message.error === undefined) {
        return message
      }

      return {
        ...message,
        text: nextText,
        reasoning: nextReasoning || undefined,
        error: undefined,
      }
    })
  }

  const resetAssistantStreamOutput = (conversationId: string, assistantId: string): void => {
    updateAssistantMessage(conversationId, assistantId, (message) => {
      if (!message.text && !message.reasoning && message.error === undefined) {
        return message
      }

      return {
        ...message,
        text: '',
        reasoning: undefined,
        error: undefined,
      }
    })
  }

  const updateAssistantSkillRounds = (
    conversationId: string,
    assistantId: string,
    updater: (rounds: SkillRound[]) => SkillRound[],
  ): void => {
    setConversations((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }

        let hasUpdatedMessage = false
        const nextMessages = conversation.messages.map((message) => {
          if (message.id !== assistantId) {
            return message
          }

          const currentRounds = message.skillRounds ?? []
          const nextRounds = updater(currentRounds)
          if (nextRounds === currentRounds) {
            return message
          }

          hasUpdatedMessage = true
          return {
            ...message,
            skillRounds: nextRounds.length > 0 ? nextRounds : undefined,
          }
        })

        return hasUpdatedMessage ? withConversationMessages(conversation, nextMessages) : conversation
      }),
    )
  }

  const updateConversationTitle = (
    conversationId: string,
    title: string,
    manual: boolean,
  ): void => {
    setConversations((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }
        const next = {
          ...conversation,
          title,
          titleManuallyEdited: manual,
          updatedAt: Date.now(),
        }
        return next
      }),
    )
  }

  const ensureReadyToRequest = (): boolean => {
    if (!settings.apiBaseUrl.trim() || !settings.apiKey.trim()) {
      pushNotice('请先在设置中填写 API 地址和 API Key。', 'error')
      openSettingsHome()
      closeDrawer()
      return false
    }
    if (!settings.currentModel.trim()) {
      pushNotice('请先选择模型。', 'error')
      openModelMenu()
      return false
    }
    return true
  }

  const applyAssistantResult = (
    conversationId: string,
    assistantId: string,
    result: CompletionResult,
    promptMessages: ApiMessage[],
  ): void => {
    const extracted = extractThinkBlocks(result.text)
    const finalText = extracted.cleanedText || result.text.trim() || '（模型未返回文本内容）'
    const finalReasoning = [result.reasoning, extracted.reasoning].filter(Boolean).join('\n\n').trim()
    const usage = result.usage ?? estimateUsage(promptMessages, finalText)
    const usageEstimated = result.usage === undefined

    setConversations((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }
        const nextMessages = conversation.messages.map((message) => {
          if (message.id !== assistantId) {
            return message
          }
          return {
            ...message,
            text: finalText,
            reasoning: finalReasoning || undefined,
            usage,
            usageEstimated,
            firstTokenLatencyMs: result.firstTokenLatencyMs,
            totalTimeMs: result.totalTimeMs,
            error: undefined,
          }
        })
        return withConversationMessages(conversation, nextMessages)
      }),
    )
  }

  const runAssistant = async (conversationId: string, history: ChatMessage[]): Promise<void> => {
    if (!ensureReadyToRequest()) {
      return
    }

    const settingsSnapshot = { ...settings }
    const assistantId = createId()
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      reasoning: '',
      createdAt: Date.now(),
      model: settingsSnapshot.currentModel,
    }

    updateConversationMessages(conversationId, [...history, placeholder])
    setIsSending(true)

    const controller = new AbortController()
    setAbortController(controller)
    let hasTriggeredFirstTokenHaptic = false
    const currentUserMessage = history[history.length - 1]
    const historyBeforeCurrentUser = history.slice(0, -1)
    const appendAssistantSkillRound = (roundId: string, explanation: string): void => {
      updateAssistantSkillRounds(conversationId, assistantId, (rounds) => [
        ...rounds,
        {
          id: roundId,
          explanation: explanation || undefined,
          steps: [],
        },
      ])
    }
    const appendAssistantSkillStep = (roundId: string, step: SkillStep): void => {
      updateAssistantSkillRounds(conversationId, assistantId, (rounds) =>
        rounds.map((round) =>
          round.id === roundId
            ? {
                ...round,
                steps: [...round.steps, step],
              }
            : round,
        ),
      )
    }
    const updateAssistantSkillStep = (
      roundId: string,
      stepId: string,
      patch: Partial<Pick<SkillStep, 'status' | 'error' | 'result'>>,
    ): void => {
      updateAssistantSkillRounds(conversationId, assistantId, (rounds) =>
        rounds.map((round) =>
          round.id === roundId
            ? {
                ...round,
                steps: round.steps.map((step) =>
                  step.id === stepId
                    ? {
                        ...step,
                        ...patch,
                      }
                    : step,
                ),
              }
            : round,
        ),
      )
    }
    const triggerFirstTokenHaptic = (): void => {
      if (!settingsSnapshot.firstTokenHapticsEnabled || hasTriggeredFirstTokenHaptic) {
        return
      }

      hasTriggeredFirstTokenHaptic = true
      vibrateInteraction()
    }
    const requestModelCompletion = async (promptMessages: ApiMessage[]): Promise<CompletionResult> => {
      const attemptLimit = Math.max(0, settingsSnapshot.maxModelRetryCount) + 1
      let lastError: unknown = null

      for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
        if (attempt > 0) {
          resetAssistantStreamOutput(conversationId, assistantId)
        }

        const streamParser = createAgentStreamParser()
        const flushStreamParser = (): void => {
          const delta = streamParser.flush()
          appendAssistantStreamDelta(conversationId, assistantId, {
            content: delta.content,
            reasoning: delta.reasoning,
          })
        }

        try {
          const completion = await requestStreamCompletion(
            settingsSnapshot,
            promptMessages,
            controller.signal,
            {
              onContent: (chunk) => {
                if (chunk.length > 0) {
                  triggerFirstTokenHaptic()
                }

                const delta = streamParser.push(chunk)
                appendAssistantStreamDelta(conversationId, assistantId, {
                  content: delta.content,
                  reasoning: delta.reasoning,
                })
              },
              onReasoning: (chunk) => {
                if (chunk.length > 0) {
                  triggerFirstTokenHaptic()
                }

                appendAssistantStreamDelta(conversationId, assistantId, {
                  reasoning: chunk,
                })
              },
            },
          )
          flushStreamParser()
          return completion
        } catch (streamError) {
          flushStreamParser()
          if (streamError instanceof DOMException && streamError.name === 'AbortError') {
            throw streamError
          }

          try {
            return await requestNonStreamCompletion(
              settingsSnapshot,
              promptMessages,
              controller.signal,
            )
          } catch (nonStreamError) {
            if (nonStreamError instanceof DOMException && nonStreamError.name === 'AbortError') {
              throw nonStreamError
            }
            lastError = nonStreamError
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error('模型调用失败')
    }

    try {
      if (!currentUserMessage || currentUserMessage.role !== 'user') {
        throw new Error('当前对话无法定位本轮用户输入。')
      }

      const blocks: PromptBlock[] = [
        {
          type: 'app_policy',
          title: 'Additional Prompt',
          content: '所有启用的skills包括：',
        },
        buildSkillsCatalogBlock(skillRecords),
        buildRuntimeCatalogBlock(runtimeRecords),
        buildConversationStateBlock(historyBeforeCurrentUser),
        buildUserInputBlock(currentUserMessage),
      ]

      const appendStatus = (text: string): void => {
        void text
      }

      let lastPromptMessages: ApiMessage[] = []
      let finalCompletion: CompletionResult | null = null

      for (let step = 0; step < MAX_SKILL_AGENT_STEPS; step += 1) {
        if (controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        const promptMessages = buildSkillAgentMessages(
          historyBeforeCurrentUser,
          currentUserMessage,
          settingsSnapshot,
          blocks,
        )
        lastPromptMessages = promptMessages

        const completion = await requestModelCompletion(promptMessages)

        const parsedCompletion = parseAgentActions(completion.text)
        if (parsedCompletion.actions.length === 0) {
          finalCompletion = completion
          break
        }

        const roundId = createId()
        const roundExplanation = extractThinkBlocks(parsedCompletion.displayText).cleanedText
        appendAssistantSkillRound(roundId, roundExplanation)
        resetAssistantStreamOutput(conversationId, assistantId)

        for (const action of parsedCompletion.actions) {
          if (controller.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }

          if (action.kind === 'skill_read') {
            const normalizedSections = (action.sections ?? []).map((section) => section.trim()).filter(Boolean)
            const stepId = createId()
            appendAssistantSkillStep(roundId, {
              id: stepId,
              kind: 'skill_read',
              skill: action.skill,
              sections: normalizedSections.length > 0 ? normalizedSections : undefined,
              status: 'running',
            })

            appendStatus(`读取 skill 说明：${action.skill}`)
            try {
              const payload = await readSkillSections(action.skill, normalizedSections)
              blocks.push({
                type: 'skill_doc',
                title: `Skill Doc ${action.skill}`,
                content: ['```json', JSON.stringify(payload, null, 2), '```'].join('\n'),
              })
              updateAssistantSkillStep(roundId, stepId, {
                status: 'success',
                error: undefined,
                result: formatSkillStepResult(payload),
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : '读取 skill 文档失败'
              const payload = {
                skill: action.skill,
                sections: normalizedSections.length > 0 ? normalizedSections : undefined,
                error: message,
              }
              blocks.push(formatSkillErrorBlock(`Skill Read ${action.skill}`, payload))
              updateAssistantSkillStep(roundId, stepId, {
                status: 'error',
                error: message,
                result: formatSkillStepResult(payload),
              })
            }
            continue
          }

          const stepId = createId()
          appendStatus(`调用 skill：${action.skill} / ${action.script}`)
          appendAssistantSkillStep(roundId, {
            id: stepId,
            kind: 'skill_call',
            skill: action.skill,
            script: action.script,
            status: 'running',
          })
          blocks.push(buildSkillCallBlock(action))

          try {
            const execution = await executeSkillCall(action)
            const payload = {
              ...parseSkillExecutionPayload(action, execution.stdout, execution.stderr),
              exitCode: execution.exitCode,
              elapsedMs: Math.round(execution.elapsedMs),
              resolvedCommand: execution.resolvedCommand,
              inferredRuntime: execution.inferredRuntime,
            }
            blocks.push(
              execution.ok
                ? formatSkillResultBlock(`${action.skill}/${action.script}`, payload)
                : formatSkillErrorBlock(`${action.skill}/${action.script}`, payload),
            )
            updateAssistantSkillStep(roundId, stepId, {
              status: execution.ok ? 'success' : 'error',
              error: execution.ok ? undefined : execution.stderr.trim() || `退出码 ${execution.exitCode}`,
              result: formatSkillStepResult(payload),
            })
            appendStatus(
              execution.ok
                ? `skill 完成：${action.skill} / ${action.script}`
                : `skill 失败：${action.skill} / ${action.script}`,
            )
          } catch (error) {
            const message = error instanceof Error ? error.message : 'skill 执行失败'
            const payload = {
              id: action.id,
              skill: action.skill,
              script: action.script,
              error: message,
            }
            updateAssistantSkillStep(roundId, stepId, {
              status: 'error',
              error: message,
              result: formatSkillStepResult(payload),
            })
            blocks.push(
              formatSkillErrorBlock(`${action.skill}/${action.script}`, {
                ...payload,
              }),
            )
            appendStatus(`skill 异常：${action.skill} / ${action.script}`)
          }
        }
      }

      if (!finalCompletion) {
        throw new Error(`skill agent 超过最大轮数限制（${MAX_SKILL_AGENT_STEPS}）`)
      }

      applyAssistantResult(conversationId, assistantId, finalCompletion, lastPromptMessages)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setConversations((previous) =>
          previous.map((conversation) => {
            if (conversation.id !== conversationId) {
              return conversation
            }
            const nextMessages = conversation.messages.map((message) =>
              message.id === assistantId
                ? { ...message, error: '已停止生成，可点击重生继续。' }
                : message,
            )
            return withConversationMessages(conversation, nextMessages)
          }),
        )
      } else {
        const message = error instanceof Error ? error.message : '未知错误'
        setConversations((previous) =>
          previous.map((conversation) => {
            if (conversation.id !== conversationId) {
              return conversation
            }
            const nextMessages = conversation.messages.map((item) =>
              item.id === assistantId ? { ...item, error: `请求失败：${message}` } : item,
            )
            return withConversationMessages(conversation, nextMessages)
          }),
        )
        pushNotice(`请求失败：${message}`, 'error')
      }
    } finally {
      setAbortController(null)
      setIsSending(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!canSend || !activeConversation || !ensureReadyToRequest()) {
      return
    }

    const nextMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      text: draft.trim(),
      images: pendingImages.length > 0 ? pendingImages : undefined,
      createdAt: Date.now(),
    }

    const history = [...activeConversation.messages, nextMessage]
    setDraftsByConversation((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, activeConversation.id)) {
        return previous
      }
      const next = { ...previous }
      delete next[activeConversation.id]
      return next
    })
    setPendingImages([])
    setEditingMessageId(null)
    closeModelMenu()
    await runAssistant(activeConversation.id, history)
  }

  const stopGeneration = (): void => {
    abortController?.abort()
  }

  const fetchModels = async (): Promise<void> => {
    if (!settings.apiBaseUrl.trim() || !settings.apiKey.trim()) {
      pushNotice('请先填写 API 地址和 Key。', 'error')
      return
    }

    setIsFetchingModels(true)
    try {
      const response = await fetch(buildApiUrl(settings.apiBaseUrl, '/models'), {
        headers: authHeaders(settings.apiKey),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const payload = (await response.json()) as unknown
      const modelData = isRecord(payload) && Array.isArray(payload.data) ? payload.data : []
      const incoming = modelData
        .map((item) => (isRecord(item) && typeof item.id === 'string' ? item.id.trim() : ''))
        .filter((id) => id.length > 0)

      if (incoming.length === 0) {
        pushNotice('接口返回了空模型列表。', 'info')
        return
      }

      setSettings((previous) => {
        const merged = new Set([...previous.models, ...incoming])
        const firstModel = previous.currentModel || incoming[0]
        return {
          ...previous,
          models: Array.from(merged),
          currentModel: firstModel,
        }
      })

      setModelHealth((previous) => {
        const updated = { ...previous }
        for (const modelId of incoming) {
          if (!updated[modelId]) {
            updated[modelId] = 'untested'
          }
        }
        return updated
      })

      pushNotice(`已加载 ${incoming.length} 个模型。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '模型加载失败'
      pushNotice(`模型加载失败：${message}`, 'error')
    } finally {
      setIsFetchingModels(false)
    }
  }

  const testModel = async (modelId: string): Promise<void> => {
    if (!settings.apiBaseUrl.trim() || !settings.apiKey.trim()) {
      pushNotice('请先填写 API 地址和 Key。', 'error')
      return
    }

    setModelHealth((previous) => ({ ...previous, [modelId]: 'testing' }))
    try {
      const response = await fetch(buildApiUrl(settings.apiBaseUrl, '/chat/completions'), {
        method: 'POST',
        headers: authHeaders(settings.apiKey),
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 4,
          temperature: 0,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      setModelHealth((previous) => ({ ...previous, [modelId]: 'ok' }))
      pushNotice(`模型 ${modelId} 检测成功。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '检测失败'
      setModelHealth((previous) => ({ ...previous, [modelId]: 'error' }))
      pushNotice(`模型 ${modelId} 检测失败：${message}`, 'error')
    }
  }

  const addManualModel = (): void => {
    const model = manualModel.trim()
    if (!model) {
      return
    }
    setSettings((previous) => ({
      ...previous,
      models: Array.from(new Set([...previous.models, model])),
      currentModel: previous.currentModel || model,
    }))
    setModelHealth((previous) => ({ ...previous, [model]: previous[model] ?? 'untested' }))
    setManualModel('')
  }

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    try {
      const attachments = await createImageAttachments(files)
      setPendingImages((previous) => [...previous, ...attachments])
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片读取失败'
      pushNotice(message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  const removePendingImage = (imageId: string): void => {
    setPendingImages((previous) => previous.filter((image) => image.id !== imageId))
  }

  const beginEdit = (message: ChatMessage): void => {
    setEditingMessageId(message.id)
    setEditingText(message.text)
  }

  const cancelEdit = (): void => {
    setEditingMessageId(null)
    setEditingText('')
  }

  const saveAssistantEdit = (): void => {
    if (!editingMessageId || !activeConversation) {
      return
    }
    const nextText = editingText.trim()
    if (!nextText) {
      pushNotice('内容不能为空。', 'error')
      return
    }
    const nextMessages = activeConversation.messages.map((message) =>
      message.id === editingMessageId ? { ...message, text: nextText } : message,
    )
    updateConversationMessages(activeConversation.id, nextMessages)
    cancelEdit()
  }

  const saveUserEdit = async (resend: boolean): Promise<void> => {
    if (!editingMessageId || !activeConversation) {
      return
    }
    const nextText = editingText.trim()
    if (!nextText) {
      pushNotice('内容不能为空。', 'error')
      return
    }

    const index = activeConversation.messages.findIndex(
      (message) => message.id === editingMessageId,
    )
    if (index < 0) {
      cancelEdit()
      return
    }

    const target = activeConversation.messages[index]
    if (target.role !== 'user') {
      cancelEdit()
      return
    }

    const updatedUser: ChatMessage = { ...target, text: nextText }

    if (!resend) {
      const nextMessages = activeConversation.messages.map((message) =>
        message.id === editingMessageId ? updatedUser : message,
      )
      updateConversationMessages(activeConversation.id, nextMessages)
      cancelEdit()
      return
    }

    if (isSending) {
      pushNotice('请先停止当前生成。', 'error')
      return
    }

    if (!ensureReadyToRequest()) {
      return
    }

    const history = [...activeConversation.messages.slice(0, index), updatedUser]
    cancelEdit()
    await runAssistant(activeConversation.id, history)
  }

  const regenerate = async (assistantId: string): Promise<void> => {
    if (!activeConversation || isSending) {
      if (isSending) {
        pushNotice('请先停止当前生成。', 'error')
      }
      return
    }

    const index = activeConversation.messages.findIndex((message) => message.id === assistantId)
    if (index <= 0) {
      return
    }

    const previousMessage = activeConversation.messages[index - 1]
    if (previousMessage.role !== 'user') {
      pushNotice('无法定位该回答对应的用户输入。', 'error')
      return
    }

    const history = activeConversation.messages.slice(0, index)
    await runAssistant(activeConversation.id, history)
  }

  const copyMessageText = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      pushNotice('已复制到剪贴板。', 'success')
    } catch {
      pushNotice('复制失败，请检查剪贴板权限。', 'error')
    }
  }

  const clearTitleTransitionTimers = useCallback((): void => {
    if (titleTransitionAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(titleTransitionAnimationFrameRef.current)
      titleTransitionAnimationFrameRef.current = null
    }
    if (titleTransitionTimerRef.current !== null) {
      window.clearTimeout(titleTransitionTimerRef.current)
      titleTransitionTimerRef.current = null
    }
  }, [])

  const playTitleTransition = useCallback((nextTransition: TitleTransitionState): void => {
    clearTitleTransitionTimers()
    setTitleTransition(nextTransition)
    titleTransitionAnimationFrameRef.current = window.requestAnimationFrame(() => {
      titleTransitionAnimationFrameRef.current = null
      setTitleTransition((previous) => (previous ? { ...previous, playing: true } : previous))
      titleTransitionTimerRef.current = window.setTimeout(() => {
        setTitleTransition(null)
        titleTransitionTimerRef.current = null
      }, TITLE_EDIT_TRANSITION_MS)
    })
  }, [clearTitleTransitionTimers])

  const stopRenameConversationImmediately = useCallback((): void => {
    titleTransitionPrepRef.current = null
    clearTitleTransitionTimers()
    setTitleTransition(null)
    setIsEditingTitle(false)
    setTitleDraft('')
  }, [clearTitleTransitionTimers])

  const clearMessageListInteractionTimer = useCallback((): void => {
    if (messageListInteractionTimerRef.current !== null) {
      window.clearTimeout(messageListInteractionTimerRef.current)
      messageListInteractionTimerRef.current = null
    }
  }, [])

  const isMessageListAtBottom = useCallback((): boolean => {
    const messageList = messageListRef.current
    if (!messageList) {
      return true
    }

    return (
      messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <=
      MESSAGE_LIST_BOTTOM_THRESHOLD_PX
    )
  }, [])

  const scrollMessageListToBottom = useCallback((): void => {
    const messageList = messageListRef.current
    if (!messageList) {
      return
    }

    messageListProgrammaticScrollRef.current = true
    messageList.scrollTop = messageList.scrollHeight
    window.requestAnimationFrame(() => {
      messageListProgrammaticScrollRef.current = false
    })
  }, [])

  const beginMessageListInteraction = useCallback((): void => {
    clearMessageListInteractionTimer()
    messageListUserInteractingRef.current = true
  }, [clearMessageListInteractionTimer])

  const scheduleMessageListInteractionEnd = useCallback((): void => {
    clearMessageListInteractionTimer()
    messageListInteractionTimerRef.current = window.setTimeout(() => {
      messageListInteractionTimerRef.current = null
      messageListUserInteractingRef.current = false

      if (isMessageListAtBottom()) {
        setIsAutoFollowEnabled(true)
        scrollMessageListToBottom()
      }
    }, MESSAGE_LIST_INTERACTION_IDLE_MS)
  }, [clearMessageListInteractionTimer, isMessageListAtBottom, scrollMessageListToBottom])

  const handleMessageListScroll = useCallback(
    (event: UIEvent<HTMLElement>): void => {
      if (messageListProgrammaticScrollRef.current) {
        return
      }

      const messageList = event.currentTarget
      const atBottom =
        messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <=
        MESSAGE_LIST_BOTTOM_THRESHOLD_PX

      beginMessageListInteraction()
      setIsAutoFollowEnabled((previous) => (previous === atBottom ? previous : atBottom))
      scheduleMessageListInteractionEnd()
    },
    [beginMessageListInteraction, scheduleMessageListInteractionEnd],
  )

  const handleMessageListPointerDownCapture = useCallback((): void => {
    beginMessageListInteraction()
  }, [beginMessageListInteraction])

  const handleMessageListPointerUpCapture = useCallback((): void => {
    scheduleMessageListInteractionEnd()
  }, [scheduleMessageListInteractionEnd])

  const handleMessageListPointerCancelCapture = useCallback((): void => {
    scheduleMessageListInteractionEnd()
  }, [scheduleMessageListInteractionEnd])

  const handleMessageListWheelCapture = useCallback(
    (): void => {
      beginMessageListInteraction()
      scheduleMessageListInteractionEnd()
    },
    [beginMessageListInteraction, scheduleMessageListInteractionEnd],
  )

  const switchConversation = (conversationId: string): void => {
    setActiveConversationId(conversationId)
    closeDrawer()
    closeModelMenu()
    setDeleteModeEnabled(false)
    setDeleteDialogConversationId(null)
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
  }

  const clearConversationGestureTimer = (): void => {
    const gesture = conversationSwipeStartRef.current
    const longPressTimerId = gesture?.longPressTimerId ?? null
    if (longPressTimerId !== null && gesture) {
      window.clearTimeout(longPressTimerId)
      gesture.longPressTimerId = null
    }
  }

  const resetConversationSwipe = (): void => {
    clearConversationGestureTimer()
    conversationSwipeStartRef.current = null
    setSwipingConversationId(null)
    setSwipeOffsetX(0)
  }

  const toggleDeleteMode = (): void => {
    setDeleteModeEnabled((previous) => !previous)
  }

  const extendDeleteConfirmGrace = (): void => {
    const deleteConfirmGraceMs = Math.max(0, settings.deleteConfirmGraceSeconds) * 1000
    deleteConfirmBypassUntilRef.current =
      deleteConfirmGraceMs > 0 ? Date.now() + deleteConfirmGraceMs : 0
  }

  const deleteConversation = (conversationId: string): void => {
    let deletedActiveConversation = false
    let nextActiveConversationId: string | null = null

    setDeleteDialogConversationId((previous) => (previous === conversationId ? null : previous))
    setDraftsByConversation((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, conversationId)) {
        return previous
      }
      const next = { ...previous }
      delete next[conversationId]
      return next
    })

    setConversations((previous) => {
      const exists = previous.some((conversation) => conversation.id === conversationId)
      if (!exists) {
        return previous
      }

      deletedActiveConversation = previous.some(
        (conversation) => conversation.id === conversationId && conversation.id === activeConversationId,
      )
      const remaining = previous.filter((conversation) => conversation.id !== conversationId)
      if (remaining.some((conversation) => conversation.id === activeConversationId)) {
        return remaining
      }

      const fallbackConversation =
        [...remaining].sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? createConversation()
      nextActiveConversationId = fallbackConversation.id
      return remaining.length > 0 ? remaining : [fallbackConversation]
    })

    if (nextActiveConversationId) {
      setActiveConversationId(nextActiveConversationId)
    }
    if (deletedActiveConversation) {
      setPendingImages([])
      cancelEdit()
      stopRenameConversationImmediately()
    }
    pushNotice('对话已删除。', 'success')
  }

  const closeDeleteDialog = (): void => {
    setDeleteDialogConversationId(null)
  }

  const confirmDeleteConversation = (): void => {
    if (!deleteDialogConversationId) {
      return
    }

    extendDeleteConfirmGrace()
    const conversationId = deleteDialogConversationId
    closeDeleteDialog()
    deleteConversation(conversationId)
  }

  const requestDeleteConversation = (conversationId: string): void => {
    const now = Date.now()
    if (now <= deleteConfirmBypassUntilRef.current) {
      extendDeleteConfirmGrace()
      deleteConversation(conversationId)
      return
    }

    setDeleteDialogConversationId(conversationId)
  }

  const handleConversationPointerDown = (
    conversationId: string,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    resetConversationSwipe()
    event.currentTarget.setPointerCapture(event.pointerId)

    const pointerId = event.pointerId
    const longPressTimerId = window.setTimeout(() => {
      const gesture = conversationSwipeStartRef.current
      if (!gesture || gesture.conversationId !== conversationId || gesture.pointerId !== pointerId) {
        return
      }

      gesture.longPressTriggered = true
      gesture.thresholdReached = false
      clearConversationGestureTimer()
      ignoreNextConversationClickRef.current = conversationId
      setSwipingConversationId(null)
      setSwipeOffsetX(0)
      if (settings.deleteModeHapticsEnabled) {
        vibrateInteraction()
      }
      toggleDeleteMode()
    }, LONG_PRESS_DELETE_MODE_MS)

    conversationSwipeStartRef.current = {
      conversationId,
      pointerId,
      x: event.clientX,
      y: event.clientY,
      thresholdReached: false,
      longPressTriggered: false,
      longPressTimerId,
    }
  }

  const handleConversationPointerMove = (
    conversationId: string,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const started = conversationSwipeStartRef.current
    if (!started || started.conversationId !== conversationId || started.pointerId !== event.pointerId) {
      return
    }

    if (started.longPressTriggered) {
      return
    }

    const deltaX = event.clientX - started.x
    const deltaY = event.clientY - started.y
    const movedBeyondLongPressTolerance =
      Math.abs(deltaX) > LONG_PRESS_MOVE_TOLERANCE_PX || Math.abs(deltaY) > LONG_PRESS_MOVE_TOLERANCE_PX

    if (movedBeyondLongPressTolerance) {
      clearConversationGestureTimer()
    }

    const horizontalDominant = Math.abs(deltaX) > Math.abs(deltaY) * 1.1
    if (!horizontalDominant) {
      if (swipingConversationId === conversationId) {
        setSwipeOffsetX(0)
      }
      return
    }

    event.preventDefault()
    const nextOffset = clamp(deltaX, -SWIPE_DELETE_MAX_OFFSET_PX, SWIPE_DELETE_MAX_OFFSET_PX)
    const reachedThreshold = Math.abs(deltaX) >= SWIPE_DELETE_TOGGLE_THRESHOLD_PX

    if (settings.deleteModeHapticsEnabled && reachedThreshold && !started.thresholdReached) {
      vibrateInteraction()
    }

    started.thresholdReached = reachedThreshold
    setSwipingConversationId(conversationId)
    setSwipeOffsetX(nextOffset)
  }

  const handleConversationPointerUp = (
    conversationId: string,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    const started = conversationSwipeStartRef.current
    if (!started || started.conversationId !== conversationId || started.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    clearConversationGestureTimer()

    if (started.longPressTriggered) {
      ignoreNextConversationClickRef.current = conversationId
      resetConversationSwipe()
      return
    }

    const deltaX = event.clientX - started.x
    const deltaY = event.clientY - started.y
    const isSwipeDelete =
      Math.abs(deltaX) >= SWIPE_DELETE_TOGGLE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY) * 1.1

    if (isSwipeDelete) {
      ignoreNextConversationClickRef.current = conversationId
      toggleDeleteMode()
    }

    resetConversationSwipe()
  }

  const handleConversationPointerCancel = (): void => {
    resetConversationSwipe()
  }

  const handleConversationClick = (conversationId: string): void => {
    if (ignoreNextConversationClickRef.current === conversationId) {
      ignoreNextConversationClickRef.current = null
      return
    }
    switchConversation(conversationId)
  }

  const toggleConversationGroup = (groupId: string): void => {
    setCollapsedConversationGroups((previous) => ({
      ...previous,
      [groupId]: !previous[groupId],
    }))
  }

  const createNewConversation = (): void => {
    const existingPlaceholder = conversations.find((conversation) => isConversationPlaceholder(conversation))
    const nextConversation = existingPlaceholder ?? createConversation()

    if (!existingPlaceholder) {
      setConversations((previous) => [nextConversation, ...previous].slice(0, MAX_STORED_CONVERSATIONS))
    }

    setActiveConversationId(nextConversation.id)
    closeDrawer()
    closeModelMenu()
    setDeleteModeEnabled(false)
    setDeleteDialogConversationId(null)
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
  }

  const toggleReasoning = (messageId: string): void => {
    setOpenReasoningByMessage((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }))
  }

  const toggleSkillResult = (stepId: string): void => {
    setOpenSkillResultByStep((previous) => ({
      ...previous,
      [stepId]: !previous[stepId],
    }))
  }

  const focusTitleInput = useCallback((): void => {
    const input = titleInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const selectionEnd = input.value.length
    input.setSelectionRange(selectionEnd, selectionEnd)
  }, [])

  const beginRenameConversation = (): void => {
    if (!activeConversation || titleTransition || titleTransitionPrepRef.current) {
      return
    }

    const sourceTitleRect = snapshotRect(titleTextRef.current)
    const sourceTriggerRect = snapshotRect(titleRenameButtonRef.current)
    if (sourceTitleRect && sourceTriggerRect) {
      titleTransitionPrepRef.current = {
        phase: 'opening',
        titleText: activeConversation.title,
        sourceTitleRect,
        sourceTriggerRect,
      }
    }

    setTitleDraft(activeConversation.title)
    setIsEditingTitle(true)
  }

  const cancelRenameConversation = (): void => {
    if (!isEditingTitle || titleTransition || titleTransitionPrepRef.current) {
      return
    }

    const sourceTitleRect = snapshotRect(titleInputRef.current)
    const sourceTriggerRect = snapshotRect(titleActionsRef.current)
    if (sourceTitleRect && sourceTriggerRect) {
      titleTransitionPrepRef.current = {
        phase: 'closing',
        titleText: activeConversation?.title ?? titleDraft,
        sourceTitleRect,
        sourceTriggerRect,
      }
    }

    setIsEditingTitle(false)
    setTitleDraft('')
  }

  const saveRenameConversation = (): void => {
    if (!activeConversation || titleTransition || titleTransitionPrepRef.current) {
      return
    }
    const nextTitle = titleDraft.trim()
    if (!nextTitle) {
      pushNotice('对话标题不能为空。', 'error')
      return
    }

    const sourceTitleRect = snapshotRect(titleInputRef.current)
    const sourceTriggerRect = snapshotRect(titleActionsRef.current)
    if (sourceTitleRect && sourceTriggerRect) {
      titleTransitionPrepRef.current = {
        phase: 'closing',
        titleText: nextTitle,
        sourceTitleRect,
        sourceTriggerRect,
      }
    }

    updateConversationTitle(activeConversation.id, nextTitle, true)
    setIsEditingTitle(false)
    setTitleDraft('')
  }

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        if (!storageWarningShownRef.current) {
          storageWarningShownRef.current = true
          setNotice({ text: '本地存储空间不足，设置可能不会被完整保存。', type: 'error' })
        }
        console.warn('Failed to persist settings', error)
      }
    }, PERSIST_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [settings])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const serializableConversations = serializeConversationsForStorage(conversations)
        localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(serializableConversations))
      } catch (error) {
        if (!storageWarningShownRef.current) {
          storageWarningShownRef.current = true
          setNotice({ text: '图片较大，聊天记录无法完整持久化，但当前会话可继续使用。', type: 'error' })
        }
        console.warn('Failed to persist conversations', error)
      }
    }, PERSIST_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [conversations])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const serializableDrafts = serializeConversationDraftsForStorage(conversations, draftsByConversation)
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(serializableDrafts))
      } catch (error) {
        if (!storageWarningShownRef.current) {
          storageWarningShownRef.current = true
          setNotice({ text: '草稿保存失败，未发送内容可能无法完整恢复。', type: 'error' })
        }
        console.warn('Failed to persist drafts', error)
      }
    }, PERSIST_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [conversations, draftsByConversation])

  useEffect(() => {
    if (activeConversationId) {
      try {
        localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, activeConversationId)
      } catch (error) {
        console.warn('Failed to persist active conversation', error)
      }
    }
  }, [activeConversationId])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined
    }

    const root = document.documentElement
    root.style.setProperty('--native-top-inset', Capacitor.getPlatform() === 'android' ? '28px' : '0px')

    return () => {
      root.style.removeProperty('--native-top-inset')
    }
  }, [])

  useEffect(() => {
    void refreshExtensions()
  }, [refreshExtensions])

  useEffect(() => {
    if (!notice) {
      return undefined
    }
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    let isDisposed = false
    let listenerHandle: { remove: () => Promise<void> } | null = null

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (deleteDialogConversationId) {
        setDeleteDialogConversationId(null)
        return
      }
      if (modelMenuMounted) {
        closeModelMenu()
        return
      }
      if (settingsMounted) {
        handleSettingsBack()
        return
      }
      if (drawerMounted) {
        closeDrawer()
        return
      }
      if (canGoBack) {
        window.history.back()
        return
      }
      void CapacitorApp.exitApp()
    }).then((handle) => {
      if (isDisposed) {
        void handle.remove()
        return
      }
      listenerHandle = handle
    })

    return () => {
      isDisposed = true
      if (listenerHandle) {
        void listenerHandle.remove()
      }
    }
  }, [
    closeDrawer,
    closeModelMenu,
    deleteDialogConversationId,
    drawerMounted,
    handleSettingsBack,
    modelMenuMounted,
    settingsMounted,
  ])

  useLayoutEffect(() => {
    const prepared = titleTransitionPrepRef.current
    if (!prepared) {
      return
    }

    if (prepared.phase === 'opening') {
      const titleEndRect = snapshotRect(titleInputRef.current)
      const actionsEndRect = snapshotRect(titleActionsRef.current)

      if (!titleEndRect || !actionsEndRect) {
        titleTransitionPrepRef.current = null
        return
      }

      const offset = getTravelOffset(prepared.sourceTriggerRect, actionsEndRect)
      playTitleTransition({
        phase: 'opening',
        titleText: prepared.titleText,
        titleStartRect: prepared.sourceTitleRect,
        titleEndRect,
        penStartRect: prepared.sourceTriggerRect,
        penEndRect: shiftRect(prepared.sourceTriggerRect, offset.x, offset.y),
        actionsStartRect: shiftRect(actionsEndRect, -offset.x, -offset.y),
        actionsEndRect,
        playing: false,
      })
      titleTransitionPrepRef.current = null
      return
    }

    const titleEndRect = snapshotRect(titleTextRef.current)
    const penEndRect = snapshotRect(titleRenameButtonRef.current)
    if (!titleEndRect || !penEndRect) {
      titleTransitionPrepRef.current = null
      return
    }

    const offset = getTravelOffset(penEndRect, prepared.sourceTriggerRect)
    playTitleTransition({
      phase: 'closing',
      titleText: prepared.titleText,
      titleStartRect: prepared.sourceTitleRect,
      titleEndRect,
      penStartRect: shiftRect(penEndRect, offset.x, offset.y),
      penEndRect,
      actionsStartRect: prepared.sourceTriggerRect,
      actionsEndRect: shiftRect(prepared.sourceTriggerRect, -offset.x, -offset.y),
      playing: false,
    })
    titleTransitionPrepRef.current = null
  }, [isEditingTitle, activeConversation?.id, activeConversation?.title, playTitleTransition])

  useEffect(() => {
    if (!isEditingTitle || titleTransition || titleTransitionPrepRef.current) {
      return
    }
    focusTitleInput()
  }, [focusTitleInput, isEditingTitle, titleTransition, activeConversationId])

  useEffect(
    () => () => {
      clearTitleTransitionTimers()
    },
    [clearTitleTransitionTimers],
  )

  useEffect(
    () => () => {
      clearMessageListInteractionTimer()
    },
    [clearMessageListInteractionTimer],
  )

  useEffect(() => {
    pendingMessageListBottomResetRef.current = true
    clearMessageListInteractionTimer()
    messageListUserInteractingRef.current = false
    setIsAutoFollowEnabled(true)
  }, [activeConversationId, clearMessageListInteractionTimer])

  useLayoutEffect(() => {
    if (messageListUserInteractingRef.current) {
      return
    }

    if (pendingMessageListBottomResetRef.current) {
      scrollMessageListToBottom()
      pendingMessageListBottomResetRef.current = false
      return
    }

    if (!isAutoFollowEnabled) {
      return
    }

    scrollMessageListToBottom()
  }, [activeConversationId, activeMessages, isAutoFollowEnabled, isSending, scrollMessageListToBottom])

  useEffect(() => {
    if (conversations.length === 0) {
      const fallback = createConversation()
      setConversations([fallback])
      setActiveConversationId(fallback.id)
      return
    }

    if (!conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id)
    }
  }, [conversations, activeConversationId])

  useEffect(() => {
    if (!deleteDialogConversationId) {
      return
    }

    if (!conversations.some((conversation) => conversation.id === deleteDialogConversationId)) {
      setDeleteDialogConversationId(null)
    }
  }, [conversations, deleteDialogConversationId])

  useEffect(() => {
    setPendingImages([])
    cancelEdit()
    stopRenameConversationImmediately()
    closeModelMenu()
  }, [activeConversationId, closeModelMenu, stopRenameConversationImmediately])

  useEffect(() => {
    if (drawerMounted) {
      return
    }

    const gesture = conversationSwipeStartRef.current
    const longPressTimerId = gesture?.longPressTimerId ?? null
    if (longPressTimerId !== null) {
      window.clearTimeout(longPressTimerId)
    }
    conversationSwipeStartRef.current = null
    setSwipingConversationId(null)
    setSwipeOffsetX(0)
    setDeleteModeEnabled(false)
    setDeleteDialogConversationId(null)
  }, [drawerMounted])

  useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (!modelMenuRef.current) {
        return
      }
      const target = event.target as Node
      if (!modelMenuRef.current.contains(target)) {
        closeModelMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [closeModelMenu])

  useEffect(() => {
    setCollapsedConversationGroups((previous) => {
      let changed = false
      const next: Record<string, boolean> = {}

      for (const group of conversationGroups) {
        if (Object.prototype.hasOwnProperty.call(previous, group.id)) {
          next[group.id] = previous[group.id]
          continue
        }
        next[group.id] = false
        changed = true
      }

      const previousKeys = Object.keys(previous)
      const nextKeys = Object.keys(next)
      if (!changed && previousKeys.length === nextKeys.length) {
        let same = true
        for (const key of nextKeys) {
          if (previous[key] !== next[key]) {
            same = false
            break
          }
        }
        if (same) {
          return previous
        }
      }

      return next
    })
  }, [conversationGroups])

  useEffect(() => {
    hasAutoCollapsedConversationGroupsRef.current = false
  }, [settings.autoCollapseConversations])

  useLayoutEffect(() => {
    if (!settingsVisible) {
      return
    }

    const settingsPage = settingsPageRef.current
    if (!settingsPage) {
      return
    }

    const nextScrollTop = settingsScrollByViewRef.current[settingsView] ?? 0
    const frameId = window.requestAnimationFrame(() => {
      if (settingsPageRef.current === settingsPage) {
        settingsPage.scrollTop = nextScrollTop
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [settingsView, settingsVisible])

  useLayoutEffect(() => {
    if (!drawerVisible) {
      return
    }

    const conversationList = conversationListRef.current
    if (!conversationList) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (conversationListRef.current === conversationList) {
        conversationList.scrollTop = drawerScrollTopRef.current
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [drawerVisible])

  useEffect(() => {
    if (!drawerVisible || !settings.autoCollapseConversations || hasAutoCollapsedConversationGroupsRef.current) {
      return
    }

    const conversationList = conversationListRef.current
    if (!conversationList) {
      return
    }

    let secondFrameId = 0
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const listRect = conversationList.getBoundingClientRect()
        const nextCollapsedByGroup: Record<string, boolean> = {}

        for (const group of conversationGroups) {
          const groupElement = conversationGroupElementRefs.current[group.id]
          if (!groupElement) {
            nextCollapsedByGroup[group.id] = false
            continue
          }

          const itemElements = Array.from(
            groupElement.querySelectorAll<HTMLElement>('[data-conversation-item="true"]'),
          )
          const hasFullyVisibleItem = itemElements.some((itemElement) => {
            const itemRect = itemElement.getBoundingClientRect()
            return itemRect.top >= listRect.top && itemRect.bottom <= listRect.bottom
          })
          nextCollapsedByGroup[group.id] = !hasFullyVisibleItem
        }

        hasAutoCollapsedConversationGroupsRef.current = true
        setCollapsedConversationGroups((previous) => {
          let changed = false
          const next: Record<string, boolean> = {}

          for (const group of conversationGroups) {
            const nextValue = nextCollapsedByGroup[group.id] ?? false
            next[group.id] = nextValue
            if (previous[group.id] !== nextValue) {
              changed = true
            }
          }

          return changed ? next : previous
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      if (secondFrameId !== 0) {
        window.cancelAnimationFrame(secondFrameId)
      }
    }
  }, [conversationGroups, drawerVisible, settings.autoCollapseConversations])

  const renderComposerTools = (className = 'composer-tools') => (
    <div className={className}>
      <div className="model-picker composer-model-picker" ref={modelMenuRef}>
        <button
          type="button"
          className="model-trigger composer-model-trigger"
          onClick={() =>
            modelMenuVisible ? closeModelMenu() : openModelMenu()
          }
        >
          <span>{settings.currentModel || '选择模型'}</span>
          <span className={`arrow ${modelMenuVisible ? 'open' : ''}`}>▾</span>
        </button>

        {modelMenuMounted ? (
          <div
            className={`model-popover composer-model-popover ${modelMenuVisible ? 'is-open' : 'is-closing'}`}
          >
            {models.length === 0 ? (
              <div className="model-popover-empty">
                <p>暂无模型</p>
                <button
                  type="button"
                  className="tiny-button"
                  onClick={() => {
                    closeModelMenu()
                    openSettingsHome()
                  }}
                >
                  去设置
                </button>
              </div>
            ) : (
              models.map((model) => (
                <button
                  key={model}
                  type="button"
                  className={`model-option ${settings.currentModel === model ? 'active' : ''}`}
                  onClick={() => {
                    updateSetting('currentModel', model)
                    closeModelMenu()
                  }}
                >
                  {model}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="icon-button"
        aria-label="选择图片"
        onClick={() => fileInputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm1.5 0v9.23l2.62-2.63a1.5 1.5 0 0 1 2.12 0l2.09 2.1 2.62-2.63a1.5 1.5 0 0 1 2.12 0L18.5 13V5.5h-13Zm0 13h13v-3.38l-2.44-2.44-2.62 2.63a1.5 1.5 0 0 1-2.12 0l-2.1-2.1-3.72 3.72V18.5Zm4.25-9.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <button
        type="button"
        className="icon-button"
        aria-label="拍照"
        onClick={() => cameraInputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7.5 5.5 8.6 4a1.5 1.5 0 0 1 1.22-.63h4.36c.48 0 .94.23 1.22.63l1.1 1.5H19A2.5 2.5 0 0 1 21.5 8v9A2.5 2.5 0 0 1 19 19.5H5A2.5 2.5 0 0 1 2.5 17V8A2.5 2.5 0 0 1 5 5.5h2.5Zm4.5 2.25a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5Zm0 1.5a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  )

  const renderMainSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">接口配置</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <label className="field">
          <span>API Base URL</span>
          <ChatInputBox
            className="settings-chat-input"
            value={settings.apiBaseUrl}
            onChange={(event) => updateSetting('apiBaseUrl', event.target.value)}
            placeholder="https://api.example.com/v1"
            maxHeight={220}
          />
        </label>

        <label className="field">
          <span>API Key</span>
          <ChatInputBox
            className="settings-chat-input"
            value={settings.apiKey}
            onChange={(event) => updateSetting('apiKey', event.target.value.replace(/\r?\n/g, ''))}
            placeholder="sk-..."
            maxHeight={64}
            style={{ WebkitTextSecurity: 'disc' } as CSSProperties}
          />
        </label>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">模型设置</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="model-tools">
          <button type="button" onClick={() => void fetchModels()} disabled={isFetchingModels}>
            {isFetchingModels ? '加载中...' : '拉取模型列表'}
          </button>
        </div>

        <div className="model-add-row">
          <ChatInputBox
            className="settings-chat-input"
            value={manualModel}
            onChange={(event) => setManualModel(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key !== 'Enter' || event.shiftKey) {
                return
              }
              event.preventDefault()
              addManualModel()
            }}
            placeholder="手动添加模型，例如 gpt-4o-mini"
            maxHeight={140}
          />
          <button type="button" onClick={addManualModel}>
            添加
          </button>
        </div>

        <div className="model-list">
          {models.length === 0 ? (
            <p className="summary-muted">暂无模型，请先拉取或手动添加。</p>
          ) : (
            models.map((modelId) => (
              <div
                key={modelId}
                className={`model-row ${settings.currentModel === modelId ? 'active' : ''}`}
                onClick={() => updateSetting('currentModel', modelId)}
              >
                <span className="model-row-label">{modelId}</span>
                <button
                  type="button"
                  className={`model-health-button model-${modelHealth[modelId] ?? 'untested'}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void testModel(modelId)
                  }}
                  disabled={modelHealth[modelId] === 'testing'}
                >
                  {modelHealthLabel(modelHealth[modelId])}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">提示词</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-prompt-panels">
          <section
            className={`reasoning-panel settings-prompt-panel ${
              openPromptEditors.systemPrompt ? 'is-open' : ''
            }`}
          >
            <button
              type="button"
              className="reasoning-toggle"
              onClick={() => togglePromptEditor('systemPrompt')}
            >
              <span>系统提示词</span>
              <span className={`arrow ${openPromptEditors.systemPrompt ? 'open' : ''}`}>▾</span>
            </button>
            <div className="reasoning-body">
              <div className="settings-prompt-content">
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-card settings-prompt-input"
                  radiusMode="card"
                  value={settings.systemPrompt}
                  onChange={(event) => updateSetting('systemPrompt', event.target.value)}
                  placeholder="你可以在此配置系统提示词"
                  maxHeight={420}
                />
              </div>
            </div>
          </section>

          <section
            className={`reasoning-panel settings-prompt-panel ${
              openPromptEditors.skillCallSystemPrompt ? 'is-open' : ''
            }`}
          >
            <button
              type="button"
              className="reasoning-toggle"
              onClick={() => togglePromptEditor('skillCallSystemPrompt')}
            >
              <span>Skill Call 系统提示词</span>
              <span className={`arrow ${openPromptEditors.skillCallSystemPrompt ? 'open' : ''}`}>▾</span>
            </button>
            <div className="reasoning-body">
              <div className="settings-prompt-content">
                <ChatInputBox
                  className="settings-chat-input settings-chat-input-card settings-prompt-input"
                  radiusMode="card"
                  value={settings.skillCallSystemPrompt}
                  onChange={(event) => updateSetting('skillCallSystemPrompt', event.target.value)}
                  maxHeight={420}
                />
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">生成参数</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Temperature (0-2)</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.temperature}
              inputMode="decimal"
              placeholder={String(DEFAULT_SETTINGS.temperature)}
              onChange={(event) =>
                handleNumericSettingChange('temperature', event.target.value, 0, 2)
              }
              onBlur={() => finalizeNumericSettingDraft('temperature')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Top P (0-1)</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.topP}
              inputMode="decimal"
              placeholder={String(DEFAULT_SETTINGS.topP)}
              onChange={(event) => handleNumericSettingChange('topP', event.target.value, 0, 1)}
              onBlur={() => finalizeNumericSettingDraft('topP')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Max Tokens</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.maxTokens}
              inputMode="numeric"
              placeholder={String(DEFAULT_SETTINGS.maxTokens)}
              onChange={(event) =>
                handleNumericSettingChange('maxTokens', event.target.value, 1, 8192, true)
              }
              onBlur={() => finalizeNumericSettingDraft('maxTokens')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Presence Penalty (-2~2)</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.presencePenalty}
              inputMode="decimal"
              placeholder={String(DEFAULT_SETTINGS.presencePenalty)}
              onChange={(event) =>
                handleNumericSettingChange('presencePenalty', event.target.value, -2, 2)
              }
              onBlur={() => finalizeNumericSettingDraft('presencePenalty')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Frequency Penalty (-2~2)</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.frequencyPenalty}
              inputMode="decimal"
              placeholder={String(DEFAULT_SETTINGS.frequencyPenalty)}
              onChange={(event) =>
                handleNumericSettingChange('frequencyPenalty', event.target.value, -2, 2)
              }
              onBlur={() => finalizeNumericSettingDraft('frequencyPenalty')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>模型错误最大重试次数</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.maxModelRetryCount}
              inputMode="numeric"
              placeholder={String(DEFAULT_SETTINGS.maxModelRetryCount)}
              onChange={(event) =>
                handleNumericSettingChange('maxModelRetryCount', event.target.value, 0, 10, true)
              }
              onBlur={() => finalizeNumericSettingDraft('maxModelRetryCount')}
              maxHeight={140}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">扩展能力</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          <button
            type="button"
            className="settings-entry-button"
            onClick={() => navigateSettingsView('skills')}
          >
            <span className="settings-entry-title">Skills 管理</span>
            <span className="settings-entry-meta">
              {isLoadingExtensions
                ? '加载中...'
                : `已发现 ${skillRecords.length} 个 skill，启用 ${
                    skillRecords.filter((skill) => skill.enabled).length
                  } 个`}
            </span>
          </button>

          <button
            type="button"
            className="settings-entry-button"
            onClick={() => navigateSettingsView('runtimes')}
          >
            <span className="settings-entry-title">运行时设置</span>
            <span className="settings-entry-meta">
              {isLoadingExtensions
                ? '加载中...'
                : nativeRuntimeAvailable
                  ? `已发现 ${runtimeRecords.length} 个运行时`
                  : '当前平台不支持直接执行外部运行时'}
            </span>
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">对话管理</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>删对话免提醒时长（秒）</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.deleteConfirmGraceSeconds}
              inputMode="numeric"
              placeholder={String(DEFAULT_SETTINGS.deleteConfirmGraceSeconds)}
              onChange={(event) =>
                handleNumericSettingChange(
                  'deleteConfirmGraceSeconds',
                  event.target.value,
                  0,
                  600,
                  true,
                )
              }
              onBlur={() => finalizeNumericSettingDraft('deleteConfirmGraceSeconds')}
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>对话分组时间间隔（分钟）</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={numericSettingDrafts.conversationGroupGapMinutes}
              inputMode="numeric"
              placeholder={String(DEFAULT_SETTINGS.conversationGroupGapMinutes)}
              onChange={(event) =>
                handleNumericSettingChange(
                  'conversationGroupGapMinutes',
                  event.target.value,
                  0,
                  120,
                  true,
                )
              }
              onBlur={() => finalizeNumericSettingDraft('conversationGroupGapMinutes')}
              maxHeight={140}
            />
          </label>

          <label className="toggle-row">
            <span>自动折叠对话</span>
            <input
              className="toggle-switch"
              type="checkbox"
              checked={settings.autoCollapseConversations}
              onChange={(event) => updateSetting('autoCollapseConversations', event.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">显示选项</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <label className="field">
          <span>空白页统计最少对话数</span>
          <ChatInputBox
            className="settings-chat-input settings-chat-input-compact"
            value={numericSettingDrafts.emptyStateStatsMinConversations}
            inputMode="numeric"
            placeholder={String(DEFAULT_SETTINGS.emptyStateStatsMinConversations)}
            onChange={(event) =>
              handleNumericSettingChange(
                'emptyStateStatsMinConversations',
                event.target.value,
                0,
                MAX_STORED_CONVERSATIONS,
                true,
              )
            }
            onBlur={() => finalizeNumericSettingDraft('emptyStateStatsMinConversations')}
            maxHeight={140}
          />
        </label>

        <label className="toggle-row">
          <span>显示思考过程</span>
          <input
            className="toggle-switch"
            type="checkbox"
            checked={settings.showReasoning}
            onChange={(event) => updateSetting('showReasoning', event.target.checked)}
          />
        </label>

        <label className="toggle-row">
          <span>删除模式振动</span>
          <input
            className="toggle-switch"
            type="checkbox"
            checked={settings.deleteModeHapticsEnabled}
            onChange={(event) => updateSetting('deleteModeHapticsEnabled', event.target.checked)}
          />
        </label>

        <label className="toggle-row">
          <span>首 Token 振动</span>
          <input
            className="toggle-switch"
            type="checkbox"
            checked={settings.firstTokenHapticsEnabled}
            onChange={(event) => updateSetting('firstTokenHapticsEnabled', event.target.checked)}
          />
        </label>
      </section>
    </>
  )

  const renderSkillsSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">Skill 包管理</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="model-tools">
          <button
            type="button"
            onClick={() => skillArchiveInputRef.current?.click()}
            disabled={isInstallingSkillArchive}
          >
            {isInstallingSkillArchive ? '安装中...' : '安装 / 更新 Skill ZIP'}
          </button>
          <button type="button" onClick={() => void refreshExtensions(true)}>
            刷新
          </button>
        </div>

      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">已安装 Skills</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entity-list">
          {isLoadingExtensions ? (
            <p className="summary-muted">正在加载 skills...</p>
          ) : skillRecords.length === 0 ? (
            <p className="summary-muted">暂无可用 skill。</p>
          ) : (
            skillRecords.map((skill) => (
              <article key={skill.id} className="settings-entity-card">
                <div className="settings-entity-main">
                  <div className="settings-entity-title-row">
                    <strong>{skill.frontmatter.name || skill.id}</strong>
                    <div className="summary-bar">
                      <span>{skill.id}</span>
                      <span>{skill.source === 'builtin' ? '内置' : '外部'}</span>
                      <span>{skill.frontmatter.version ? `v${skill.frontmatter.version}` : '未标版本'}</span>
                      {skill.overrideBuiltin ? <span>覆盖内置</span> : null}
                    </div>
                  </div>

                  <p className="summary-muted">{skill.frontmatter.description}</p>
                </div>

                <div className="settings-entity-actions">
                  <label className="toggle-row settings-inline-toggle">
                    <span>启用</span>
                    <input
                      className="toggle-switch"
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(event) =>
                        void handleSetSkillEnabled(skill.id, event.target.checked)
                      }
                    />
                  </label>

                  <div className="settings-inline-buttons">
                    <button
                      type="button"
                      className="tiny-button"
                      onClick={() => void openSkillConfigEditor(skill.id)}
                    >
                      配置
                    </button>
                    <button
                      type="button"
                      className="tiny-button danger-button"
                      onClick={() => void handleDeleteSkill(skill.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  )

  const renderSkillConfigSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">当前 Skill</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {skillConfigTarget ? (
          <div className="settings-entry-list">
            <div className="settings-static-card">
              <div className="settings-entry-title">{skillConfigTarget.frontmatter.name || skillConfigTarget.id}</div>
              <div className="summary-bar">
                <span>{skillConfigTarget.id}</span>
                <span>{skillConfigTarget.source === 'builtin' ? '内置' : '外部'}</span>
                <span>
                  {skillConfigTarget.frontmatter.version
                    ? `v${skillConfigTarget.frontmatter.version}`
                    : '未标版本'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="summary-muted">未找到目标 skill。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">可视化配置</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {isLoadingSkillConfig ? (
          <p className="summary-muted">正在读取配置...</p>
        ) : skillConfigTarget ? (
          <div className="skill-config-layout">
            <p className="summary-muted">
              已按当前 JSON 结构生成图形化编辑器，可新增字段、分组、数组元素，支持修改键名、类型和值。
            </p>

            {skillConfigRawError ? (
              <div className="settings-static-card skill-config-warning-card">
                <div className="settings-entry-title">原始 JSON 需要修复</div>
                <div className="settings-entry-meta">
                  当前图形界面展示的是最近一次合法配置。继续使用可视化编辑会覆盖当前无效的 JSON 文本。
                </div>
              </div>
            ) : null}

            <SkillConfigJsonEditor value={skillConfigValue} onChange={applySkillConfigValue} />
          </div>
        ) : (
          <p className="summary-muted">未找到目标 skill。</p>
        )}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">原始 JSON</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        {isLoadingSkillConfig ? (
          <p className="summary-muted">正在读取配置...</p>
        ) : skillConfigTarget ? (
          <>
            <label className="field field-system-prompt skill-config-raw-field">
              <span>编辑后保存，运行时会通过环境变量回传给 skill。文本框会按内容自动调整高度。</span>
              <ChatInputBox
                className="settings-code-editor settings-chat-input settings-chat-input-card settings-chat-input-code skill-config-raw-editor"
                radiusMode="card"
                value={skillConfigDraft}
                onChange={(event) => handleSkillConfigDraftChange(event.target.value)}
                placeholder={'{\n  "enabled": true\n}'}
                spellCheck={false}
                maxHeight={Math.max(420, Math.round(window.innerHeight * 0.62))}
              />
            </label>

            {skillConfigRawError ? (
              <p className="json-editor-error skill-config-raw-error">{skillConfigRawError}</p>
            ) : null}

            <div className="model-tools">
              <button type="button" onClick={formatSkillConfigDraft}>
                格式化 JSON
              </button>
              <button
                type="button"
                onClick={() => void saveSkillConfig()}
                disabled={isSavingSkillConfig || Boolean(skillConfigRawError)}
              >
                {isSavingSkillConfig ? '保存中...' : '保存配置'}
              </button>
            </div>
          </>
        ) : (
          <p className="summary-muted">未找到目标 skill。</p>
        )}
      </section>
    </>
  )

  const renderRuntimeSettings = () => (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">运行时包管理</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="model-tools">
          <button
            type="button"
            onClick={() => runtimeArchiveInputRef.current?.click()}
            disabled={isInstallingRuntimeArchive}
          >
            {isInstallingRuntimeArchive ? '安装中...' : '安装 Python / Node ZIP'}
          </button>
          <button type="button" onClick={() => void refreshExtensions(true)}>
            刷新
          </button>
        </div>

      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">已安装运行时</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entity-list">
          {isLoadingExtensions ? (
            <p className="summary-muted">正在加载运行时...</p>
          ) : runtimeRecords.length === 0 ? (
            <p className="summary-muted">尚未安装运行时。</p>
          ) : (
            runtimeRecords.map((runtime) => (
              <article key={runtime.id} className="settings-entity-card">
                <div className="settings-entity-main">
                  <div className="settings-entity-title-row">
                    <strong>{runtime.displayName || runtime.id}</strong>
                    <div className="summary-bar">
                      <span>{runtime.id}</span>
                      <span>{runtime.type}</span>
                      <span>{runtime.version || '未知版本'}</span>
                      {runtime.isDefault ? <span>默认</span> : null}
                    </div>
                  </div>

                  <p className="summary-muted">
                    {runtime.executablePath
                      ? `执行入口：${runtime.executablePath}`
                      : '未识别到可执行入口'}
                  </p>

                  {runtime.testMessage ? (
                    <p className="summary-muted">检测结果：{runtime.testMessage}</p>
                  ) : null}
                </div>

                <div className="settings-entity-actions">
                  <label className="toggle-row settings-inline-toggle">
                    <span>启用</span>
                    <input
                      className="toggle-switch"
                      type="checkbox"
                      checked={runtime.enabled}
                      onChange={(event) =>
                        void handleSetRuntimeEnabled(runtime.id, event.target.checked)
                      }
                    />
                  </label>

                  <div className="settings-inline-buttons">
                    <button
                      type="button"
                      className="tiny-button"
                      onClick={() => void handleTestRuntime(runtime.id)}
                    >
                      检测
                    </button>
                    {runtime.type === 'python' || runtime.type === 'node' ? (
                      <button
                        type="button"
                        className="tiny-button"
                        onClick={() => void handleSetDefaultRuntime(runtime)}
                      >
                        设为默认
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="tiny-button danger-button"
                      onClick={() => void handleDeleteRuntime(runtime.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  )

  const renderSettingsPage = () => {
    const title =
      settingsView === 'skills'
        ? 'Skills 管理'
        : settingsView === 'skill-config'
          ? 'Skill 配置'
          : settingsView === 'runtimes'
            ? '运行时设置'
            : 'Chatroom 设置'

    const showBack = settingsView !== 'main'
    const settingsContent =
      settingsView === 'main'
        ? renderMainSettings()
        : settingsView === 'skills'
          ? renderSkillsSettings()
          : settingsView === 'skill-config'
            ? renderSkillConfigSettings()
            : renderRuntimeSettings()

    return (
      <section
        ref={settingsPageRef}
        className="settings-page"
        onScroll={(event) => {
          settingsScrollByViewRef.current[settingsView] = event.currentTarget.scrollTop
        }}
      >
        <div className="settings-header">
          <h2>{title}</h2>
          <button type="button" className="ghost-button" onClick={showBack ? handleSettingsBack : closeSettingsPanel}>
            {showBack ? '返回' : '关闭'}
          </button>
        </div>

        <div key={settingsView} className="settings-view-content">
          {settingsContent}
        </div>
      </section>
    )
  }

  return (
    <div className="app-shell">
      {titleTransition ? (
        <div className="title-transition-layer" aria-hidden="true">
          <div
            className={`title-transition-title ${titleTransition.phase} ${
              titleTransition.playing ? 'is-playing' : ''
            }`}
            style={
              {
                '--title-start-left': `${titleTransition.titleStartRect.left}px`,
                '--title-start-top': `${titleTransition.titleStartRect.top}px`,
                '--title-start-width': `${titleTransition.titleStartRect.width}px`,
                '--title-start-height': `${titleTransition.titleStartRect.height}px`,
                '--title-end-left': `${titleTransition.titleEndRect.left}px`,
                '--title-end-top': `${titleTransition.titleEndRect.top}px`,
                '--title-end-width': `${titleTransition.titleEndRect.width}px`,
                '--title-end-height': `${titleTransition.titleEndRect.height}px`,
              } as CSSProperties
            }
          >
            {titleTransition.titleText}
          </div>

          <div
            className={`title-transition-pen ${titleTransition.playing ? 'is-playing' : ''}`}
            style={
              {
                '--pen-start-left': `${titleTransition.penStartRect.left}px`,
                '--pen-start-top': `${titleTransition.penStartRect.top}px`,
                '--pen-start-width': `${titleTransition.penStartRect.width}px`,
                '--pen-start-height': `${titleTransition.penStartRect.height}px`,
                '--pen-end-left': `${titleTransition.penEndRect.left}px`,
                '--pen-end-top': `${titleTransition.penEndRect.top}px`,
                '--pen-end-width': `${titleTransition.penEndRect.width}px`,
                '--pen-end-height': `${titleTransition.penEndRect.height}px`,
                '--pen-start-opacity': titleTransition.phase === 'opening' ? 1 : 0,
                '--pen-end-opacity': titleTransition.phase === 'opening' ? 0 : 1,
              } as CSSProperties
            }
          >
            ✎
          </div>

          <div
            className={`title-transition-actions ${titleTransition.playing ? 'is-playing' : ''}`}
            style={
              {
                '--actions-start-left': `${titleTransition.actionsStartRect.left}px`,
                '--actions-start-top': `${titleTransition.actionsStartRect.top}px`,
                '--actions-start-width': `${titleTransition.actionsStartRect.width}px`,
                '--actions-start-height': `${titleTransition.actionsStartRect.height}px`,
                '--actions-end-left': `${titleTransition.actionsEndRect.left}px`,
                '--actions-end-top': `${titleTransition.actionsEndRect.top}px`,
                '--actions-end-width': `${titleTransition.actionsEndRect.width}px`,
                '--actions-end-height': `${titleTransition.actionsEndRect.height}px`,
                '--actions-start-opacity': titleTransition.phase === 'opening' ? 0 : 1,
                '--actions-end-opacity': titleTransition.phase === 'opening' ? 1 : 0,
              } as CSSProperties
            }
          >
            <span className="title-transition-button title-save-button">保存</span>
            <span className="title-transition-button title-cancel-button">取消</span>
          </div>
        </div>
      ) : null}

      <header className="app-header">
        <div className={`header-card ${isEditingTitle ? 'is-editing-title' : ''}`}>
          <button
            type="button"
            className="menu-button"
            aria-label="打开会话菜单"
            onClick={openDrawer}
          >
            <span />
            <span />
            <span />
          </button>

          <div className={`header-center ${isEditingTitle ? 'is-editing' : ''}`}>
            {isEditingTitle && activeConversation ? (
              <div className={`title-editor ${titleTransition ? 'is-hidden' : ''}`}>
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveRenameConversation()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelRenameConversation()
                    }
                  }}
                />
                <div ref={titleActionsRef} className="title-actions">
                  <button
                    type="button"
                    className="tiny-button title-save-button"
                    onClick={saveRenameConversation}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="tiny-button title-cancel-button"
                    onClick={cancelRenameConversation}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className={`title-display ${titleTransition ? 'is-hidden' : ''}`}>
                <span ref={titleTextRef} className="title-text">
                  {activeConversation?.title ?? 'Chatroom'}
                </span>
                <button
                  ref={titleRenameButtonRef}
                  type="button"
                  className="icon-inline-button title-rename-button"
                  aria-label="编辑对话名"
                  onClick={beginRenameConversation}
                >
                  ✎
                </button>
              </div>
            )}
          </div>

          <div className="header-spacer" />
        </div>
      </header>

      {notice ? <div className={`notice notice-${notice.type}`}>{notice.text}</div> : null}

      <section className="summary-bar">
        <span>轮次 {rounds}</span>
        <span>输入Token {numberFormatter.format(tokenSummary.promptTokens)}</span>
        <span>输出Token {numberFormatter.format(tokenSummary.completionTokens)}</span>
        <span>总Token {numberFormatter.format(tokenSummary.totalTokens)}</span>
        {tokenSummary.estimatedCount > 0 ? (
          <span className="summary-muted">含 {tokenSummary.estimatedCount} 条估算</span>
        ) : null}
      </section>

      <main
        key={activeConversationId}
        ref={messageListRef}
        className="message-list page-transition"
        onScroll={handleMessageListScroll}
        onPointerDownCapture={handleMessageListPointerDownCapture}
        onPointerUpCapture={handleMessageListPointerUpCapture}
        onPointerCancelCapture={handleMessageListPointerCancelCapture}
        onWheelCapture={handleMessageListWheelCapture}
      >
        {activeMessages.length === 0 ? (
          <section className="empty-state">
            <h2>Chatroom</h2>
            <p className="empty-state-line empty-state-intro">
              我是<span className="empty-state-nowrap">ChatroomAI</span>！
              <wbr />
              欢迎找我聊天呀<span className="empty-state-emoticon">ʕ˶'༥'˶ʔ♡</span>
            </p>

            {emptyStateStats.shouldShowMiddleSection ? (
              <>
                <div className="empty-state-divider" aria-hidden="true" />

                <div className="empty-state-body">
                  <p className="empty-state-line">
                    在过去的
                    <span className="empty-state-nowrap">
                      {emptyStateStats.daysSinceFirstConversation}天
                    </span>
                    里，
                    <wbr />
                    我们曾经有过
                    <span className="empty-state-nowrap">
                      {numberFormatter.format(emptyStateStats.totalConversationCount)}次对话
                    </span>
                    ，
                    <wbr />
                    你发送过
                    <span className="empty-state-nowrap">
                      {numberFormatter.format(emptyStateStats.totalPhotoCount)}张照片
                    </span>
                    ，
                    <wbr />
                    我们一起消耗了
                    <span className="empty-state-nowrap">
                      {formatTokenLabel(emptyStateStats.totalTokenCount)}
                    </span>
                    <span className="empty-state-emoticon">(՞˶･֊･˶՞)</span>
                  </p>

                  {emptyStateStats.earliestTimeRecord ? (
                    <p className="empty-state-line">
                      最早的时候，
                      <wbr />
                      你从
                      <span className="empty-state-nowrap">
                        {formatClockTime(emptyStateStats.earliestTimeRecord.timestamp)}
                      </span>
                      就开始与我聊天了，
                      <wbr />
                      在
                      <span className="empty-state-nowrap">
                        {formatChatDayMonthDay(emptyStateStats.earliestTimeRecord.timestamp, true)}
                      </span>
                      <span className="empty-state-emoticon"> ε٩(๑&gt; ₃ &lt;)۶з</span>
                    </p>
                  ) : null}

                  {emptyStateStats.latestTimeRecord ? (
                    <p className="empty-state-line">
                      最晚的时候，
                      <wbr />
                      你在
                      <span className="empty-state-nowrap">
                        {formatClockTime(emptyStateStats.latestTimeRecord.timestamp)}时
                      </span>
                      还没有入睡，
                      <wbr />
                      在
                      <span className="empty-state-nowrap">
                        {formatChatDayMonthDay(emptyStateStats.latestTimeRecord.timestamp)}
                      </span>
                      ，
                      <wbr />
                      要注意身体哦<span className="empty-state-emoticon"> (๑• . •๑)</span>
                    </p>
                  ) : null}

                  {emptyStateStats.busiestDay ? (
                    <p className="empty-state-line">
                      聊的最多的一天，
                      <wbr />
                      我们有过
                      <span className="empty-state-nowrap">
                        {numberFormatter.format(emptyStateStats.busiestDay.rounds)}次对话
                      </span>
                      ，
                      <wbr />
                      一起消耗了
                      <span className="empty-state-nowrap">
                        {formatTokenLabel(emptyStateStats.busiestDay.tokens)}
                      </span>
                      ，
                      <wbr />
                      在
                      <span className="empty-state-nowrap">
                        {formatCalendarMonthDay(emptyStateStats.busiestDay.timestamp, true)}
                      </span>
                      <span className="empty-state-emoticon">(｡•ㅅ•｡)♡</span>
                    </p>
                  ) : null}
                </div>

                <div className="empty-state-divider" aria-hidden="true" />
              </>
            ) : (
              <div className="empty-state-divider" aria-hidden="true" />
            )}

            <p className="empty-state-line empty-state-outro">
              接下来，
              <wbr />
              让我来回答你的问题吧<span className="empty-state-emoticon">(´,,•ω•,,)♡</span>
            </p>
          </section>
        ) : null}

        {activeMessages.map((message) => {
          const editing = editingMessageId === message.id
          const textValue = message.text.trim()
          const hasReasoning = Boolean(message.reasoning?.trim())
          const skillSteps = message.skillSteps ?? []
          const skillRounds =
            (message.skillRounds?.length ?? 0) > 0
              ? message.skillRounds ?? []
              : skillSteps.length > 0
                ? [
                    {
                      id: `legacy-${message.id}`,
                      steps: skillSteps,
                    },
                  ]
                : []
          const hasSkillRounds = skillRounds.length > 0
          const isAssistantLoading =
            message.role === 'assistant' && !message.error && !textValue && !hasReasoning
          const displayText =
            textValue ||
            (message.role === 'assistant' && !isAssistantLoading ? '（模型未返回文本内容）' : '')
          const shouldRenderText =
            displayText.length > 0 || (message.role === 'user' && !(message.images?.length ?? 0))
          const hasFinalRoundContent =
            (settings.showReasoning && hasReasoning) || isAssistantLoading || shouldRenderText || Boolean(message.error)

          return (
            <article key={message.id} className={`message-card ${message.role}`}>
              <div className="message-meta">
                {message.role === 'user' ? (
                  <span>你</span>
                ) : (
                  <span className="message-model">{message.model ?? '未标记模型'}</span>
                )}
              </div>

              {!editing && message.images && message.images.length > 0 ? (
                <div className="image-grid">
                  {message.images.map((image) => (
                    <figure key={image.id} className="image-item">
                      <img src={image.dataUrl} alt={image.name} />
                    </figure>
                  ))}
                </div>
              ) : null}

              {editing ? (
                <div className="editor">
                  <textarea
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                  />
                  <div className="editor-actions">
                    {message.role === 'assistant' ? (
                      <>
                        <button type="button" className="tiny-button" onClick={saveAssistantEdit}>
                          保存
                        </button>
                        <button type="button" className="tiny-button ghost-button" onClick={cancelEdit}>
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="tiny-button" onClick={() => void saveUserEdit(false)}>
                          仅修改
                        </button>
                        <button type="button" className="tiny-button" onClick={() => void saveUserEdit(true)}>
                          修改并重发
                        </button>
                        <button type="button" className="tiny-button ghost-button" onClick={cancelEdit}>
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {hasSkillRounds ? (
                    <section className="skill-round-list">
                      {skillRounds.map((round, roundIndex) => (
                        <section key={round.id} className="skill-round-entry">
                          {roundIndex > 0 ? <div className="skill-round-divider" aria-hidden="true" /> : null}
                          {round.explanation ? (
                            <div className="markdown-content skill-round-explanation">
                              <MarkdownMessage text={round.explanation} />
                            </div>
                          ) : null}
                          {round.steps.length > 0 ? (
                            <div className="skill-step-list">
                              {round.steps.map((step) => {
                                const hasResult = Boolean(step.result?.trim())
                                const resultOpen = openSkillResultByStep[step.id] === true
                                const targetLabel = formatSkillStepTarget(step)

                                return (
                                  <div key={step.id} className="skill-step-entry">
                                    <div className={`skill-step-card is-${step.status}`}>
                                      <div className="skill-step-meta">
                                        <span className="skill-step-target" title={targetLabel}>
                                          {targetLabel}
                                        </span>
                                        <span className="skill-step-status">
                                          {formatSkillStepStatus(step.status)}
                                        </span>
                                      </div>
                                      {step.explanation ? (
                                        <div className="markdown-content skill-step-content">
                                          <MarkdownMessage text={step.explanation} />
                                        </div>
                                      ) : null}
                                      {hasResult ? (
                                        <section
                                          className={`skill-step-result-panel ${resultOpen ? 'is-open' : ''}`}
                                        >
                                          <button
                                            type="button"
                                            className="skill-step-result-toggle"
                                            onClick={() => toggleSkillResult(step.id)}
                                          >
                                            <span>返回信息</span>
                                            <span className={`arrow ${resultOpen ? 'open' : ''}`}>▾</span>
                                          </button>
                                          <div className="skill-step-result-body">
                                            <div className="markdown-content skill-step-result-content">
                                              <MarkdownMessage text={step.result ?? ''} />
                                            </div>
                                          </div>
                                        </section>
                                      ) : null}
                                      {step.error ? (
                                        <p className="message-error skill-step-error">{step.error}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}
                        </section>
                      ))}
                    </section>
                  ) : null}

                  {hasSkillRounds && hasFinalRoundContent ? (
                    <div className="skill-final-divider" aria-hidden="true" />
                  ) : null}

                  {settings.showReasoning && hasReasoning ? (
                    <section
                      className={`reasoning-panel ${openReasoningByMessage[message.id] ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="reasoning-toggle"
                        onClick={() => toggleReasoning(message.id)}
                      >
                        <span>思考过程</span>
                        <span className={`arrow ${openReasoningByMessage[message.id] ? 'open' : ''}`}>
                          ▾
                        </span>
                      </button>
                      <div className="reasoning-body">
                        <div className="markdown-content reasoning-content">
                          <MarkdownMessage text={message.reasoning ?? ''} />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {isAssistantLoading ? (
                    <div className="assistant-loading" aria-label="模型输出中">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {shouldRenderText ? (
                    <div className="markdown-content">
                      <MarkdownMessage text={displayText} />
                    </div>
                  ) : null}

                  {message.error ? <p className="message-error">{message.error}</p> : null}

                  {message.role === 'assistant' && message.usage ? (
                    <div className="metric-row">
                      {message.usageEstimated ? <span className="metric-tag">估算值</span> : null}
                      <span className="metric-tag">输入Token {message.usage.promptTokens}</span>
                      <span className="metric-tag">输出Token {message.usage.completionTokens}</span>
                      <span className="metric-tag">总Token {message.usage.totalTokens}</span>
                      {message.usage.reasoningTokens !== undefined ? (
                        <span className="metric-tag">思考Token {message.usage.reasoningTokens}</span>
                      ) : null}
                      <span className="metric-tag">
                        首Token延迟 {formatMs(message.firstTokenLatencyMs)}
                      </span>
                      <span className="metric-tag">总耗时 {formatMs(message.totalTimeMs)}</span>
                    </div>
                  ) : null}

                  <div className="message-actions">
                    <button type="button" onClick={() => void copyMessageText(message.text)}>
                      复制
                    </button>
                    <button type="button" onClick={() => beginEdit(message)}>
                      编辑
                    </button>
                    {message.role === 'assistant' ? (
                      <button type="button" onClick={() => void regenerate(message.id)}>
                        重试
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          )
        })}

        <div ref={messageEndRef} />
      </main>

      <footer className="composer">
        {pendingImages.length > 0 ? (
          <div className="pending-image-strip">
            {pendingImages.map((image) => (
              <div key={image.id} className="pending-image-item">
                <img src={image.dataUrl} alt={image.name} />
                <button type="button" onClick={() => removePendingImage(image.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer-panel">
          <div className="composer-row">
            <ChatInputBox
              ref={composerInputRef}
              className="chat-input-box composer-input"
              value={draft}
              onChange={(event) => {
                if (!activeConversation) {
                  return
                }
                updateConversationDraft(activeConversation.id, event.target.value)
              }}
              placeholder="输入消息"
              maxHeight={188}
            />

            {isSending ? (
              <button type="button" className="danger-button" onClick={stopGeneration}>
                停止
              </button>
            ) : (
              <button type="button" disabled={!canSend} onClick={() => void handleSend()}>
                发送
              </button>
            )}
          </div>

          {renderComposerTools()}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => void handleImageSelect(event)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => void handleImageSelect(event)}
        />
        <input
          ref={skillArchiveInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => void handleSkillArchiveSelect(event)}
        />
        <input
          ref={runtimeArchiveInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => void handleRuntimeArchiveSelect(event)}
        />
      </footer>

      {drawerMounted ? (
        <div
          className={`drawer-overlay ${drawerVisible ? 'is-open' : 'is-closing'}`}
          onClick={closeDrawer}
        >
          <aside className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <h2>Chatroom</h2>
            </div>

            <div
              ref={conversationListRef}
              className="conversation-list"
              onScroll={(event) => {
                drawerScrollTopRef.current = event.currentTarget.scrollTop
              }}
            >
              {conversationGroups.map((group) => {
                const collapsed = collapsedConversationGroups[group.id] ?? false
                return (
                  <section
                    key={group.id}
                    ref={(node) => {
                      conversationGroupElementRefs.current[group.id] = node
                    }}
                    className="conversation-group"
                  >
                    <div className="conversation-group-divider">
                      <span className="conversation-group-label">{dateFormatter.format(group.labelTime)}</span>
                      <span className="conversation-group-dash" aria-hidden="true" />
                      <button
                        type="button"
                        className="conversation-group-toggle"
                        aria-label={collapsed ? '展开分组' : '收起分组'}
                        onClick={() => toggleConversationGroup(group.id)}
                      >
                        <span className={`arrow ${collapsed ? '' : 'open'}`}>▾</span>
                      </button>
                    </div>

                    <div className={`conversation-group-content ${collapsed ? 'is-collapsed' : ''}`}>
                      <div className="conversation-group-content-inner">
                        {group.conversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className={`conversation-item-row ${deleteModeEnabled ? 'delete-mode' : ''}`}
                          >
                            <button
                              type="button"
                              data-conversation-item="true"
                              className={`conversation-item ${
                                conversation.id === activeConversationId ? 'active' : ''
                              } ${swipingConversationId === conversation.id ? 'is-swiping' : ''}`}
                              style={
                                swipingConversationId === conversation.id
                                  ? { transform: `translate3d(${swipeOffsetX}px, 0, 0)` }
                                  : undefined
                              }
                              onPointerDown={(event) => handleConversationPointerDown(conversation.id, event)}
                              onPointerMove={(event) => handleConversationPointerMove(conversation.id, event)}
                              onPointerUp={(event) => handleConversationPointerUp(conversation.id, event)}
                              onPointerCancel={handleConversationPointerCancel}
                              onClick={() => handleConversationClick(conversation.id)}
                            >
                              <span className="conversation-item-title">{conversation.title}</span>
                              <div className="conversation-item-times">
                                <span className="conversation-item-time">
                                  创建：{dateFormatter.format(conversation.createdAt)}
                                </span>
                                <span className="conversation-item-time">
                                  更新：{dateFormatter.format(conversation.updatedAt)}
                                </span>
                              </div>
                            </button>

                            <button
                              type="button"
                              className="conversation-delete-button"
                              aria-label={`删除 ${conversation.title}`}
                              onClick={() => requestDeleteConversation(conversation.id)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M9 3.75h6a1 1 0 0 1 .92.61l.46 1.14h3.12a.75.75 0 0 1 0 1.5h-1.03l-.77 11.04A2.25 2.25 0 0 1 15.46 20H8.54a2.25 2.25 0 0 1-2.24-1.96L5.53 7H4.5a.75.75 0 0 1 0-1.5h3.12l.46-1.14A1 1 0 0 1 9 3.75Zm.35 1.75-.4 1h6.1l-.4-1h-5.3ZM7.03 7l.77 10.94a.75.75 0 0 0 .74.66h6.92a.75.75 0 0 0 .74-.66L16.97 7H7.03Zm2.22 2.25a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Zm5.5 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V10a.75.75 0 0 1 .75-.75Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  closeDrawer()
                  openSettingsHome()
                }}
              >
                设置
              </button>
              <button type="button" onClick={createNewConversation}>
                新增对话
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {deleteDialogConversation ? (
        <div className="delete-dialog-overlay" onClick={closeDeleteDialog}>
          <section className="delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>删除提醒</h3>
            <p className="delete-dialog-text">确认删除「{deleteDialogConversation.title}」吗？</p>
            {settings.deleteConfirmGraceSeconds > 0 ? (
              <p className="delete-dialog-hint">
                确认后，{settings.deleteConfirmGraceSeconds} 秒内再次点击垃圾桶将不再提醒。
              </p>
            ) : null}
            <div className="delete-dialog-actions">
              <button type="button" className="ghost-button" onClick={closeDeleteDialog}>
                取消
              </button>
              <button type="button" className="danger-button" onClick={confirmDeleteConversation}>
                删除
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {settingsMounted ? (
        <div className={`settings-screen ${settingsVisible ? 'is-open' : 'is-closing'}`}>
          {renderSettingsPage()}
        </div>
      ) : null}
    </div>
  )
}

export default App
