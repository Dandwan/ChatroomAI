import {
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
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

interface ChatMessage {
  id: string
  role: Role
  text: string
  images?: ImageAttachment[]
  reasoning?: string
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

interface AppSettings {
  apiBaseUrl: string
  apiKey: string
  systemPrompt: string
  temperature: number
  topP: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  showReasoning: boolean
  models: string[]
  currentModel: string
}

interface Notice {
  type: 'success' | 'error' | 'info'
  text: string
}

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

interface StreamCallbacks {
  onContent: (chunk: string) => void
  onReasoning: (chunk: string) => void
}

interface LoadedChatState {
  conversations: Conversation[]
  activeConversationId: string
}

const SETTINGS_STORAGE_KEY = 'chatroom.settings.v1'
const LEGACY_MESSAGES_STORAGE_KEY = 'chatroom.messages.v1'
const CONVERSATIONS_STORAGE_KEY = 'chatroom.conversations.v2'
const ACTIVE_CONVERSATION_STORAGE_KEY = 'chatroom.active-conversation.v2'

const MAX_STORED_MESSAGES = 100
const MAX_STORED_CONVERSATIONS = 40

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: '',
  apiKey: '',
  systemPrompt: '',
  temperature: 0.7,
  topP: 1,
  maxTokens: 2048,
  presencePenalty: 0,
  frequencyPenalty: 0,
  showReasoning: true,
  models: [],
  currentModel: '',
}

const numberFormatter = new Intl.NumberFormat('zh-CN')
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

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

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '')

const buildApiUrl = (baseUrl: string, path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`
}

const authHeaders = (apiKey: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey.trim()}`,
})

const readStructuredText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (!Array.isArray(value)) {
    return ''
  }

  const chunks: string[] = []
  for (const part of value) {
    if (!isRecord(part)) {
      continue
    }

    if (typeof part.text === 'string') {
      chunks.push(part.text)
      continue
    }

    if (isRecord(part.delta) && typeof part.delta.text === 'string') {
      chunks.push(part.delta.text)
    }
  }

  return chunks.join('')
}

const normalizeUsage = (raw: unknown): TokenUsage | undefined => {
  if (!isRecord(raw)) {
    return undefined
  }

  const promptTokens = toFiniteNumber(raw.prompt_tokens)
  const completionTokens = toFiniteNumber(raw.completion_tokens)
  const totalTokensRaw = toFiniteNumber(raw.total_tokens)

  if (promptTokens === undefined && completionTokens === undefined && totalTokensRaw === undefined) {
    return undefined
  }

  const details = isRecord(raw.completion_tokens_details) ? raw.completion_tokens_details : undefined
  const reasoningTokens = details ? toFiniteNumber(details.reasoning_tokens) : undefined
  const safePrompt = Math.max(0, Math.round(promptTokens ?? 0))
  const safeCompletion = Math.max(0, Math.round(completionTokens ?? 0))
  const safeTotal = Math.max(0, Math.round(totalTokensRaw ?? safePrompt + safeCompletion))

  return {
    promptTokens: safePrompt,
    completionTokens: safeCompletion,
    totalTokens: safeTotal,
    reasoningTokens,
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
      return '未检测'
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

const readErrorMessage = async (response: Response): Promise<string> => {
  const fallback = `${response.status} ${response.statusText}`
  const bodyText = await response.text()
  if (!bodyText) {
    return fallback
  }

  try {
    const parsed = JSON.parse(bodyText) as unknown
    if (isRecord(parsed)) {
      const candidate = parsed.error
      if (isRecord(candidate) && typeof candidate.message === 'string') {
        return candidate.message
      }
      if (typeof parsed.message === 'string') {
        return parsed.message
      }
    }
  } catch {
    // Ignore JSON parse errors and fall through to raw text.
  }

  return bodyText.length > 240 ? `${bodyText.slice(0, 240)}...` : bodyText
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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('图片读取失败'))
      }
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })

const buildCompletionPayload = (
  settings: AppSettings,
  messages: ApiMessage[],
  stream: boolean,
  includeUsage: boolean,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    model: settings.currentModel,
    messages,
    temperature: settings.temperature,
    top_p: settings.topP,
    max_tokens: settings.maxTokens,
    presence_penalty: settings.presencePenalty,
    frequency_penalty: settings.frequencyPenalty,
    stream,
  }

  if (stream && includeUsage) {
    payload.stream_options = { include_usage: true }
  }

  return payload
}

const requestStreamCompletion = async (
  settings: AppSettings,
  messages: ApiMessage[],
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<CompletionResult> => {
  const startedAt = performance.now()
  const response = await fetch(buildApiUrl(settings.apiBaseUrl, '/chat/completions'), {
    method: 'POST',
    headers: authHeaders(settings.apiKey),
    body: JSON.stringify(buildCompletionPayload(settings, messages, true, true)),
    signal,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  if (!response.body) {
    throw new Error('当前 API 不支持流式输出。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''
  let content = ''
  let reasoning = ''
  let usage: TokenUsage | undefined
  let firstTokenAt: number | undefined
  let doneSignal = false

  while (!doneSignal) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const eventBlock of events) {
      const lines = eventBlock.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) {
          continue
        }

        const data = trimmed.slice(5).trim()
        if (!data) {
          continue
        }

        if (data === '[DONE]') {
          doneSignal = true
          break
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(data) as unknown
        } catch {
          continue
        }

        if (!isRecord(parsed)) {
          continue
        }

        const usageCandidate = normalizeUsage(parsed.usage)
        if (usageCandidate) {
          usage = usageCandidate
        }

        const choices = Array.isArray(parsed.choices) ? parsed.choices : []
        if (choices.length === 0 || !isRecord(choices[0])) {
          continue
        }

        const delta = isRecord(choices[0].delta) ? choices[0].delta : undefined
        if (!delta) {
          continue
        }

        const contentChunk = readStructuredText(delta.content)
        const reasoningChunk =
          readStructuredText(delta.reasoning_content) || readStructuredText(delta.reasoning)

        if ((contentChunk || reasoningChunk) && firstTokenAt === undefined) {
          firstTokenAt = performance.now()
        }

        if (contentChunk) {
          content += contentChunk
          callbacks.onContent(contentChunk)
        }

        if (reasoningChunk) {
          reasoning += reasoningChunk
          callbacks.onReasoning(reasoningChunk)
        }
      }
      if (doneSignal) {
        break
      }
    }
  }

  const totalTimeMs = performance.now() - startedAt
  return {
    text: content,
    reasoning,
    usage,
    firstTokenLatencyMs: firstTokenAt ? firstTokenAt - startedAt : totalTimeMs,
    totalTimeMs,
  }
}

const requestNonStreamCompletion = async (
  settings: AppSettings,
  messages: ApiMessage[],
  signal: AbortSignal,
): Promise<CompletionResult> => {
  const startedAt = performance.now()
  const response = await fetch(buildApiUrl(settings.apiBaseUrl, '/chat/completions'), {
    method: 'POST',
    headers: authHeaders(settings.apiKey),
    body: JSON.stringify(buildCompletionPayload(settings, messages, false, false)),
    signal,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const parsed = (await response.json()) as unknown
  if (!isRecord(parsed)) {
    throw new Error('API 返回数据格式异常。')
  }

  const choices = Array.isArray(parsed.choices) ? parsed.choices : []
  const firstChoice = choices.length > 0 && isRecord(choices[0]) ? choices[0] : undefined
  const message = firstChoice && isRecord(firstChoice.message) ? firstChoice.message : undefined

  const text = message ? readStructuredText(message.content) : ''
  const reasoning = message
    ? readStructuredText(message.reasoning_content) || readStructuredText(message.reasoning)
    : ''
  const usage = normalizeUsage(parsed.usage)

  const totalTimeMs = performance.now() - startedAt
  return {
    text,
    reasoning,
    usage,
    firstTokenLatencyMs: totalTimeMs,
    totalTimeMs,
  }
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

const withConversationMessages = (
  conversation: Conversation,
  messages: ChatMessage[],
): Conversation => {
  const trimmedMessages = messages.slice(-MAX_STORED_MESSAGES)
  const nextTitle = conversation.titleManuallyEdited
    ? conversation.title
    : deriveConversationTitle(trimmedMessages) ?? '新对话'
  return {
    ...conversation,
    title: nextTitle,
    messages: trimmedMessages,
    updatedAt: Date.now(),
  }
}

const createConversation = (messages: ChatMessage[] = []): Conversation => {
  const now = Date.now()
  const trimmedMessages = messages.slice(-MAX_STORED_MESSAGES)
  return {
    id: createId(),
    title: deriveConversationTitle(trimmedMessages) ?? '新对话',
    titleManuallyEdited: false,
    messages: trimmedMessages,
    createdAt: now,
    updatedAt: now,
  }
}

const serializeConversationsForStorage = (conversations: Conversation[]): Conversation[] =>
  conversations.slice(0, MAX_STORED_CONVERSATIONS).map((conversation) => ({
    ...conversation,
    // Base64 image data can easily exceed localStorage quota on mobile.
    messages: conversation.messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
      ...message,
      images: undefined,
    })),
  }))

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

    return {
      apiBaseUrl: typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : DEFAULT_SETTINGS.apiBaseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_SETTINGS.apiKey,
      systemPrompt:
        typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : DEFAULT_SETTINGS.systemPrompt,
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
      models,
      currentModel,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const loadChatState = (): LoadedChatState => {
  const emptyConversation = createConversation()

  if (typeof localStorage === 'undefined') {
    return {
      conversations: [emptyConversation],
      activeConversationId: emptyConversation.id,
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

        conversations.push(withConversationMessages(nextConversation, messages))
      }
    }

    if (conversations.length > 0) {
      const activeConversationId = localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)
      const activeId =
        activeConversationId && conversations.some((conversation) => conversation.id === activeConversationId)
          ? activeConversationId
          : conversations[0].id
      return {
        conversations: conversations.slice(0, MAX_STORED_CONVERSATIONS),
        activeConversationId: activeId,
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_MESSAGES_STORAGE_KEY)
    const legacyMessages = legacyRaw ? normalizeStoredMessages(JSON.parse(legacyRaw) as unknown) : []
    if (legacyMessages.length > 0) {
      const conversation = createConversation(legacyMessages)
      return { conversations: [conversation], activeConversationId: conversation.id }
    }
  } catch {
    // Fallback to default state below.
  }

  return { conversations: [emptyConversation], activeConversationId: emptyConversation.id }
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

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [conversations, setConversations] = useState<Conversation[]>(
    initialStateRef.current.conversations,
  )
  const [activeConversationId, setActiveConversationId] = useState<string>(
    initialStateRef.current.activeConversationId,
  )

  const [draft, setDraft] = useState('')
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [openReasoningByMessage, setOpenReasoningByMessage] = useState<Record<string, boolean>>({})
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const storageWarningShownRef = useRef(false)

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ??
      conversations[0] ??
      null,
    [conversations, activeConversationId],
  )
  const activeMessages = useMemo(() => activeConversation?.messages ?? [], [activeConversation])

  const sortedConversations = useMemo(
    () => [...conversations].sort((left, right) => right.updatedAt - left.updatedAt),
    [conversations],
  )

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

  const hasDraftText = draft.trim().length > 0
  const canSend = activeConversation !== null && (hasDraftText || pendingImages.length > 0) && !isSending
  const showExpandedComposer = hasDraftText || pendingImages.length > 0 || isSending

  const pushNotice = (text: string, type: Notice['type'] = 'info'): void => {
    setNotice({ text, type })
  }

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((previous) => ({ ...previous, [key]: value }))
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
      openSettings()
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

    const promptMessages = buildApiMessages(history, settingsSnapshot.systemPrompt)

    try {
      let completion: CompletionResult

      try {
        completion = await requestStreamCompletion(
          settingsSnapshot,
          promptMessages,
          controller.signal,
          {
            onContent: (chunk) => {
              setConversations((previous) =>
                previous.map((conversation) => {
                  if (conversation.id !== conversationId) {
                    return conversation
                  }
                  const nextMessages = conversation.messages.map((message) =>
                    message.id === assistantId
                      ? { ...message, text: `${message.text}${chunk}` }
                      : message,
                  )
                  return withConversationMessages(conversation, nextMessages)
                }),
              )
            },
            onReasoning: (chunk) => {
              setConversations((previous) =>
                previous.map((conversation) => {
                  if (conversation.id !== conversationId) {
                    return conversation
                  }
                  const nextMessages = conversation.messages.map((message) =>
                    message.id === assistantId
                      ? { ...message, reasoning: `${message.reasoning ?? ''}${chunk}` }
                      : message,
                  )
                  return withConversationMessages(conversation, nextMessages)
                }),
              )
            },
          },
        )
      } catch (streamError) {
        if (streamError instanceof DOMException && streamError.name === 'AbortError') {
          throw streamError
        }
        completion = await requestNonStreamCompletion(
          settingsSnapshot,
          promptMessages,
          controller.signal,
        )
      }

      applyAssistantResult(conversationId, assistantId, completion, promptMessages)
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
    setDraft('')
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
      const attachments = await Promise.all(
        files.map(async (file) => ({
          id: createId(),
          name: file.name,
          mimeType: file.type || 'image/*',
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        })),
      )

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

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const handleCompactDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSend()
    }
  }

  const switchConversation = (conversationId: string): void => {
    setActiveConversationId(conversationId)
    closeDrawer()
    closeModelMenu()
    setPendingImages([])
    cancelEdit()
    setIsEditingTitle(false)
  }

  const createNewConversation = (): void => {
    const nextConversation = createConversation()
    setConversations((previous) => [nextConversation, ...previous].slice(0, MAX_STORED_CONVERSATIONS))
    setActiveConversationId(nextConversation.id)
    closeDrawer()
    closeModelMenu()
    setPendingImages([])
    setDraft('')
    cancelEdit()
    setIsEditingTitle(false)
  }

  const toggleReasoning = (messageId: string): void => {
    setOpenReasoningByMessage((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }))
  }

  const beginRenameConversation = (): void => {
    if (!activeConversation) {
      return
    }
    setIsEditingTitle(true)
    setTitleDraft(activeConversation.title)
  }

  const cancelRenameConversation = (): void => {
    setIsEditingTitle(false)
    setTitleDraft('')
  }

  const saveRenameConversation = (): void => {
    if (!activeConversation) {
      return
    }
    const nextTitle = titleDraft.trim()
    if (!nextTitle) {
      pushNotice('对话标题不能为空。', 'error')
      return
    }
    updateConversationTitle(activeConversation.id, nextTitle, true)
    setIsEditingTitle(false)
    setTitleDraft('')
  }

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      if (!storageWarningShownRef.current) {
        storageWarningShownRef.current = true
        setNotice({ text: '本地存储空间不足，设置可能不会被完整保存。', type: 'error' })
      }
      console.warn('Failed to persist settings', error)
    }
  }, [settings])

  useEffect(() => {
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
  }, [conversations])

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
    if (!notice) {
      return undefined
    }
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, isSending])

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
    setPendingImages([])
    cancelEdit()
    cancelRenameConversation()
    closeModelMenu()
  }, [activeConversationId, closeModelMenu])

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

  const renderComposerTools = (className = 'composer-tools') => (
    <div className={className}>
      <div className="model-picker" ref={modelMenuRef}>
        <button
          type="button"
          className="model-trigger"
          onClick={() =>
            modelMenuVisible ? closeModelMenu() : openModelMenu()
          }
        >
          <span>{settings.currentModel || '选择模型'}</span>
          <span className={`arrow ${modelMenuVisible ? 'open' : ''}`}>▾</span>
        </button>

        {modelMenuMounted ? (
          <div
            className={`model-popover ${modelMenuVisible ? 'is-open' : 'is-closing'}`}
          >
            {models.length === 0 ? (
              <div className="model-popover-empty">
                <p>暂无模型</p>
                <button
                  type="button"
                  className="tiny-button"
                  onClick={() => {
                    closeModelMenu()
                    openSettings()
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

  return (
    <div className="app-shell">
      <header className="app-header">
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

        <div className="header-center">
          {isEditingTitle && activeConversation ? (
            <div className="title-editor">
              <input
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
              <button type="button" className="tiny-button" onClick={saveRenameConversation}>
                保存
              </button>
            </div>
          ) : (
            <div className="title-display">
              <span className="title-text">{activeConversation?.title ?? 'Chatroom'}</span>
              <button
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

      <main key={activeConversationId} className="message-list page-transition">
        {activeMessages.length === 0 ? (
          <section className="empty-state">
            <h2>Chatroom</h2>
            <p>点击左上角菜单可新增/切换对话，底部可选择模型和上传图片。</p>
          </section>
        ) : null}

        {activeMessages.map((message) => {
          const editing = editingMessageId === message.id
          const textValue = message.text.trim()
          const hasReasoning = Boolean(message.reasoning?.trim())
          const isAssistantLoading =
            message.role === 'assistant' && !message.error && !textValue && !hasReasoning
          const displayText =
            textValue ||
            (message.role === 'assistant' && !isAssistantLoading ? '（模型未返回文本内容）' : '')
          const shouldRenderText =
            displayText.length > 0 || (message.role === 'user' && !(message.images?.length ?? 0))

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
                        重生
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

        <div className={`composer-row ${showExpandedComposer ? 'is-expanded' : 'is-compact'}`}>
          {showExpandedComposer ? renderComposerTools() : null}

          {showExpandedComposer ? (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            />
          ) : (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleCompactDraftKeyDown}
              placeholder="输入消息"
            />
          )}

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

        {!showExpandedComposer ? renderComposerTools('composer-tools composer-tools-compact') : null}

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
      </footer>

      {drawerMounted ? (
        <div
          className={`drawer-overlay ${drawerVisible ? 'is-open' : 'is-closing'}`}
          onClick={closeDrawer}
        >
          <aside className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <h2>Chatroom</h2>
              <button type="button" onClick={createNewConversation}>
                新增对话
              </button>
            </div>

            <div className="conversation-list">
              {sortedConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-item ${
                    conversation.id === activeConversationId ? 'active' : ''
                  }`}
                  onClick={() => switchConversation(conversation.id)}
                >
                  <span className="conversation-item-title">{conversation.title}</span>
                  <span className="conversation-item-time">
                    {dateFormatter.format(conversation.updatedAt)}
                  </span>
                </button>
              ))}
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  closeDrawer()
                  openSettings()
                }}
              >
                设置
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {settingsMounted ? (
        <div className={`settings-screen ${settingsVisible ? 'is-open' : 'is-closing'}`}>
          <section className="settings-page">
            <div className="settings-header">
              <h2>Chatroom 设置</h2>
              <button type="button" className="ghost-button" onClick={closeSettings}>
                关闭
              </button>
            </div>

            <label className="field">
              <span>API Base URL</span>
              <input
                value={settings.apiBaseUrl}
                onChange={(event) => updateSetting('apiBaseUrl', event.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </label>

            <label className="field">
              <span>API Key</span>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => updateSetting('apiKey', event.target.value)}
                placeholder="sk-..."
              />
            </label>

            <div className="model-tools">
              <button type="button" onClick={() => void fetchModels()} disabled={isFetchingModels}>
                {isFetchingModels ? '加载中...' : '拉取模型列表'}
              </button>
              {settings.currentModel ? (
                <button type="button" className="ghost-button" onClick={() => void testModel(settings.currentModel)}>
                  检测当前模型
                </button>
              ) : null}
            </div>

            <div className="model-add-row">
              <input
                value={manualModel}
                onChange={(event) => setManualModel(event.target.value)}
                placeholder="手动添加模型，例如 gpt-4o-mini"
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
                  <div key={modelId} className="model-row">
                    <label>
                      <input
                        type="radio"
                        checked={settings.currentModel === modelId}
                        onChange={() => updateSetting('currentModel', modelId)}
                      />
                      <span>{modelId}</span>
                    </label>
                    <div className="model-row-actions">
                      <span className={`model-state model-${modelHealth[modelId] ?? 'untested'}`}>
                        {modelHealthLabel(modelHealth[modelId])}
                      </span>
                      <button type="button" className="tiny-button" onClick={() => void testModel(modelId)}>
                        检测
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <label className="field">
              <span>System Prompt（可留空）</span>
              <textarea
                value={settings.systemPrompt}
                onChange={(event) => updateSetting('systemPrompt', event.target.value)}
                placeholder="你可以在此配置系统提示词"
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Temperature (0-2)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={settings.temperature}
                  onChange={(event) =>
                    updateSetting('temperature', clamp(Number(event.target.value) || 0, 0, 2))
                  }
                />
              </label>

              <label className="field">
                <span>Top P (0-1)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.topP}
                  onChange={(event) =>
                    updateSetting('topP', clamp(Number(event.target.value) || 0, 0, 1))
                  }
                />
              </label>

              <label className="field">
                <span>Max Tokens</span>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={settings.maxTokens}
                  onChange={(event) =>
                    updateSetting(
                      'maxTokens',
                      Math.round(clamp(Number(event.target.value) || 1, 1, 8192)),
                    )
                  }
                />
              </label>

              <label className="field">
                <span>Presence Penalty (-2~2)</span>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={settings.presencePenalty}
                  onChange={(event) =>
                    updateSetting(
                      'presencePenalty',
                      clamp(Number(event.target.value) || 0, -2, 2),
                    )
                  }
                />
              </label>

              <label className="field">
                <span>Frequency Penalty (-2~2)</span>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={settings.frequencyPenalty}
                  onChange={(event) =>
                    updateSetting(
                      'frequencyPenalty',
                      clamp(Number(event.target.value) || 0, -2, 2),
                    )
                  }
                />
              </label>
            </div>

            <label className="toggle-row">
              <span>显示思考过程</span>
              <input
                className="toggle-switch"
                type="checkbox"
                checked={settings.showReasoning}
                onChange={(event) => updateSetting('showReasoning', event.target.checked)}
              />
            </label>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
