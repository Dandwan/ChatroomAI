import { clearConversationImageManifest } from '../../utils/conversation-image-storage'
import {
  MAX_READ_LIST_ENTRIES,
  isTextFileLikely,
  normalizeReadRelativePath,
  sanitizeReadDepth,
} from '../read-utils'
import {
  CHAT_STORAGE_DIRECTORIES,
  deletePath,
  ensureDirectory,
  joinRelativePath,
  listDirectory,
  pathExists,
  readBase64File,
  readJsonFile,
  readTextFile,
  statPath,
  writeBase64File,
  writeJsonFile,
} from './filesystem'
import { deletePath as deleteSkillHostPath, joinRelativePath as joinSkillRelativePath } from '../skills/storage'
import {
  LEGACY_ACTIVE_CONVERSATION_STORAGE_KEY,
  LEGACY_CONVERSATIONS_STORAGE_KEY,
  LEGACY_DRAFTS_STORAGE_KEY,
  LEGACY_IMAGE_MANIFEST_STORAGE_KEY,
  LEGACY_MESSAGES_STORAGE_KEY,
  hasLegacyChatState,
  loadLegacyChatState,
  loadLegacyImageDataUrl,
} from './legacy'
import {
  inferConversationResponseModeFromTranscript,
  normalizeConversationResponseMode,
  projectConversationMessages,
  transcriptFromLegacyMessages,
} from '../chat-transcript'
import type {
  AssignedImageStorageKey,
  ChatStorageConversation,
  ChatStorageConversationSummary,
  ChatStorageContentPart,
  ChatStorageHistoryStats,
  ChatStorageImageAttachment,
  ChatStorageIndexState,
  ChatStoragePersistState,
  ChatStorageState,
  ChatStorageTokenUsage,
  LoadedChatStorageConversation,
  PersistChatStorageResult,
} from './types'

const SCHEMA_VERSION = 4
const META_PATH = joinRelativePath(CHAT_STORAGE_DIRECTORIES.root, 'meta.json')
const INDEX_PATH = joinRelativePath(CHAT_STORAGE_DIRECTORIES.conversations, 'index.json')

interface ChatStorageMeta {
  schemaVersion: number
  activeConversationId?: string
}

interface ConversationIndexFile {
  schemaVersion: number
  updatedAt: number
  historyStats: ChatStorageHistoryStats
  conversations: ChatStorageConversationSummary[]
}

interface PersistedConversationFileRecord {
  id: string
  name: string
  mimeType: string
  size: number
  relativePath: string
  createdAt: number
}

interface PersistedConversationDraft {
  text: string
  attachmentIds: string[]
}

interface PersistedConversationPreferences {
  responseMode?: 'tool' | 'text'
}

interface PersistedTranscriptTextPart {
  type: 'text'
  text: string
}

interface PersistedTranscriptImagePart {
  type: 'image'
  attachmentId: string
}

type PersistedTranscriptContentPart = PersistedTranscriptTextPart | PersistedTranscriptImagePart

interface PersistedUserMessageEvent {
  kind: 'user_message'
  id: string
  turnId: string
  createdAt: number
  content: PersistedTranscriptContentPart[]
}

interface PersistedAssistantMessageEvent {
  kind: 'assistant_message'
  id: string
  turnId: string
  roundId?: string
  createdAt: number
  rawText: string
  assistantFlow?: import('../../utils/assistant-flow').AssistantFlowNode[]
  reasoning?: string
  model?: string
  usage?: ChatStorageTokenUsage
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

interface PersistedHostMessageEvent {
  kind: 'host_message'
  id: string
  turnId: string
  roundId?: string
  createdAt: number
  category:
    | 'read_result'
    | 'read_error'
    | 'edit_result'
    | 'edit_error'
    | 'run_result'
    | 'run_error'
    | 'skill_result'
    | 'skill_error'
    | 'tag_error'
    | 'protocol_retry'
    | 'missing_final'
  payload: Record<string, unknown>
}

type PersistedConversationEvent =
  | PersistedUserMessageEvent
  | PersistedAssistantMessageEvent
  | PersistedHostMessageEvent

interface PersistedConversationMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachmentIds?: string[]
  assistantFlow?: import('../../utils/assistant-flow').AssistantFlowNode[]
  reasoning?: string
  createdAt: number
  model?: string
  usage?: ChatStorageTokenUsage
  usageEstimated?: boolean
  firstTokenLatencyMs?: number
  totalTimeMs?: number
  error?: string
}

interface PersistedConversationRecord {
  id: string
  title: string
  titleManuallyEdited: boolean
  createdAt: number
  updatedAt: number
  draft: PersistedConversationDraft
  preferences?: PersistedConversationPreferences
  transcript?: PersistedConversationEvent[]
  messages?: PersistedConversationMessage[]
  files: PersistedConversationFileRecord[]
}

interface PersistedConversationDocument {
  schemaVersion: number
  conversation: PersistedConversationRecord
}

interface SerializedConversationResult {
  document: PersistedConversationDocument
  assignedImageStorageKeys: AssignedImageStorageKey[]
}

let initializationPromise: Promise<void> | null = null

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

const sanitizePathSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9-_]/g, '_')

const buildConversationDirectory = (conversationId: string): string =>
  joinRelativePath(CHAT_STORAGE_DIRECTORIES.conversations, sanitizePathSegment(conversationId))

const buildConversationDocumentPath = (conversationId: string): string =>
  joinRelativePath(buildConversationDirectory(conversationId), 'conversation.json')

const buildConversationFilesDirectory = (conversationId: string): string =>
  joinRelativePath(buildConversationDirectory(conversationId), 'files')

export const buildConversationWorkspaceDirectory = (conversationId: string): string =>
  joinRelativePath(buildConversationDirectory(conversationId), 'workspace')

const buildAbsoluteAttachmentPath = (conversationId: string, relativePath: string): string =>
  joinRelativePath(buildConversationDirectory(conversationId), relativePath)

const toEntryKind = (type?: string): 'file' | 'directory' =>
  type === 'directory' ? 'directory' : 'file'

const sortWorkspaceEntries = (
  entries: Array<{
    path: string
    name: string
    kind: 'file' | 'directory'
    size?: number
  }>,
): Array<{
  path: string
  name: string
  kind: 'file' | 'directory'
  size?: number
}> =>
  [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }
    return left.path.localeCompare(right.path)
  })

const removeLocalStorageItem = (key: string): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore best-effort cleanup failures.
  }
}

const getDataUrlParts = (dataUrl: string): { mimeType: string; base64: string } | null => {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) {
    return null
  }
  return {
    mimeType: match[1] || 'application/octet-stream',
    base64: match[2],
  }
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
}

const extensionFromName = (name: string): string | undefined => {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  if (!match) {
    return undefined
  }
  return `.${match[1].toLowerCase()}`
}

const extensionFromMimeType = (mimeType: string): string | undefined => {
  const normalized = mimeType.trim().toLowerCase()
  return MIME_EXTENSION_MAP[normalized]
}

const resolveAttachmentExtension = (image: ChatStorageImageAttachment): string => {
  const fromMime = extensionFromMimeType(image.mimeType)
  if (fromMime) {
    return fromMime
  }
  const fromName = extensionFromName(image.name)
  if (fromName) {
    return fromName
  }
  const dataUrlParts = image.dataUrl ? getDataUrlParts(image.dataUrl) : null
  const fromDataUrl = dataUrlParts ? extensionFromMimeType(dataUrlParts.mimeType) : undefined
  return fromDataUrl ?? '.bin'
}

const isConversationPersistable = (
  conversation: ChatStorageConversation,
  draftText: string | undefined,
): boolean =>
  conversation.transcript.length > 0 || conversation.titleManuallyEdited || (draftText?.trim().length ?? 0) > 0

const isConversationSummaryPersistable = (
  summary: ChatStorageConversationSummary,
): boolean =>
  summary.messageCount > 0 ||
  summary.titleManuallyEdited ||
  summary.draftTextLength > 0 ||
  summary.draftAttachmentCount > 0

const EMPTY_HISTORY_STATS: ChatStorageHistoryStats = {
  totalConversationCount: 0,
  totalMessageCount: 0,
  totalPhotoCount: 0,
  totalTokenCount: 0,
  totalToolCallCount: 0,
}

const normalizeHistoryStats = (value: unknown): ChatStorageHistoryStats => {
  if (!isRecord(value)) {
    return EMPTY_HISTORY_STATS
  }

  return {
    totalConversationCount: Math.max(0, Math.round(toFiniteNumber(value.totalConversationCount) ?? 0)),
    totalMessageCount: Math.max(0, Math.round(toFiniteNumber(value.totalMessageCount) ?? 0)),
    totalPhotoCount: Math.max(0, Math.round(toFiniteNumber(value.totalPhotoCount) ?? 0)),
    totalTokenCount: Math.max(0, Math.round(toFiniteNumber(value.totalTokenCount) ?? 0)),
    totalToolCallCount: Math.max(0, Math.round(toFiniteNumber(value.totalToolCallCount) ?? 0)),
  }
}

const normalizeConversationSummary = (
  value: unknown,
): ChatStorageConversationSummary | null => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null
  }

  return {
    id: value.id,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : '新对话',
    titleManuallyEdited: value.titleManuallyEdited === true,
    createdAt: Math.round(toFiniteNumber(value.createdAt) ?? Date.now()),
    updatedAt: Math.round(toFiniteNumber(value.updatedAt) ?? Date.now()),
    preferences: normalizePersistedConversationPreferences(value.preferences),
    messageCount: Math.max(0, Math.round(toFiniteNumber(value.messageCount) ?? 0)),
    userMessageCount: Math.max(0, Math.round(toFiniteNumber(value.userMessageCount) ?? 0)),
    fileCount: Math.max(0, Math.round(toFiniteNumber(value.fileCount) ?? 0)),
    imageCount: Math.max(0, Math.round(toFiniteNumber(value.imageCount) ?? 0)),
    assistantTokenCount: Math.max(0, Math.round(toFiniteNumber(value.assistantTokenCount) ?? 0)),
    toolCallCount: Math.max(0, Math.round(toFiniteNumber(value.toolCallCount) ?? 0)),
    draftTextLength: Math.max(0, Math.round(toFiniteNumber(value.draftTextLength) ?? 0)),
    draftAttachmentCount: Math.max(0, Math.round(toFiniteNumber(value.draftAttachmentCount) ?? 0)),
    lastMessagePreview: typeof value.lastMessagePreview === 'string' ? value.lastMessagePreview : '',
    lastMessageRole: value.lastMessageRole === 'user' || value.lastMessageRole === 'assistant'
      ? value.lastMessageRole
      : undefined,
  }
}

const normalizeConversationIndexFile = (
  value: unknown,
): ConversationIndexFile | null => {
  if (!isRecord(value)) {
    return null
  }

  const conversations = Array.isArray(value.conversations)
    ? value.conversations
        .map((entry) => normalizeConversationSummary(entry))
        .filter((entry): entry is ChatStorageConversationSummary => entry !== null)
    : []

  return {
    schemaVersion: Math.round(toFiniteNumber(value.schemaVersion) ?? SCHEMA_VERSION),
    updatedAt: Math.round(toFiniteNumber(value.updatedAt) ?? Date.now()),
    historyStats: normalizeHistoryStats(value.historyStats),
    conversations,
  }
}

export const buildConversationSummary = (
  conversation: ChatStorageConversation,
  draftText: string,
): ChatStorageConversationSummary => {
  const projectedMessages = projectConversationMessages(conversation)
  const lastMessage = projectedMessages[projectedMessages.length - 1]
  const userMessageCount = projectedMessages.filter((message) => message.role === 'user').length
  const imageCount = conversation.transcript.reduce((count, event) => {
    if (event.kind !== 'user_message') {
      return count
    }
    return count + event.content.filter((part) => part.type === 'image').length
  }, 0)
  const assistantTokenCount = projectedMessages.reduce(
    (sum, message) => sum + (message.role === 'assistant' ? message.usage?.totalTokens ?? 0 : 0),
    0,
  )
  const toolCallCount = conversation.transcript.reduce((count, event) => {
    if (event.kind !== 'host_message') {
      return count
    }

    switch (event.category) {
      case 'read_result':
      case 'read_error':
      case 'edit_result':
      case 'edit_error':
      case 'run_result':
      case 'run_error':
      case 'skill_result':
      case 'skill_error':
        return count + 1
      default:
        return count
    }
  }, 0)

  return {
    id: conversation.id,
    title: conversation.title,
    titleManuallyEdited: conversation.titleManuallyEdited,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    preferences: conversation.preferences,
    messageCount: projectedMessages.length,
    userMessageCount,
    fileCount: imageCount,
    imageCount,
    assistantTokenCount,
    toolCallCount,
    draftTextLength: draftText.length,
    draftAttachmentCount: 0,
    lastMessagePreview: typeof lastMessage?.text === 'string' ? lastMessage.text.slice(0, 120) : '',
    lastMessageRole: lastMessage?.role,
  }
}

export const buildHistoryStatsFromSummaries = (
  summaries: ChatStorageConversationSummary[],
): ChatStorageHistoryStats =>
  summaries.reduce<ChatStorageHistoryStats>(
    (stats, summary) => ({
      totalConversationCount: stats.totalConversationCount + 1,
      totalMessageCount: stats.totalMessageCount + summary.userMessageCount,
      totalPhotoCount: stats.totalPhotoCount + summary.imageCount,
      totalTokenCount: stats.totalTokenCount + summary.assistantTokenCount,
      totalToolCallCount: stats.totalToolCallCount + summary.toolCallCount,
    }),
    EMPTY_HISTORY_STATS,
  )

const createStateSignature = (state: ChatStoragePersistState): string =>
  JSON.stringify({
    activeConversationId: state.activeConversationId,
    conversations: state.conversations.map((conversation) => ({
      kind: conversation.kind,
      ...(conversation.kind === 'hydrated'
        ? {
            draftText: conversation.draftText,
            conversation: {
              id: conversation.conversation.id,
              title: conversation.conversation.title,
              titleManuallyEdited: conversation.conversation.titleManuallyEdited,
              createdAt: conversation.conversation.createdAt,
              updatedAt: conversation.conversation.updatedAt,
              preferences: conversation.conversation.preferences,
              transcript: conversation.conversation.transcript,
            },
          }
        : {
            summary: conversation.summary,
          }),
    })),
  })

interface LegacyLoadedMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  assistantFlow?: PersistedAssistantMessageEvent['assistantFlow']
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

const normalizeLegacyPersistedMessage = (
  message: PersistedConversationMessage,
  conversationId: string,
  filesById: Map<string, PersistedConversationFileRecord>,
): LegacyLoadedMessage => {
  const images: ChatStorageImageAttachment[] = []
  for (const attachmentId of message.attachmentIds ?? []) {
    const file = filesById.get(attachmentId)
    if (!file) {
      continue
    }
    images.push({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      dataUrl: '',
      storageKey: buildAbsoluteAttachmentPath(conversationId, file.relativePath),
    })
  }

  return {
    id: message.id,
    role: message.role,
    text: typeof message.text === 'string' ? message.text : '',
    assistantFlow: Array.isArray(message.assistantFlow) ? message.assistantFlow : undefined,
    images: images.length > 0 ? images : undefined,
    reasoning: typeof message.reasoning === 'string' ? message.reasoning : undefined,
    createdAt: Math.round(toFiniteNumber(message.createdAt) ?? Date.now()),
    model: typeof message.model === 'string' ? message.model : undefined,
    usage: isRecord(message.usage) ? (message.usage as ChatStorageTokenUsage) : undefined,
    usageEstimated: message.usageEstimated === true,
    firstTokenLatencyMs: toFiniteNumber(message.firstTokenLatencyMs),
    totalTimeMs: toFiniteNumber(message.totalTimeMs),
    error: typeof message.error === 'string' ? message.error : undefined,
  }
}

const normalizePersistedTranscriptContent = (
  content: PersistedTranscriptContentPart[],
  conversationId: string,
  filesById: Map<string, PersistedConversationFileRecord>,
): ChatStorageContentPart[] => {
  const normalized: ChatStorageContentPart[] = []

  for (const part of content) {
    if (part.type === 'text') {
      normalized.push({
        type: 'text',
        text: typeof part.text === 'string' ? part.text : '',
      })
      continue
    }

    const file = filesById.get(part.attachmentId)
    if (!file) {
      continue
    }
    normalized.push({
      type: 'image',
      image: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        dataUrl: '',
        storageKey: buildAbsoluteAttachmentPath(conversationId, file.relativePath),
      },
    })
  }

  return normalized
}

const normalizePersistedConversationPreferences = (
  value: unknown,
): ChatStorageConversation['preferences'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const responseMode = normalizeConversationResponseMode(value.responseMode)
  return responseMode
    ? {
        responseMode,
      }
    : undefined
}

const normalizePersistedTranscriptEvent = (
  event: PersistedConversationEvent,
  conversationId: string,
  filesById: Map<string, PersistedConversationFileRecord>,
): ChatStorageConversation['transcript'][number] | null => {
  if (event.kind === 'user_message') {
    return {
      kind: 'user_message',
      id: event.id,
      turnId: event.turnId,
      createdAt: Math.round(toFiniteNumber(event.createdAt) ?? Date.now()),
      content: normalizePersistedTranscriptContent(event.content ?? [], conversationId, filesById),
    }
  }

  if (event.kind === 'assistant_message') {
    return {
      kind: 'assistant_message',
      id: event.id,
      turnId: event.turnId,
      roundId: typeof event.roundId === 'string' && event.roundId.trim() ? event.roundId : undefined,
      createdAt: Math.round(toFiniteNumber(event.createdAt) ?? Date.now()),
      rawText: typeof event.rawText === 'string' ? event.rawText : '',
      assistantFlow: Array.isArray(event.assistantFlow) ? event.assistantFlow : undefined,
      reasoning: typeof event.reasoning === 'string' ? event.reasoning : undefined,
      model: typeof event.model === 'string' ? event.model : undefined,
      usage: isRecord(event.usage) ? (event.usage as ChatStorageTokenUsage) : undefined,
      usageEstimated: event.usageEstimated === true,
      firstTokenLatencyMs: toFiniteNumber(event.firstTokenLatencyMs),
      totalTimeMs: toFiniteNumber(event.totalTimeMs),
      error: typeof event.error === 'string' ? event.error : undefined,
    }
  }

  return {
    kind: 'host_message',
    id: event.id,
    turnId: event.turnId,
    roundId: typeof event.roundId === 'string' && event.roundId.trim() ? event.roundId : undefined,
    createdAt: Math.round(toFiniteNumber(event.createdAt) ?? Date.now()),
    category: event.category,
    payload: isRecord(event.payload) ? event.payload : {},
  }
}

const normalizePersistedConversationDocument = (
  raw: unknown,
): PersistedConversationDocument | null => {
  if (!isRecord(raw) || !isRecord(raw.conversation)) {
    return null
  }

  const conversation = raw.conversation
  if (typeof conversation.id !== 'string') {
    return null
  }

  const transcript = Array.isArray(conversation.transcript)
    ? conversation.transcript.filter((event): event is PersistedConversationEvent => isRecord(event))
    : undefined
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.filter((message): message is PersistedConversationMessage => isRecord(message))
    : undefined
  const files = Array.isArray(conversation.files)
    ? conversation.files.filter((file): file is PersistedConversationFileRecord => isRecord(file))
    : []
  const draft = isRecord(conversation.draft)
    ? {
        text: typeof conversation.draft.text === 'string' ? conversation.draft.text : '',
        attachmentIds: Array.isArray(conversation.draft.attachmentIds)
          ? conversation.draft.attachmentIds.filter((item): item is string => typeof item === 'string')
          : [],
      }
    : { text: '', attachmentIds: [] }
  const preferences = normalizePersistedConversationPreferences(conversation.preferences)

  return {
    schemaVersion: Math.round(toFiniteNumber(raw.schemaVersion) ?? SCHEMA_VERSION),
    conversation: {
      id: conversation.id,
      title: typeof conversation.title === 'string' && conversation.title.trim() ? conversation.title.trim() : '新对话',
      titleManuallyEdited: conversation.titleManuallyEdited === true,
      createdAt: Math.round(toFiniteNumber(conversation.createdAt) ?? Date.now()),
      updatedAt: Math.round(toFiniteNumber(conversation.updatedAt) ?? Date.now()),
      draft,
      preferences,
      transcript,
      messages,
      files,
    },
  }
}

const readConversationDocument = async (conversationId: string): Promise<PersistedConversationDocument | null> => {
  const raw = await readJsonFile<unknown>(buildConversationDocumentPath(conversationId), null)
  return normalizePersistedConversationDocument(raw)
}

const readConversationIndexFile = async (): Promise<ConversationIndexFile | null> => {
  const raw = await readJsonFile<unknown>(INDEX_PATH, null)
  return normalizeConversationIndexFile(raw)
}

const listConversationIdsFromDirectories = async (): Promise<string[]> => {
  const entries = await listDirectory(CHAT_STORAGE_DIRECTORIES.conversations)
  return entries.filter((entry) => entry.name !== 'index.json').map((entry) => entry.name)
}

const sortConversationSummaries = (
  conversations: ChatStorageConversationSummary[],
): ChatStorageConversationSummary[] =>
  [...conversations].sort((left, right) => right.updatedAt - left.updatedAt)

const writeIndexFile = async (
  conversations: ChatStorageConversationSummary[],
): Promise<void> => {
  const sortedConversations = sortConversationSummaries(conversations)
  const index: ConversationIndexFile = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    historyStats: buildHistoryStatsFromSummaries(sortedConversations),
    conversations: sortedConversations,
  }
  await writeJsonFile(INDEX_PATH, index)
}

const writeMetaFile = async (activeConversationId?: string): Promise<void> => {
  const meta: ChatStorageMeta = {
    schemaVersion: SCHEMA_VERSION,
    activeConversationId: activeConversationId && activeConversationId.trim() ? activeConversationId : undefined,
  }
  await writeJsonFile(META_PATH, meta)
}

const hydrateConversationDocument = (
  document: PersistedConversationDocument,
): LoadedChatStorageConversation & {
  needsMigration: boolean
} => {
  const filesById = new Map(document.conversation.files.map((file) => [file.id, file]))
  const transcript =
    (document.conversation.transcript ?? [])
      .map((event) => normalizePersistedTranscriptEvent(event, document.conversation.id, filesById))
      .filter((event): event is ChatStorageConversation['transcript'][number] => event !== null) ??
    []
  const inferredTranscriptResponseMode = inferConversationResponseModeFromTranscript(transcript)
  const transcriptResponseMode =
    document.conversation.preferences?.responseMode ?? inferredTranscriptResponseMode
  const transcriptPreferences = transcriptResponseMode
    ? {
        responseMode: transcriptResponseMode,
      }
    : undefined
  const draftText = document.conversation.draft.text.trim()
    ? document.conversation.draft.text
    : ''

  if (transcript.length > 0) {
    return {
      conversation: {
        id: document.conversation.id,
        title: document.conversation.title,
        titleManuallyEdited: document.conversation.titleManuallyEdited,
        createdAt: document.conversation.createdAt,
        updatedAt: document.conversation.updatedAt,
        preferences: transcriptPreferences,
        transcript,
      },
      draftText,
      needsMigration:
        document.schemaVersion !== SCHEMA_VERSION ||
        !Array.isArray(document.conversation.transcript) ||
        (!document.conversation.preferences?.responseMode && Boolean(transcriptPreferences?.responseMode)),
    }
  }

  const legacyMessages = (document.conversation.messages ?? []).map((message) =>
    normalizeLegacyPersistedMessage(message, document.conversation.id, filesById),
  )
  const legacyTranscript = transcriptFromLegacyMessages(legacyMessages)
  const legacyResponseMode = inferConversationResponseModeFromTranscript(legacyTranscript)
  const legacyPreferences =
    document.conversation.preferences ??
    (legacyResponseMode
      ? {
          responseMode: legacyResponseMode,
        }
      : undefined)

  return {
    conversation: {
      id: document.conversation.id,
      title: document.conversation.title,
      titleManuallyEdited: document.conversation.titleManuallyEdited,
      createdAt: document.conversation.createdAt,
      updatedAt: document.conversation.updatedAt,
      preferences: legacyPreferences,
      transcript: legacyTranscript,
    },
    draftText,
    needsMigration:
      document.schemaVersion !== SCHEMA_VERSION ||
      !Array.isArray(document.conversation.transcript) ||
      (!document.conversation.preferences?.responseMode && Boolean(legacyPreferences?.responseMode)),
  }
}

const loadConversationsFromNewStorage = async (): Promise<ChatStorageState> => {
  const meta = await readJsonFile<ChatStorageMeta | null>(META_PATH, null)
  const index = await readConversationIndexFile()
  const indexedIds =
    index && Array.isArray(index.conversations)
      ? index.conversations
          .map((entry) => (isRecord(entry) && typeof entry.id === 'string' ? entry.id : ''))
          .filter(Boolean)
      : []
  const fallbackIds = await listConversationIdsFromDirectories()
  const indexedDirectoryNames = new Set(indexedIds.map((id) => sanitizePathSegment(id)))
  const orderedIds = [
    ...indexedIds,
    ...fallbackIds.filter((directoryName) => !indexedDirectoryNames.has(directoryName)),
  ]

  const documents: PersistedConversationDocument[] = []
  for (const conversationId of orderedIds) {
    const document = await readConversationDocument(conversationId)
    if (document) {
      documents.push(document)
    }
  }

  if (documents.length === 0) {
    return {
      conversations: [],
      activeConversationId: '',
      draftsByConversation: {},
    }
  }

  const missingIds = documents
    .map((document) => document.conversation.id)
    .filter((id) => !indexedIds.includes(id))
  let needsConversationMigration = documents.some(
    (document) => document.schemaVersion !== SCHEMA_VERSION || !Array.isArray(document.conversation.transcript),
  )
  if (!meta || meta.schemaVersion !== SCHEMA_VERSION) {
    await writeMetaFile(meta?.activeConversationId)
  }

  const draftsByConversation: Record<string, string> = {}
  const loadedConversations = documents.map((document) => hydrateConversationDocument(document))
  for (const loaded of loadedConversations) {
    if (loaded.draftText.trim()) {
      draftsByConversation[loaded.conversation.id] = loaded.draftText
    }
    if (loaded.needsMigration) {
      needsConversationMigration = true
    }
  }
  const conversations = loadedConversations.map((loaded) => loaded.conversation)

  if (needsConversationMigration) {
    for (const conversation of conversations) {
      const serialized = await serializeConversation(
        conversation,
        draftsByConversation[conversation.id] ?? '',
      )
      await ensureDirectory(buildConversationDirectory(conversation.id))
      await ensureDirectory(buildConversationFilesDirectory(conversation.id))
      await writeJsonFile(buildConversationDocumentPath(conversation.id), serialized.document)
    }
  }

  if (missingIds.length > 0 || !index || index.schemaVersion !== SCHEMA_VERSION || needsConversationMigration) {
    await writeIndexFile(
      conversations.map((conversation) =>
        buildConversationSummary(conversation, draftsByConversation[conversation.id] ?? ''),
      ),
    )
  }

  const validActiveConversationId =
    typeof meta?.activeConversationId === 'string' &&
    conversations.some((conversation) => conversation.id === meta.activeConversationId)
      ? meta.activeConversationId
      : ''

  return {
    conversations,
    activeConversationId: validActiveConversationId,
    draftsByConversation,
  }
}

const buildWorkspaceTargetPath = (conversationId: string, relativePath: string): string =>
  relativePath
    ? joinRelativePath(buildConversationWorkspaceDirectory(conversationId), relativePath)
    : buildConversationWorkspaceDirectory(conversationId)

const enumerateWorkspaceDirectory = async (
  conversationId: string,
  relativePath: string,
  depth: number,
): Promise<{
  entries: Array<{
    path: string
    name: string
    kind: 'file' | 'directory'
    size?: number
  }>
  truncated: boolean
}> => {
  const queue: Array<{ path: string; level: number }> = [{ path: relativePath, level: 1 }]
  const entries: Array<{
    path: string
    name: string
    kind: 'file' | 'directory'
    size?: number
  }> = []
  let truncated = false

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const currentStoragePath = buildWorkspaceTargetPath(conversationId, current.path)
    const children = (await listDirectory(currentStoragePath))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))

    for (const childName of children) {
      const childRelativePath = current.path ? joinRelativePath(current.path, childName) : childName
      const childStoragePath = buildWorkspaceTargetPath(conversationId, childRelativePath)
      const childStat = await statPath(childStoragePath)
      const kind = toEntryKind(childStat.type)
      entries.push({
        path: childRelativePath,
        name: childName,
        kind,
        size: kind === 'file' ? childStat.size : undefined,
      })

      if (entries.length >= MAX_READ_LIST_ENTRIES) {
        truncated = true
        return {
          entries: sortWorkspaceEntries(entries),
          truncated,
        }
      }

      if (kind === 'directory' && current.level < depth) {
        queue.push({
          path: childRelativePath,
          level: current.level + 1,
        })
      }
    }
  }

  return {
    entries: sortWorkspaceEntries(entries),
    truncated,
  }
}

export const listConversationWorkspace = async (
  conversationId: string,
  path?: string,
  depth?: number,
): Promise<{
  path: string
  depth: number
  entries: Array<{
    path: string
    name: string
    kind: 'file' | 'directory'
    size?: number
  }>
  truncated: boolean
}> => {
  const relativePath = normalizeReadRelativePath(path)
  const targetPath = buildWorkspaceTargetPath(conversationId, relativePath)
  const workspaceRoot = buildConversationWorkspaceDirectory(conversationId)
  const safeDepth = sanitizeReadDepth(depth)

  if (!(await pathExists(workspaceRoot))) {
    if (relativePath) {
      throw new Error(`workspace 路径不存在：${relativePath}`)
    }
    return {
      path: '.',
      depth: safeDepth,
      entries: [],
      truncated: false,
    }
  }

  const targetStat = await statPath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`workspace 路径不存在：${relativePath || '.'}`)
  }
  if (toEntryKind(targetStat.type) !== 'directory') {
    throw new Error(`目标不是目录：${relativePath || '.'}`)
  }

  const result = await enumerateWorkspaceDirectory(conversationId, relativePath, safeDepth)
  return {
    path: relativePath || '.',
    depth: safeDepth,
    entries: result.entries,
    truncated: result.truncated,
  }
}

export const statConversationWorkspacePath = async (
  conversationId: string,
  path: string,
): Promise<{
  path: string
  entryType: 'file' | 'directory'
  size?: number
  textLikely?: boolean
}> => {
  const relativePath = normalizeReadRelativePath(path)
  if (!relativePath) {
    return {
      path: '.',
      entryType: 'directory',
    }
  }

  const targetPath = buildWorkspaceTargetPath(conversationId, relativePath)
  const targetStat = await statPath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`workspace 路径不存在：${relativePath}`)
  }

  const entryType = toEntryKind(targetStat.type)
  return {
    path: relativePath,
    entryType,
    size: entryType === 'file' ? targetStat.size : undefined,
    textLikely: entryType === 'file' ? isTextFileLikely(relativePath) : undefined,
  }
}

export const readConversationWorkspaceFile = async (
  conversationId: string,
  path: string,
): Promise<{
  path: string
  content: string
}> => {
  const relativePath = normalizeReadRelativePath(path)
  if (!relativePath) {
    throw new Error('read 缺少 workspace 文件路径')
  }

  const targetPath = buildWorkspaceTargetPath(conversationId, relativePath)
  const targetStat = await statPath(targetPath).catch(() => null)
  if (!targetStat) {
    throw new Error(`workspace 路径不存在：${relativePath}`)
  }
  if (toEntryKind(targetStat.type) !== 'file') {
    throw new Error(`目标不是文件：${relativePath}`)
  }

  const content = await readTextFile(targetPath)
  if (!isTextFileLikely(relativePath, content)) {
    throw new Error(`目标不是可读取的文本文件：${relativePath}`)
  }

  return {
    path: relativePath,
    content,
  }
}

const writeDataUrlToAttachmentPath = async (
  attachmentPath: string,
  dataUrl: string,
): Promise<void> => {
  const parts = getDataUrlParts(dataUrl)
  if (!parts) {
    throw new Error('Invalid data URL')
  }
  await writeBase64File(attachmentPath, parts.base64)
}

const serializeTranscriptContent = async (
  conversationId: string,
  eventId: string,
  createdAt: number,
  content: ChatStorageContentPart[],
): Promise<{
  content: PersistedTranscriptContentPart[]
  files: PersistedConversationFileRecord[]
  assignedImageStorageKeys: AssignedImageStorageKey[]
}> => {
  const files: PersistedConversationFileRecord[] = []
  const assignedImageStorageKeys: AssignedImageStorageKey[] = []
  const persistedContent: PersistedTranscriptContentPart[] = []

  for (const part of content) {
    if (part.type === 'text') {
      persistedContent.push({
        type: 'text',
        text: part.text,
      })
      continue
    }

    const image = part.image
    const extension = resolveAttachmentExtension(image)
    const relativePath = joinRelativePath('files', `${sanitizePathSegment(image.id)}${extension}`)
    const storageKey = buildAbsoluteAttachmentPath(conversationId, relativePath)
    const fileCreatedAt = Math.max(0, Math.round(createdAt || Date.now()))

    if (image.dataUrl.trim()) {
      if (image.storageKey !== storageKey || !(await pathExists(storageKey))) {
        await writeDataUrlToAttachmentPath(storageKey, image.dataUrl)
      }
    }

    files.push({
      id: image.id,
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      relativePath,
      createdAt: fileCreatedAt,
    })
    persistedContent.push({
      type: 'image',
      attachmentId: image.id,
    })

    if (image.storageKey !== storageKey) {
      assignedImageStorageKeys.push({
        conversationId,
        messageId: eventId,
        imageId: image.id,
        storageKey,
      })
    }
  }

  return {
    content: persistedContent,
    files,
    assignedImageStorageKeys,
  }
}

const serializeConversation = async (
  conversation: ChatStorageConversation,
  draftText: string,
): Promise<SerializedConversationResult> => {
  const assignedImageStorageKeys: AssignedImageStorageKey[] = []
  const files: PersistedConversationFileRecord[] = []
  const transcript: PersistedConversationEvent[] = []

  for (const event of conversation.transcript) {
    if (event.kind === 'user_message') {
      const serializedContent = await serializeTranscriptContent(
        conversation.id,
        event.id,
        event.createdAt,
        event.content,
      )
      files.push(...serializedContent.files)
      assignedImageStorageKeys.push(...serializedContent.assignedImageStorageKeys)
      transcript.push({
        kind: 'user_message',
        id: event.id,
        turnId: event.turnId,
        createdAt: event.createdAt,
        content: serializedContent.content,
      })
      continue
    }

    if (event.kind === 'assistant_message') {
      transcript.push({
        kind: 'assistant_message',
        id: event.id,
        turnId: event.turnId,
        roundId: event.roundId,
        createdAt: event.createdAt,
        rawText: event.rawText,
        assistantFlow: event.assistantFlow,
        reasoning: event.reasoning,
        model: event.model,
        usage: event.usage,
        usageEstimated: event.usageEstimated,
        firstTokenLatencyMs: event.firstTokenLatencyMs,
        totalTimeMs: event.totalTimeMs,
        error: event.error,
      })
      continue
    }

    transcript.push({
      kind: 'host_message',
      id: event.id,
      turnId: event.turnId,
      roundId: event.roundId,
      createdAt: event.createdAt,
      category: event.category,
      payload: event.payload,
    })
  }

  return {
    document: {
      schemaVersion: SCHEMA_VERSION,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        titleManuallyEdited: conversation.titleManuallyEdited,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        draft: {
          text: draftText,
          attachmentIds: [],
        },
        preferences: conversation.preferences,
        transcript,
        files,
      },
    },
    assignedImageStorageKeys,
  }
}

const cleanupConversationFiles = async (
  conversationId: string,
  previousDocument: PersistedConversationDocument | null,
  nextDocument: PersistedConversationDocument,
): Promise<void> => {
  const nextFilePaths = new Set(nextDocument.conversation.files.map((file) => file.relativePath))
  for (const file of previousDocument?.conversation.files ?? []) {
    if (!nextFilePaths.has(file.relativePath)) {
      await deletePath(buildAbsoluteAttachmentPath(conversationId, file.relativePath)).catch(() => {
        // Ignore best-effort orphan cleanup failures.
      })
    }
  }
}

const cleanupDeletedConversations = async (keepConversationIds: Set<string>): Promise<void> => {
  const entries = await listDirectory(CHAT_STORAGE_DIRECTORIES.conversations)
  for (const entry of entries) {
    if (entry.name === 'index.json') {
      continue
    }
    if (!keepConversationIds.has(entry.name)) {
      await deletePath(joinRelativePath(CHAT_STORAGE_DIRECTORIES.conversations, entry.name)).catch(() => {
        // Ignore best-effort cleanup failures.
      })
    }
  }
}

const migrateLegacyStorage = async (): Promise<void> => {
  const legacyState = await loadLegacyChatState()
  const persistedConversations = legacyState.conversations.filter((conversation) =>
    isConversationPersistable(conversation, legacyState.draftsByConversation[conversation.id]),
  )

  await ensureDirectory(CHAT_STORAGE_DIRECTORIES.root)
  await ensureDirectory(CHAT_STORAGE_DIRECTORIES.conversations)

  for (const conversation of persistedConversations) {
    const migratedTranscript = await Promise.all(
      conversation.transcript.map(async (event) => {
        if (event.kind !== 'user_message') {
          return event
        }
        return {
          ...event,
          content: await Promise.all(
            event.content.map(async (part) =>
              part.type !== 'image'
                ? part
                : {
                    type: 'image' as const,
                    image: {
                      ...part.image,
                      dataUrl: await loadLegacyImageDataUrl(part.image),
                    },
                  },
            ),
          ),
        }
      }),
    )
    const migratedResponseMode = inferConversationResponseModeFromTranscript(migratedTranscript)
    const migratedConversation: ChatStorageConversation = {
      ...conversation,
      preferences: migratedResponseMode
        ? {
            responseMode: migratedResponseMode,
          }
        : undefined,
      transcript: migratedTranscript,
    }
    const serialized = await serializeConversation(
      migratedConversation,
      legacyState.draftsByConversation[conversation.id] ?? '',
    )
    const conversationDirectory = buildConversationDirectory(conversation.id)
    await ensureDirectory(conversationDirectory)
    await ensureDirectory(buildConversationFilesDirectory(conversation.id))
    await writeJsonFile(buildConversationDocumentPath(conversation.id), serialized.document)
  }

  await writeIndexFile(
    persistedConversations.map((conversation) =>
      buildConversationSummary(conversation, legacyState.draftsByConversation[conversation.id] ?? ''),
    ),
  )
  const activeConversationId =
    persistedConversations.some((conversation) => conversation.id === legacyState.activeConversationId)
      ? legacyState.activeConversationId
      : undefined
  await writeMetaFile(activeConversationId)

  const migratedState = await loadConversationsFromNewStorage()
  if (migratedState.conversations.length !== persistedConversations.length) {
    throw new Error('Legacy migration verification failed')
  }

  removeLocalStorageItem(LEGACY_CONVERSATIONS_STORAGE_KEY)
  removeLocalStorageItem(LEGACY_MESSAGES_STORAGE_KEY)
  removeLocalStorageItem(LEGACY_DRAFTS_STORAGE_KEY)
  removeLocalStorageItem(LEGACY_ACTIVE_CONVERSATION_STORAGE_KEY)
  removeLocalStorageItem(LEGACY_IMAGE_MANIFEST_STORAGE_KEY)
  clearConversationImageManifest()
  await deletePath('conversation-images').catch(() => {
    // Ignore best-effort cleanup failures.
  })
}

const hasNewStorageArtifacts = async (): Promise<boolean> => {
  if (await pathExists(META_PATH)) {
    return true
  }
  if (await pathExists(INDEX_PATH)) {
    return true
  }
  const conversationEntries = await listConversationIdsFromDirectories()
  return conversationEntries.length > 0
}

const ensureInitialized = async (): Promise<void> => {
  await ensureDirectory(CHAT_STORAGE_DIRECTORIES.root)
  await ensureDirectory(CHAT_STORAGE_DIRECTORIES.conversations)

  const hasNewStorage = await hasNewStorageArtifacts()
  if (hasNewStorage) {
    return
  }
  if (hasLegacyChatState()) {
    await migrateLegacyStorage()
  }
}

export const initializeChatStorage = async (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = ensureInitialized().finally(() => {
      initializationPromise = null
    })
  }
  await initializationPromise
}

export const loadChatState = async (): Promise<ChatStorageState> => {
  await initializeChatStorage()
  return loadConversationsFromNewStorage()
}

const buildIndexStateFromChatState = (
  state: ChatStorageState,
): ChatStorageIndexState => {
  const conversations = sortConversationSummaries(
    state.conversations.map((conversation) =>
      buildConversationSummary(conversation, state.draftsByConversation[conversation.id] ?? ''),
    ),
  )

  return {
    conversations,
    activeConversationId:
      state.activeConversationId && conversations.some((conversation) => conversation.id === state.activeConversationId)
        ? state.activeConversationId
        : '',
    historyStats: buildHistoryStatsFromSummaries(conversations),
  }
}

export const loadChatIndex = async (): Promise<ChatStorageIndexState> => {
  await initializeChatStorage()

  const meta = await readJsonFile<ChatStorageMeta | null>(META_PATH, null)
  const index = await readConversationIndexFile()
  const directoryNames = await listConversationIdsFromDirectories()
  const directoryNameSet = new Set(directoryNames)

  if (!index || index.schemaVersion !== SCHEMA_VERSION) {
    const rebuiltState = buildIndexStateFromChatState(await loadConversationsFromNewStorage())
    await writeIndexFile(rebuiltState.conversations)
    return rebuiltState
  }

  const indexedDirectoryNames = new Set(index.conversations.map((conversation) => sanitizePathSegment(conversation.id)))
  const nextConversations = index.conversations.filter((conversation) =>
    directoryNameSet.has(sanitizePathSegment(conversation.id)),
  )
  const missingDirectoryNames = directoryNames.filter((directoryName) => !indexedDirectoryNames.has(directoryName))

  if (missingDirectoryNames.length > 0) {
    for (const directoryName of missingDirectoryNames) {
      const document = await readConversationDocument(directoryName)
      if (!document) {
        continue
      }
      const loaded = hydrateConversationDocument(document)
      nextConversations.push(buildConversationSummary(loaded.conversation, loaded.draftText))
    }
  }

  const sortedConversations = sortConversationSummaries(nextConversations)
  const rebuiltHistoryStats = buildHistoryStatsFromSummaries(sortedConversations)
  const needsIndexRewrite =
    sortedConversations.length !== index.conversations.length ||
    missingDirectoryNames.length > 0 ||
    !directoryNames.every((directoryName) => indexedDirectoryNames.has(directoryName)) ||
    JSON.stringify(index.historyStats) !== JSON.stringify(rebuiltHistoryStats)

  if (needsIndexRewrite) {
    await writeIndexFile(sortedConversations)
  }

  return {
    conversations: sortedConversations,
    activeConversationId:
      typeof meta?.activeConversationId === 'string' &&
      sortedConversations.some((conversation) => conversation.id === meta.activeConversationId)
        ? meta.activeConversationId
        : '',
    historyStats: rebuiltHistoryStats,
  }
}

export const loadConversationState = async (
  conversationId: string,
): Promise<LoadedChatStorageConversation | null> => {
  await initializeChatStorage()
  const document = await readConversationDocument(conversationId)
  if (!document) {
    return null
  }

  const loaded = hydrateConversationDocument(document)

  if (loaded.needsMigration) {
    const serialized = await serializeConversation(loaded.conversation, loaded.draftText)
    await ensureDirectory(buildConversationDirectory(conversationId))
    await ensureDirectory(buildConversationFilesDirectory(conversationId))
    await writeJsonFile(buildConversationDocumentPath(conversationId), serialized.document)
  }

  return {
    conversation: loaded.conversation,
    draftText: loaded.draftText,
  }
}

export const loadStoredAttachmentDataUrl = async (
  storageKey: string,
  mimeType: string,
): Promise<string | null> => {
  try {
    const base64 = await readBase64File(storageKey)
    if (!base64) {
      return null
    }
    return `data:${mimeType || 'application/octet-stream'};base64,${base64}`
  } catch {
    return null
  }
}

export const persistChatState = async (state: ChatStoragePersistState): Promise<PersistChatStorageResult> => {
  await initializeChatStorage()

  const persistedConversations = state.conversations.filter((conversation) =>
    conversation.kind === 'hydrated'
      ? isConversationPersistable(conversation.conversation, conversation.draftText)
      : isConversationSummaryPersistable(conversation.summary),
  )
  const keepConversationIds = new Set(
    persistedConversations.map((conversation) =>
      sanitizePathSegment(conversation.kind === 'hydrated' ? conversation.conversation.id : conversation.summary.id),
    ),
  )
  const assignedImageStorageKeys: AssignedImageStorageKey[] = []
  const nextSummaries: ChatStorageConversationSummary[] = []

  for (const conversation of persistedConversations) {
    if (conversation.kind === 'summary') {
      nextSummaries.push(conversation.summary)
      continue
    }

    const previousDocument = await readConversationDocument(conversation.conversation.id)
    const serialized = await serializeConversation(
      conversation.conversation,
      conversation.draftText,
    )
    await ensureDirectory(buildConversationDirectory(conversation.conversation.id))
    await ensureDirectory(buildConversationFilesDirectory(conversation.conversation.id))
    await writeJsonFile(buildConversationDocumentPath(conversation.conversation.id), serialized.document)
    await cleanupConversationFiles(conversation.conversation.id, previousDocument, serialized.document)
    assignedImageStorageKeys.push(...serialized.assignedImageStorageKeys)
    nextSummaries.push(buildConversationSummary(conversation.conversation, conversation.draftText))
  }

  await cleanupDeletedConversations(keepConversationIds)
  await writeIndexFile(nextSummaries)

  const persistedConversationIdSet = new Set(
    persistedConversations.map((conversation) =>
      conversation.kind === 'hydrated' ? conversation.conversation.id : conversation.summary.id,
    ),
  )
  await writeMetaFile(
    persistedConversationIdSet.has(state.activeConversationId) ? state.activeConversationId : undefined,
  )

  return {
    assignedImageStorageKeys,
    signature: createStateSignature(state),
  }
}

export const getChatStatePersistenceSignature = createStateSignature

export const deleteConversationStorage = async (conversationId: string): Promise<void> => {
  await initializeChatStorage()
  await deletePath(buildConversationDirectory(conversationId))
  await deleteSkillHostPath(joinSkillRelativePath('skill-host/state/run-sessions', conversationId)).catch(() => {
    // Ignore best-effort cleanup failures for run session state.
  })
}
