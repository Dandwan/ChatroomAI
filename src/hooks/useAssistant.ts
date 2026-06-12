// useAssistant hook — extracts chat-send / assistant-turn logic from App.tsx.
// All helpers currently shared with App.tsx are duplicated here for independent extraction;
// eventually App.tsx will delegate to this hook.

import { useCallback, useRef } from 'react'

import { Haptics, ImpactStyle } from '@capacitor/haptics'

import {
  requestNonStreamCompletion,
  requestStreamCompletion,
  type ApiMessage,
} from '../services/chat-api'
import {
  buildApiMessagesFromTranscript,
  createConversationFromTranscript,
  createUserMessageTranscriptEvent,
  normalizeConversationResponseMode,
  projectConversationMessages,
  withConversationTranscript,
  type AssistantMessageTranscriptEvent,
  type HostMessageTranscriptEvent,
  type TranscriptContentPart,
  type TranscriptEvent,
  type UserMessageTranscriptEvent,
} from '../services/chat-transcript'
import {
  executeEditAction,
  executeReadAction,
  executeRunAction,
  executeSkillCall,
  materializeRunAction,
} from '../services/skills/executor'
import {
  createAgentStreamParser,
  createSkillActionPlaceholder,
  buildPromptBlocksText,
  buildRuntimeCatalogBlock,
  buildSkillsCatalogBlock,
  formatStructuredMarkdown,
  normalizeSkillAgentProtocolResponse,
  type SkillActionStreamEvent,
} from '../services/skills/protocol'
import { buildEnvVarPath } from '../services/skills/action-location'
import type { InternalActionLocation } from '../services/skills/action-location'
import {
  buildDeviceInfoPromptMarkdown,
  buildWorkspaceInfoPromptMarkdown,
  createDeviceInfoPromptSnapshot,
  createWorkspaceInfoPromptSnapshot,
  resolveWorkspaceInfoPromptPath,
  type InfoPromptSettingKey,
} from '../services/skills/info-system-prompts'
import { getEffectiveActiNetModels } from '../services/actinet-models'
import { isCloudLoggedIn, getStoredCloudAuth, getCloudServerUrl } from '../services/cloud-auth'
import {
  appendAssistantFlowContent,
  appendAssistantFlowDivider,
  assistantFlowToPlainText,
  clearAssistantFlowRound,
  createAssistantTextFlow,
  markAssistantFlowRoundError,
  upsertAssistantFlowSkillNodeByToken,
  type AssistantFlowNode,
} from '../utils/assistant-flow'
import { createImageAttachments } from '../utils/images'
import {
  DEBUG_SKILL_ROUND_LOG_STORAGE_KEY,
  DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY,
  truncateDebugLogText,
  normalizePromptMessagesForDebug,
  readDebugLogEntries,
  appendDebugLogEntry,
  clearDebugLogEntries,
  buildDebugLogReportText,
} from '../utils/app-debug'

import { useUIStore } from '../state/ui-store'
import { useChatStore } from '../state/chat-store'
import { useSettingsStore } from '../state/settings-store'
import { useExtensionsStore } from '../state/extensions-store'

import type {
  ActiveProviderRequestSettings,
  AppSettings,
  CompletionResult,
  Conversation,
  ConversationResponseMode,
  EnabledModelOption,
  ImageAttachment,
  PendingImageAttachment,
  PromptEditorKey,
  SkillStepKind,
  TokenUsage,
  TurnExecutionJob,
  TurnExecutionOutcome,
} from '../state/types'

import type {
  EditAction,
  EditExecutionResult,
  ReadExecutionResult,
  PromptBlock,
  ReadAction,
  RunAction,
  RuntimeRecord,
  SkillCallAction,
  SkillRecord,
} from '../services/skills/types'

// ── Constants ────────────────────────────────────────────────────────────────

const ACTINET_PROVIDER_ID = '__actinet__'
const ACTINET_PROVIDER_NAME = 'ActiNet'

const TRANSCRIPT_REPLAY_SYSTEM_PROMPT = `
历史上下文会以原始多轮转录的形式回放：

1. 历史 assistant 输出中可能出现 <progress>、<read>、<run>、<edit>、<final> 等标签，它们只是历史记录，不会再次执行。
2. 宿主会以 user 角色注入 <host_message>...</host_message> 作为工具结果或运行时反馈；这些内容不是用户新的自然语言输入。
3. 只有你当前正在生成的这一次回复中的动作标签会被宿主解析和执行。
`.trim()

// ── Module-level helpers ────────────────────────────────────────────────────

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const vibrateInteraction = (): void => {
  void Haptics.vibrate({ duration: 10 }).catch(() => {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10)
      }
    })
  })
}

// ── Serializers (used by executeAssistantTurn / handlers) ───────────────────

const serializeReadActionForHost = (
  action: Pick<ReadAction, 'root' | 'skill' | 'path' | 'depth' | 'startLine' | 'endLine'>,
): Record<string, unknown> => ({
  ...(action.path !== undefined ? { path: buildEnvVarPath(action.root, action.skill, action.path) } : {}),
  ...(action.depth !== undefined ? { depth: action.depth } : {}),
  ...(action.startLine !== undefined ? { startLine: action.startLine } : {}),
  ...(action.endLine !== undefined ? { endLine: action.endLine } : {}),
})

const resolveReadActionDisplayPath = (
  action: Pick<ReadAction, 'root' | 'path'>,
): string | undefined => {
  const normalizedPath = action.path?.trim()
  if (normalizedPath) {
    return normalizedPath
  }
  return undefined
}

const serializeReadResultForHost = (payload: ReadExecutionResult): Record<string, unknown> => ({
  kind: payload.kind,
  path: buildEnvVarPath(payload.root, 'skill' in payload ? payload.skill : undefined, payload.path),
  ...(payload.kind === 'list'
    ? {
        depth: payload.depth,
        entries: payload.entries,
        truncated: payload.truncated,
      }
    : payload.kind === 'stat'
      ? {
          entryType: payload.entryType,
          ...(payload.size !== undefined ? { size: payload.size } : {}),
          ...(payload.textLikely !== undefined ? { textLikely: payload.textLikely } : {}),
        }
      : {
          content: payload.content,
          lineStart: payload.lineStart,
          lineEnd: payload.lineEnd,
          truncated: payload.truncated,
        }),
})

const serializeRunActionForHost = (
  action: Pick<RunAction, 'id' | 'root' | 'skill' | 'command' | 'session' | 'waitMs'>,
): Record<string, unknown> => ({
  ...(action.id ? { id: action.id } : {}),
  ...(action.command ? { command: action.command } : {}),
  ...(action.session ? { session: action.session } : {}),
  ...(action.waitMs !== undefined ? { waitMs: action.waitMs } : {}),
})

const serializeEditActionForHost = (
  action: Pick<EditAction, 'root' | 'path' | 'createIfMissing' | 'previewContextLines' | 'edits'>,
): Record<string, unknown> => ({
  path: buildEnvVarPath(action.root, undefined, action.path),
  ...(action.createIfMissing ? { createIfMissing: true } : {}),
  ...(action.previewContextLines !== undefined ? { previewContextLines: action.previewContextLines } : {}),
  edits: action.edits,
})

const serializeEditResultForHost = (payload: EditExecutionResult): Record<string, unknown> => ({
  kind: payload.kind,
  path: buildEnvVarPath(payload.root, undefined, payload.path),
  created: payload.created,
  lineCountBefore: payload.lineCountBefore,
  lineCountAfter: payload.lineCountAfter,
  appliedEdits: payload.appliedEdits,
  preview: payload.preview,
})

const formatSkillStepResult = (payload: unknown): string =>
  formatStructuredMarkdown(payload)

// ── Transcript builders ─────────────────────────────────────────────────────

const buildUserTranscriptContent = (
  text: string,
  images: ImageAttachment[] = [],
): TranscriptContentPart[] => [
  ...(text.length > 0 ? ([{ type: 'text', text }] as const) : []),
  ...images.map((image) => ({
    type: 'image' as const,
    image,
  })),
]

const buildOutgoingImageAttachments = (
  pendingImages: PendingImageAttachment[],
): ImageAttachment[] =>
  pendingImages.map((image) => ({
    id: image.id,
    name: image.name,
    mimeType: image.mimeType,
    size: image.size,
    dataUrl: image.dataUrl,
  }))

const getUserTranscriptText = (event: UserMessageTranscriptEvent): string =>
  event.content
    .filter((part): part is Extract<TranscriptContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')

const createStaticAssistantEvent = (
  turnId: string,
  text: string,
  model?: string,
): AssistantMessageTranscriptEvent => ({
  kind: 'assistant_message',
  id: createId(),
  turnId,
  createdAt: Date.now(),
  rawText: text,
  assistantFlow: text ? createAssistantTextFlow(text, { createId }) : undefined,
  model,
})

// ── Permission gates ────────────────────────────────────────────────────────

const applyPermissionGatesToSkillCall = (
  action: SkillCallAction,
  permissionToggles: { location: boolean },
): SkillCallAction => {
  if (action.skill !== 'device-info') {
    return action
  }
  if (permissionToggles.location) {
    return action
  }
  const argv = Array.isArray(action.argv) ? [...action.argv] : []
  if (!argv.includes('--no-location')) {
    argv.push('--no-location')
  }
  return {
    ...action,
    argv,
  }
}

const applyPermissionGatesToRun = (
  action: RunAction,
  permissionToggles: { location: boolean },
): RunAction => {
  if (action.root !== 'skill' || action.skill !== 'device-info') {
    return action
  }
  if (permissionToggles.location) {
    return action
  }
  const command = action.command?.trim()
  if (!command || /\s--no-location(?:\s|$)/.test(` ${command} `)) {
    return action
  }
  return {
    ...action,
    command: `${command} --no-location`,
  }
}

// ── System prompt builder ───────────────────────────────────────────────────

const buildSkillAgentSystemPrompt = async (
  settings: Pick<ActiveProviderRequestSettings, PromptEditorKey | InfoPromptSettingKey>,
  skills: SkillRecord[],
  runtimes: RuntimeRecord[],
  conversationId: string,
  transcript: TranscriptEvent[],
): Promise<string> => {
  const conversationSnapshot = createConversationFromTranscript(conversationId, transcript)
  const workspacePath = settings.workspaceInfoPromptEnabled
    ? await resolveWorkspaceInfoPromptPath(conversationSnapshot.id)
    : ''
  const workspaceInfoPrompt = settings.workspaceInfoPromptEnabled
    ? buildWorkspaceInfoPromptMarkdown(
        createWorkspaceInfoPromptSnapshot(
          workspacePath,
          conversationSnapshot.createdAt,
          conversationSnapshot.updatedAt,
        ),
      )
    : ''
  const deviceInfoPrompt = settings.deviceInfoPromptEnabled
    ? buildDeviceInfoPromptMarkdown(createDeviceInfoPromptSnapshot())
    : ''
  const environmentBlocks: PromptBlock[] = [
    {
      type: 'app_policy',
      title: 'Transcript Replay Semantics',
      content: TRANSCRIPT_REPLAY_SYSTEM_PROMPT,
    },
    buildSkillsCatalogBlock(skills),
    buildRuntimeCatalogBlock(runtimes),
  ]

  return [
    settings.systemPrompt.trim(),
    settings.generalTagSystemPrompt.trim(),
    settings.topLevelTagSystemPrompt.trim(),
    settings.readSystemPrompt.trim(),
    workspaceInfoPrompt,
    settings.skillCallSystemPrompt.trim(),
    settings.editSystemPrompt.trim(),
    deviceInfoPrompt,
    buildPromptBlocksText(environmentBlocks),
  ]
    .filter(Boolean)
    .join('\n\n')
}

// ── Action execution payload parser ────────────────────────────────────────

const parseActionExecutionPayload = (
  action: SkillCallAction | RunAction,
  stdout: string,
  stderr: string,
): Record<string, unknown> => {
  const metadata =
    action.kind === 'run'
      ? {
          id: action.id,
          command: action.command,
          session: action.session,
        }
      : {
          id: action.id,
          skill: action.skill,
          script: action.script,
        }
  const trimmedStdout = stdout.trim()
  if (!trimmedStdout) {
    return {
      ...metadata,
      stdout: '',
      stderr: stderr.trim(),
    }
  }

  try {
    const parsed = JSON.parse(trimmedStdout) as unknown
    if (isRecord(parsed)) {
      return {
        ...metadata,
        ...parsed,
        stderr: stderr.trim() || undefined,
      }
    }
  } catch {
    // Fall through to raw payload.
  }

  return {
    ...metadata,
    stdout: trimmedStdout,
    stderr: stderr.trim() || undefined,
  }
}

// ── Settings helpers ─────────────────────────────────────────────────────────

const getEnabledModelOptions = (
  providers: AppSettings['providers'],
  isActiNetLoggedIn: boolean,
  otherProvidersEnabled: boolean,
): EnabledModelOption[] => {
  const providerOptions = otherProvidersEnabled
    ? providers.flatMap((provider) =>
        provider.models
          .filter((model) => model.enabled)
          .map((model) => ({
            providerId: provider.id,
            providerName: provider.name,
            modelId: model.id,
          })),
      )
    : []

  if (isActiNetLoggedIn) {
    const activeModels = getEffectiveActiNetModels()
    const actiNetOptions = activeModels
      .filter((model) => model.enabled)
      .map((model) => ({
        providerId: ACTINET_PROVIDER_ID,
        providerName: ACTINET_PROVIDER_NAME,
        modelId: model.id,
      }))
    return [...providerOptions, ...actiNetOptions]
  }

  return providerOptions
}

const resolveProviderRequestSettings = (settings: AppSettings): ActiveProviderRequestSettings | null => {
  // Handle ActiNet virtual provider
  if (settings.currentProviderId === ACTINET_PROVIDER_ID) {
    const cloudAuth = getStoredCloudAuth()
    if (!cloudAuth || !cloudAuth.apiKey) return null

    const effective = getEffectiveActiNetModels()
    const model = effective.find((m) => m.id === settings.currentModel && m.enabled)
    if (!model) return null

    return {
      providerId: ACTINET_PROVIDER_ID,
      providerName: ACTINET_PROVIDER_NAME,
      apiBaseUrl: getCloudServerUrl(),
      apiKey: cloudAuth.apiKey,
      currentModel: model.id,
      systemPrompt: settings.systemPrompt,
      topLevelTagSystemPrompt: settings.topLevelTagSystemPrompt,
      generalTagSystemPrompt: settings.generalTagSystemPrompt,
      readSystemPrompt: settings.readSystemPrompt,
      skillCallSystemPrompt: settings.skillCallSystemPrompt,
      editSystemPrompt: settings.editSystemPrompt,
      deviceInfoPromptEnabled: settings.deviceInfoPromptEnabled,
      workspaceInfoPromptEnabled: settings.workspaceInfoPromptEnabled,
      temperature: settings.temperature,
      topP: settings.topP,
      maxTokens: settings.maxTokens,
      presencePenalty: settings.presencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      maxModelRetryCount: settings.maxModelRetryCount,
    }
  }

  const provider = settings.providers.find((item) => item.id === settings.currentProviderId)
  if (!provider) {
    return null
  }

  const model = provider.models.find((item) => item.id === settings.currentModel && item.enabled)
  if (!model) {
    return null
  }

  return {
    providerId: provider.id,
    providerName: provider.name,
    apiBaseUrl: provider.apiBaseUrl,
    apiKey: provider.apiKey,
    currentModel: model.id,
    systemPrompt: provider.systemPrompt ?? settings.systemPrompt,
    topLevelTagSystemPrompt: provider.topLevelTagSystemPrompt ?? settings.topLevelTagSystemPrompt,
    generalTagSystemPrompt: provider.generalTagSystemPrompt ?? settings.generalTagSystemPrompt,
    readSystemPrompt: provider.readSystemPrompt ?? settings.readSystemPrompt,
    skillCallSystemPrompt: provider.skillCallSystemPrompt ?? settings.skillCallSystemPrompt,
    editSystemPrompt: provider.editSystemPrompt ?? settings.editSystemPrompt,
    deviceInfoPromptEnabled: provider.deviceInfoPromptEnabled ?? settings.deviceInfoPromptEnabled,
    workspaceInfoPromptEnabled:
      provider.workspaceInfoPromptEnabled ?? settings.workspaceInfoPromptEnabled,
    temperature: provider.temperature ?? settings.temperature,
    topP: provider.topP ?? settings.topP,
    maxTokens: provider.maxTokens ?? settings.maxTokens,
    presencePenalty: provider.presencePenalty ?? settings.presencePenalty,
    frequencyPenalty: provider.frequencyPenalty ?? settings.frequencyPenalty,
    maxModelRetryCount: provider.maxModelRetryCount ?? settings.maxModelRetryCount,
  }
}

// ── Transcript / conversation helpers ────────────────────────────────────────

const toHydratedConversation = (
  conversation: Conversation,
  _draftText = '',
): Conversation => ({
  ...conversation,
  storageLoadState: 'hydrated' as const,
  storageLoadError: undefined,
})

const withConversationRecordTranscript = (
  conversation: Conversation,
  transcript: TranscriptEvent[],
  draftText: string,
  options?: {
    keepUpdatedAt?: boolean
  },
): Conversation =>
  toHydratedConversation(
    withConversationTranscript(conversation, transcript, options) as Conversation,
    draftText,
  )

const resolveConversationResponseMode = (
  conversation: Pick<Conversation, 'preferences'> | null,
  defaultResponseMode: ConversationResponseMode,
): ConversationResponseMode =>
  normalizeConversationResponseMode(conversation?.preferences?.responseMode) ?? defaultResponseMode

// ── Text helpers ────────────────────────────────────────────────────────────

const extractThinkBlocks = (text: string): { cleanedText: string; reasoning: string } => {
  const thinkRegex = /(?:^|\n) *<think>(?:\n)?([\s\S]*?)(?:\n)?<\/think> *(?:\n|$)/gi
  const reasoningParts: string[] = []
  const cleanedText = text.replace(thinkRegex, (_match, inner: string) => {
    reasoningParts.push(inner.trim())
    return '\n'
  })
  return {
    cleanedText: cleanedText.trim(),
    reasoning: reasoningParts.join('\n\n').trim(),
  }
}

const estimateUsage = (promptMessages: ApiMessage[], responseText: string): TokenUsage => {
  let promptTokens = 0
  for (const message of promptMessages) {
    const content =
      typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map((part) => (typeof part === 'string' ? part : part.type === 'text' ? part.text : '')).join(' ')
          : ''
    promptTokens += Math.ceil(content.length / 3.5)
  }
  const completionTokens = Math.ceil(responseText.length / 3.5)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

// ── applyAssistantFlowState (pure helper) ───────────────────────────────────

const applyAssistantFlowState = (
  event: AssistantMessageTranscriptEvent,
  nextFlow: AssistantFlowNode[] | undefined,
): AssistantMessageTranscriptEvent => {
  const normalizedFlow = nextFlow && nextFlow.length > 0 ? nextFlow : undefined
  if (normalizedFlow === event.assistantFlow) {
    return event
  }
  return {
    ...event,
    assistantFlow: normalizedFlow,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// useAssistant hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useAssistant() {
  // ── Refs for internal (non-store) state ──────────────────────────────────
  const queuedTurnExecutionsRef = useRef<TurnExecutionJob[]>([])
  const processingTurnQueueRef = useRef(false)
  const queuedAssistantStreamDeltaRef = useRef<{
    conversationId: string
    assistantId: string
    content: string
    reasoning: string
    roundId?: string
  } | null>(null)
  const queuedAssistantStreamDeltaAnimationFrameRef = useRef<number | null>(null)
  const lastSkillRoundLogKeyRef = useRef<string>('')
  const lastObjectFlowLogKeyRef = useRef<string>('')
  const pendingImageCompressionTaskIdRef = useRef<Record<string, number>>({})

  // ── Debug log helpers ──────────────────────────────────────────────────
  const appendSkillRoundLog = useCallback(
    (payload: Record<string, unknown>, dedupeKey?: string): void => {
      if (dedupeKey && lastSkillRoundLogKeyRef.current === dedupeKey) {
        return
      }
      if (dedupeKey) {
        lastSkillRoundLogKeyRef.current = dedupeKey
      }
      const entry = {
        timestamp: new Date().toISOString(),
        ...payload,
      }
      appendDebugLogEntry(DEBUG_SKILL_ROUND_LOG_STORAGE_KEY, entry)
      console.info(`[debug][skill-round] ${JSON.stringify(entry)}`)
    },
    [],
  )

  const appendObjectFlowLog = useCallback(
    (payload: Record<string, unknown>, dedupeKey?: string): void => {
      if (dedupeKey && lastObjectFlowLogKeyRef.current === dedupeKey) {
        return
      }
      if (dedupeKey) {
        lastObjectFlowLogKeyRef.current = dedupeKey
      }
      const entry = {
        timestamp: new Date().toISOString(),
        ...payload,
      }
      appendDebugLogEntry(DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY, entry)
      console.info(`[debug][object-flow] ${JSON.stringify(entry)}`)
    },
    [],
  )

  // ── UI/notice helpers ──────────────────────────────────────────────────
  const pushNotice = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info'): void => {
    useUIStore.getState().setNotice({ text, type })
  }, [])

  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }, [])

  // ── Derived state accessors (always read fresh via getState) ────────────
  const getActiveConversation = useCallback((): Conversation | null => {
    const { conversations, activeConversationId } = useChatStore.getState()
    return conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? null
  }, [])

  const getActiveConversationResponseMode = useCallback((): ConversationResponseMode => {
    const conversation = getActiveConversation()
    const { settings } = useSettingsStore.getState()
    return resolveConversationResponseMode(conversation, settings.defaultResponseMode)
  }, [getActiveConversation])

  const getActiveProviderRequestSettings = useCallback((): ActiveProviderRequestSettings | null => {
    const { settings } = useSettingsStore.getState()
    return resolveProviderRequestSettings(settings)
  }, [])

  const getCanSend = useCallback((): boolean => {
    const conversation = getActiveConversation()
    if (!conversation) return false
    const { draftsByConversation, pendingImages } = useChatStore.getState()
    const draft = draftsByConversation[conversation.id] ?? ''
    const isSending = useUIStore.getState().isSending
    const hasPayload = draft.trim().length > 0 || pendingImages.length > 0
    return hasPayload && !isSending
  }, [getActiveConversation])

  // ── ensureReadyToRequest ────────────────────────────────────────────────
  const ensureReadyToRequest = useCallback((): boolean => {
    const settings = getActiveProviderRequestSettings()
    if (!settings) {
      pushNotice('请先选择已启用模型。', 'error')
      const allSettings = useSettingsStore.getState().settings
      const enabledModels = getEnabledModelOptions(allSettings.providers, isCloudLoggedIn(), allSettings.otherProvidersEnabled)
      if (enabledModels.length === 0) {
        useUIStore.getState().setSettingsVisibility(true, true)
        useUIStore.getState().navigateSettingsView('providers')
      } else {
        useUIStore.getState().setModelMenuVisibility(true, false)
      }
      useUIStore.getState().setDrawerVisibility(true, false)
      return false
    }

    if (!settings.apiBaseUrl.trim() || !settings.apiKey.trim()) {
      pushNotice('请先在服务商设置中填写 URL 和 API Key。', 'error')
      useUIStore.getState().setSettingsVisibility(true, true)
      useUIStore.getState().setProviderDetailTargetId(settings.providerId)
      useUIStore.getState().setDrawerVisibility(true, false)
      return false
    }
    return true
  }, [getActiveProviderRequestSettings, pushNotice])

  // ── Transcript mutation helpers (operate on store directly) ─────────────
  const updateConversationTranscript = useCallback(
    (conversationId: string, transcript: TranscriptEvent[]): void => {
      const { conversations, setConversations, draftsByConversation } = useChatStore.getState()
      setConversations(
        conversations.map((conversation) =>
          conversation.id === conversationId
            ? withConversationRecordTranscript(
                conversation,
                transcript,
                draftsByConversation[conversation.id] ?? '',
              )
            : conversation,
        ),
      )
    },
    [],
  )

  const updateConversationDraft = useCallback((conversationId: string, nextDraft: string): void => {
    useChatStore.getState().setDraftsByConversation((previous) => {
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
      return { ...previous, [conversationId]: nextDraft }
    })
  }, [])

  const resetComposerState = useCallback(
    (conversationId: string): void => {
      updateConversationDraft(conversationId, '')
      pendingImageCompressionTaskIdRef.current = {}
      useChatStore.getState().setPendingImages([])
      useUIStore.getState().setEditingMessage(null)
      useUIStore.getState().setModelMenuVisibility(true, false)
    },
    [updateConversationDraft],
  )

  const appendConversationTranscriptEvents = useCallback(
    (conversationId: string, events: TranscriptEvent[]): void => {
      if (events.length === 0) return
      const { conversations, setConversations, draftsByConversation } = useChatStore.getState()
      setConversations(
        conversations.map((conversation) =>
          conversation.id === conversationId
            ? withConversationRecordTranscript(
                conversation,
                [...conversation.transcript, ...events],
                draftsByConversation[conversation.id] ?? '',
              )
            : conversation,
        ),
      )
    },
    [],
  )

  const updateAssistantEvent = useCallback(
    (
      conversationId: string,
      assistantId: string,
      updater: (event: AssistantMessageTranscriptEvent) => AssistantMessageTranscriptEvent,
    ): void => {
      const { conversations, setConversations, draftsByConversation } = useChatStore.getState()
      setConversations(
        conversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation
          let hasUpdatedEvent = false
          const nextTranscript = conversation.transcript.map((event) => {
            if (event.kind !== 'assistant_message' || event.id !== assistantId) return event
            const nextEvent = updater(event)
            if (nextEvent === event) return event
            hasUpdatedEvent = true
            return nextEvent
          })
          return hasUpdatedEvent
            ? withConversationRecordTranscript(conversation, nextTranscript, draftsByConversation[conversation.id] ?? '')
            : conversation
        }),
      )
    },
    [],
  )

  const updateAssistantFlow = useCallback(
    (
      conversationId: string,
      assistantId: string,
      updater: (flow: AssistantFlowNode[] | undefined, event: AssistantMessageTranscriptEvent) => AssistantFlowNode[] | undefined,
    ): void => {
      updateAssistantEvent(conversationId, assistantId, (event) => {
        const nextFlow = updater(event.assistantFlow, event)
        if (nextFlow === event.assistantFlow) return event
        return applyAssistantFlowState(event, nextFlow)
      })
    },
    [updateAssistantEvent],
  )

  const appendAssistantFlowRoundDivider = useCallback(
    (conversationId: string, assistantId: string, roundId: string, explanation?: string): void => {
      updateAssistantFlow(conversationId, assistantId, (flow) => {
        const nextFlow = appendAssistantFlowDivider(flow, { createId, roundId }, explanation)
        if (nextFlow === flow) return flow
        appendObjectFlowLog(
          {
            event: 'assistant_flow_add_divider',
            conversationId,
            assistantId,
            roundId,
            previousNodeCount: flow?.length ?? 0,
            explanationPreview: explanation ? truncateDebugLogText(explanation, 160) : undefined,
          },
          `flow-divider:${assistantId}:${roundId}:${flow?.length ?? 0}`,
        )
        return nextFlow
      })
    },
    [updateAssistantFlow, appendObjectFlowLog],
  )

  const clearAssistantFlowRoundState = useCallback(
    (conversationId: string, assistantId: string, roundId: string): void => {
      updateAssistantFlow(conversationId, assistantId, (flow) => {
        const nextFlow = clearAssistantFlowRound(flow, roundId)
        if (nextFlow === flow) return flow
        appendObjectFlowLog(
          {
            event: 'assistant_flow_clear_round',
            conversationId,
            assistantId,
            roundId,
            previousNodeCount: flow?.length ?? 0,
            nextNodeCount: nextFlow?.length ?? 0,
          },
          `flow-clear-round:${assistantId}:${roundId}:${flow?.length ?? 0}->${nextFlow?.length ?? 0}`,
        )
        return nextFlow
      })
    },
    [updateAssistantFlow, appendObjectFlowLog],
  )

  // ── Streaming helpers ───────────────────────────────────────────────────
  const flushQueuedAssistantStreamDelta = useCallback((): void => {
    if (queuedAssistantStreamDeltaAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(queuedAssistantStreamDeltaAnimationFrameRef.current)
      queuedAssistantStreamDeltaAnimationFrameRef.current = null
    }
    const queuedDelta = queuedAssistantStreamDeltaRef.current
    if (!queuedDelta) return
    queuedAssistantStreamDeltaRef.current = null
    updateAssistantEvent(queuedDelta.conversationId, queuedDelta.assistantId, (event) => {
      const content = queuedDelta.content
      const reasoning = queuedDelta.reasoning
      const previousFlow = event.assistantFlow
      const appendResult = content
        ? appendAssistantFlowContent(event.assistantFlow, content, { createId, roundId: queuedDelta.roundId })
        : { flow: event.assistantFlow, plainTextDelta: '' }
      const nextFlow = appendResult.flow
      const currentReasoning = event.reasoning ?? ''
      const nextReasoning = reasoning ? `${currentReasoning}${reasoning}` : currentReasoning
      const nextEvent = nextFlow === event.assistantFlow ? event : applyAssistantFlowState(event, nextFlow)
      if (nextEvent === event && nextReasoning === currentReasoning && event.error === undefined) return event
      if (appendResult.plainTextDelta) {
        appendObjectFlowLog(
          {
            event: 'assistant_text_append',
            conversationId: queuedDelta.conversationId,
            assistantId: queuedDelta.assistantId,
            roundId: queuedDelta.roundId ?? null,
            appendedLength: appendResult.plainTextDelta.length,
            appendedPreview: truncateDebugLogText(appendResult.plainTextDelta, 200),
            nextTextLength: assistantFlowToPlainText(nextFlow).length,
          },
          `text-append:${queuedDelta.assistantId}:${assistantFlowToPlainText(nextFlow).length}:${appendResult.plainTextDelta.length}`,
        )
      }
      if (nextFlow !== previousFlow) {
        appendObjectFlowLog(
          {
            event: 'assistant_flow_update',
            conversationId: queuedDelta.conversationId,
            assistantId: queuedDelta.assistantId,
            roundId: queuedDelta.roundId ?? null,
            previousNodeCount: previousFlow?.length ?? 0,
            nextNodeCount: nextFlow?.length ?? 0,
          },
          `flow-update:${queuedDelta.assistantId}:${queuedDelta.roundId ?? 'none'}:${previousFlow?.length ?? 0}->${nextFlow?.length ?? 0}`,
        )
      }
      return { ...nextEvent, reasoning: nextReasoning || undefined, error: undefined }
    })
  }, [updateAssistantEvent, appendObjectFlowLog])

  const appendAssistantStreamDelta = useCallback(
    (conversationId: string, assistantId: string, delta: { content?: string; reasoning?: string; roundId?: string }): void => {
      const content = delta.content ?? ''
      const reasoning = delta.reasoning ?? ''
      if (!content && !reasoning) return
      const queuedDelta = queuedAssistantStreamDeltaRef.current
      if (queuedDelta && (queuedDelta.conversationId !== conversationId || queuedDelta.assistantId !== assistantId || queuedDelta.roundId !== delta.roundId)) {
        flushQueuedAssistantStreamDelta()
      }
      const nextQueued = queuedAssistantStreamDeltaRef.current
      if (!nextQueued) {
        queuedAssistantStreamDeltaRef.current = { conversationId, assistantId, content, reasoning, roundId: delta.roundId }
      } else {
        nextQueued.content += content
        nextQueued.reasoning += reasoning
        nextQueued.roundId = nextQueued.roundId ?? delta.roundId
      }
      if (queuedAssistantStreamDeltaAnimationFrameRef.current !== null) return
      queuedAssistantStreamDeltaAnimationFrameRef.current = window.requestAnimationFrame(() => {
        queuedAssistantStreamDeltaAnimationFrameRef.current = null
        const frameQueuedDelta = queuedAssistantStreamDeltaRef.current
        if (!frameQueuedDelta) return
        queuedAssistantStreamDeltaRef.current = null
        updateAssistantEvent(frameQueuedDelta.conversationId, frameQueuedDelta.assistantId, (event) => {
          const appendResult = frameQueuedDelta.content
            ? appendAssistantFlowContent(event.assistantFlow, frameQueuedDelta.content, { createId, roundId: frameQueuedDelta.roundId })
            : { flow: event.assistantFlow, plainTextDelta: '' }
          const nextFlow = appendResult.flow
          const currentReasoning = event.reasoning ?? ''
          const nextReasoning = frameQueuedDelta.reasoning ? `${currentReasoning}${frameQueuedDelta.reasoning}` : currentReasoning
          const nextEvent = nextFlow === event.assistantFlow ? event : applyAssistantFlowState(event, nextFlow)
          if (nextEvent === event && nextReasoning === currentReasoning && event.error === undefined) return event
          if (appendResult.plainTextDelta) {
            appendObjectFlowLog(
              {
                event: 'assistant_text_append',
                conversationId: frameQueuedDelta.conversationId,
                assistantId: frameQueuedDelta.assistantId,
                roundId: frameQueuedDelta.roundId ?? null,
                appendedLength: appendResult.plainTextDelta.length,
                appendedPreview: truncateDebugLogText(appendResult.plainTextDelta, 200),
                nextTextLength: assistantFlowToPlainText(nextFlow).length,
              },
              `text-append:${frameQueuedDelta.assistantId}:${assistantFlowToPlainText(nextFlow).length}:${appendResult.plainTextDelta.length}`,
            )
          }
          if (nextFlow !== event.assistantFlow) {
            appendObjectFlowLog(
              {
                event: 'assistant_flow_update',
                conversationId: frameQueuedDelta.conversationId,
                assistantId: frameQueuedDelta.assistantId,
                roundId: frameQueuedDelta.roundId ?? null,
                previousNodeCount: event.assistantFlow?.length ?? 0,
                nextNodeCount: nextFlow?.length ?? 0,
              },
              `flow-update:${frameQueuedDelta.assistantId}:${frameQueuedDelta.roundId ?? 'none'}:${event.assistantFlow?.length ?? 0}->${nextFlow?.length ?? 0}`,
            )
          }
          return { ...nextEvent, reasoning: nextReasoning || undefined, error: undefined }
        })
      })
    },
    [updateAssistantEvent, appendObjectFlowLog, flushQueuedAssistantStreamDelta],
  )

  const resetAssistantStreamOutput = useCallback(
    (conversationId: string, assistantId: string): void => {
      flushQueuedAssistantStreamDelta()
      updateAssistantEvent(conversationId, assistantId, (event) => {
        if (!event.rawText && !event.reasoning && (event.assistantFlow?.length ?? 0) === 0 && event.error === undefined) return event
        return { ...event, rawText: '', assistantFlow: undefined, reasoning: undefined, error: undefined }
      })
    },
    [flushQueuedAssistantStreamDelta, updateAssistantEvent],
  )

  // ── applyAssistantResult ─────────────────────────────────────────────────
  const applyAssistantResult = useCallback(
    (
      conversationId: string,
      assistantId: string,
      result: CompletionResult,
      promptMessages: ApiMessage[],
      options?: { resolvedText?: string; preserveRawText?: boolean; storedRawText?: string },
    ): void => {
      flushQueuedAssistantStreamDelta()
      const preserveRawText = options?.preserveRawText === true
      const extracted = preserveRawText ? { cleanedText: '', reasoning: '' } : extractThinkBlocks(result.text)
      const finalText = options?.resolvedText !== undefined ? options.resolvedText.trim() : extracted.cleanedText || result.text.trim()
      const finalReasoning = preserveRawText ? result.reasoning.trim() : [result.reasoning, extracted.reasoning].filter(Boolean).join('\n\n').trim()
      const usage = result.usage ?? estimateUsage(promptMessages, finalText)
      const usageEstimated = result.usage === undefined
      const { conversations, setConversations, draftsByConversation } = useChatStore.getState()
      setConversations(
        conversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation
          const nextTranscript = conversation.transcript.map((event) => {
            if (event.kind !== 'assistant_message' || event.id !== assistantId) return event
            const nextFlow = (event.assistantFlow?.length ?? 0) === 0
              ? createAssistantTextFlow(finalText, { createId })
              : event.assistantFlow
            const nextEvent = applyAssistantFlowState(event, nextFlow)
            return {
              ...nextEvent,
              rawText: options?.storedRawText ?? result.text,
              reasoning: finalReasoning || undefined,
              usage,
              usageEstimated,
              firstTokenLatencyMs: result.firstTokenLatencyMs,
              totalTimeMs: result.totalTimeMs,
              error: undefined,
            }
          })
          return withConversationRecordTranscript(conversation, nextTranscript, draftsByConversation[conversation.id] ?? '')
        }),
      )
    },
    [flushQueuedAssistantStreamDelta],
  )

  // ── buildTurnHistoryTranscript ───────────────────────────────────────────
  const buildTurnHistoryTranscript = useCallback(
    (conversationId: string, turnId: string): TranscriptEvent[] | null => {
      const conversation = useChatStore.getState().conversations.find((item) => item.id === conversationId) ?? null
      if (!conversation) return null
      const userEventIndex = conversation.transcript.findIndex((event) => event.kind === 'user_message' && event.turnId === turnId)
      if (userEventIndex < 0) return null
      return conversation.transcript.slice(0, userEventIndex + 1)
    },
    [],
  )

  // ── EXECUTE ASSISTANT TURN ──────────────────────────────────────────────
  const executeAssistantTurn = useCallback(
    async (
      conversationId: string,
      historyTranscript: TranscriptEvent[],
      turnId: string,
      responseMode: ConversationResponseMode,
      controller: AbortController,
    ): Promise<TurnExecutionOutcome> => {
      if (!ensureReadyToRequest()) return 'blocked'

      const settingsSnapshot = getActiveProviderRequestSettings()
      if (!settingsSnapshot) return 'blocked'

      const firstTokenHapticsEnabled = (settingsSnapshot as unknown as Record<string, unknown>).firstTokenHapticsEnabled as boolean | undefined
      let hasTriggeredFirstTokenHaptic = false
      const currentUserEvent = historyTranscript[historyTranscript.length - 1]
      const traceId = createId()
      let latestAssistantId: string | null = null
      let latestAssistantRawText = ''

      const store = useExtensionsStore.getState()
      const skillRecords = store.skillRecords
      const runtimeRecords = store.runtimeRecords

      appendSkillRoundLog({
        event: 'request_start',
        traceId,
        conversationId,
        turnId,
        model: settingsSnapshot.currentModel,
        responseMode,
        userInput: currentUserEvent?.kind === 'user_message' ? truncateDebugLogText(getUserTranscriptText(currentUserEvent)) : '',
      })

      type LiveRoundContext = {
        roundId: string
        skillTokenOrder: string[]
        skillKindByToken: Map<string, SkillStepKind>
        hasVisibleFlow: boolean
        markHasVisibleFlow: () => void
        resetTracking: () => void
      }

      const compactActionPreviewPayload = (payload: Record<string, unknown>): Record<string, unknown> =>
        Object.fromEntries(
          Object.entries(payload).filter(([, value]) => {
            if (value === undefined || value === null) return false
            if (typeof value === 'string') return value.trim().length > 0
            if (Array.isArray(value)) return value.length > 0
            if (isRecord(value)) return Object.keys(value).length > 0
            return true
          }),
        )

      const formatLiveActionPreview = (
        tag: SkillStepKind,
        preview: SkillActionStreamEvent['preview'],
        error?: string,
      ): string => {
        const previewRoot: InternalActionLocation | undefined =
          preview.root === 'skill' || preview.root === 'workspace' || preview.root === 'home' || preview.root === 'absolute'
            ? preview.root
            : undefined
        const effectivePath = preview.path !== undefined && previewRoot !== undefined
          ? buildEnvVarPath(previewRoot, preview.skill, preview.path)
          : undefined
        const payload = compactActionPreviewPayload({
          tag, id: preview.id,
          ...(effectivePath !== undefined ? { path: effectivePath } : {}),
          depth: preview.depth, startLine: preview.startLine, endLine: preview.endLine,
          command: preview.command, session: preview.session, waitMs: preview.waitMs,
          script: preview.script, argv: preview.argv, stdin: preview.stdin,
          env: preview.env, timeoutMs: preview.timeoutMs,
          createIfMissing: preview.createIfMissing, previewContextLines: preview.previewContextLines,
          edits: preview.edits, editCount: preview.editCount, error,
        })
        return formatStructuredMarkdown(payload)
      }

      const triggerFirstTokenHaptic = (): void => {
        if (!firstTokenHapticsEnabled || hasTriggeredFirstTokenHaptic) return
        hasTriggeredFirstTokenHaptic = true
        vibrateInteraction()
      }

      const patchRoundSkillNode = (
        roundContext: LiveRoundContext, assistantId: string, token: string,
        patch: {
          actionKind?: SkillStepKind; status?: 'running' | 'success' | 'error'
          root?: 'skill' | 'workspace' | 'home' | 'absolute'; skill?: string; path?: string
          depth?: number; startLine?: number; endLine?: number
          command?: string; session?: string; script?: string; error?: string; result?: string
        },
      ): void => {
        updateAssistantEvent(conversationId, assistantId, (event) => {
          const nextFlow = upsertAssistantFlowSkillNodeByToken(event.assistantFlow, token, patch, { createId, roundId: roundContext.roundId }).flow
          return applyAssistantFlowState(event, nextFlow)
        })
        if (!roundContext.skillKindByToken.has(token)) roundContext.skillTokenOrder.push(token)
        if (patch.actionKind) roundContext.skillKindByToken.set(token, patch.actionKind)
        appendObjectFlowLog(
          {
            event: 'assistant_flow_skill_patch', traceId, conversationId, assistantId, roundId: roundContext.roundId, token,
            patch: { ...patch, result: typeof patch.result === 'string' ? truncateDebugLogText(patch.result, 280) : patch.result, error: typeof patch.error === 'string' ? truncateDebugLogText(patch.error, 200) : patch.error },
          },
          `flow-skill-patch:${assistantId}:${roundContext.roundId}:${token}:${patch.status ?? ''}:${patch.skill ?? ''}:${patch.script ?? ''}`,
        )
      }

      const clearRoundState = (roundContext: LiveRoundContext, assistantId: string): void => {
        clearAssistantFlowRoundState(conversationId, assistantId, roundContext.roundId)
        roundContext.resetTracking()
      }

      const markRoundSkillsAsError = (roundContext: LiveRoundContext, assistantId: string, message: string): void => {
        updateAssistantFlow(conversationId, assistantId, (flow) => markAssistantFlowRoundError(flow, roundContext.roundId, message))
        appendObjectFlowLog(
          { event: 'assistant_flow_round_error', traceId, conversationId, assistantId, roundId: roundContext.roundId, error: truncateDebugLogText(message, 200) },
          `flow-round-error:${assistantId}:${roundContext.roundId}:${message}`,
        )
      }

      const requestModelCompletion = async (
        assistantId: string, promptMessages: ApiMessage[], options?: { mode?: 'plain' | 'tagged'; roundContext?: LiveRoundContext },
      ): Promise<CompletionResult> => {
        const mode = options?.mode ?? 'plain'
        const parseTags = mode === 'tagged'
        const roundContext = options?.roundContext
        const attemptLimit = Math.max(0, settingsSnapshot.maxModelRetryCount) + 1
        let lastError: unknown = null
        latestAssistantRawText = ''

        const applyStreamActionEvents = (events: SkillActionStreamEvent[]): void => {
          if (!roundContext) return
          for (const event of events) {
            const eventKind: SkillStepKind = event.tag
            roundContext.markHasVisibleFlow()
            const preview = event.preview
            patchRoundSkillNode(roundContext, assistantId, event.token, {
              actionKind: eventKind,
              status: event.type === 'close' && event.error ? 'error' : 'running',
              root: ((eventKind === 'read' || eventKind === 'edit') && (preview.root === 'skill' || preview.root === 'workspace' || preview.root === 'home' || preview.root === 'absolute')) || (eventKind === 'run' && (preview.root === 'skill' || preview.root === 'workspace' || preview.root === 'home' || preview.root === 'absolute')) ? preview.root : undefined,
              skill: typeof preview.skill === 'string' && preview.skill.trim() ? preview.skill : event.type === 'open' && (eventKind === 'skill_call' || (eventKind === 'run' && preview.root === 'skill') || preview.root === 'skill') ? '未命名技能' : undefined,
              path: (eventKind === 'read' || eventKind === 'edit') && typeof preview.path === 'string' ? preview.path : undefined,
              depth: eventKind === 'read' ? preview.depth : undefined,
              startLine: eventKind === 'read' ? preview.startLine : undefined,
              endLine: eventKind === 'read' ? preview.endLine : undefined,
              command: eventKind === 'run' && typeof preview.command === 'string' ? preview.command : undefined,
              session: eventKind === 'run' && typeof preview.session === 'string' ? preview.session : undefined,
              script: eventKind === 'skill_call' && typeof preview.script === 'string' ? preview.script : undefined,
              error: event.type === 'close' ? event.error : undefined,
              result: formatLiveActionPreview(eventKind, preview, event.error),
            })
          }
        }

        const replayNonStreamRound = (completion: CompletionResult): void => {
          if (!parseTags || !roundContext) return
          const parser = createAgentStreamParser()
          const firstDelta = parser.push(completion.text)
          const finalDelta = parser.flush()
          const content = `${firstDelta.content}${finalDelta.content}`
          const reasoning = `${firstDelta.reasoning}${finalDelta.reasoning}`
          if (content || reasoning) {
            roundContext.markHasVisibleFlow()
            appendAssistantStreamDelta(conversationId, assistantId, { content, reasoning, roundId: roundContext.roundId })
          }
          const events = [...firstDelta.actionEvents, ...finalDelta.actionEvents]
          if (events.length > 0) {
            flushQueuedAssistantStreamDelta()
            applyStreamActionEvents(events)
          }
        }

        for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
          if (attempt > 0) {
            if (roundContext) { clearRoundState(roundContext, assistantId) } else { resetAssistantStreamOutput(conversationId, assistantId) }
            latestAssistantRawText = ''
          }
          const streamParser = parseTags ? createAgentStreamParser() : null
          const flushStreamParser = (): void => {
            if (!streamParser) return
            const delta = streamParser.flush()
            if (delta.content || delta.reasoning) { roundContext?.markHasVisibleFlow(); appendAssistantStreamDelta(conversationId, assistantId, { content: delta.content, reasoning: delta.reasoning, roundId: roundContext?.roundId }) }
            if (delta.actionEvents.length > 0) { flushQueuedAssistantStreamDelta(); applyStreamActionEvents(delta.actionEvents) }
          }
          try {
            const completion = await requestStreamCompletion(settingsSnapshot, promptMessages, controller.signal, {
              onContent: (chunk) => {
                if (chunk.length > 0) triggerFirstTokenHaptic()
                latestAssistantRawText += chunk
                if (!streamParser) { appendAssistantStreamDelta(conversationId, assistantId, { content: chunk, roundId: roundContext?.roundId }); return }
                const delta = streamParser.push(chunk)
                if (delta.content || delta.reasoning) { roundContext?.markHasVisibleFlow(); appendAssistantStreamDelta(conversationId, assistantId, { content: delta.content, reasoning: delta.reasoning, roundId: roundContext?.roundId }) }
                if (delta.actionEvents.length > 0) { flushQueuedAssistantStreamDelta(); applyStreamActionEvents(delta.actionEvents) }
              },
              onReasoning: (chunk) => {
                if (chunk.length > 0) triggerFirstTokenHaptic()
                appendAssistantStreamDelta(conversationId, assistantId, { reasoning: chunk, roundId: roundContext?.roundId })
              },
            })
            flushStreamParser()
            flushQueuedAssistantStreamDelta()
            return completion
          } catch (streamError) {
            flushStreamParser()
            flushQueuedAssistantStreamDelta()
            if (streamError instanceof DOMException && streamError.name === 'AbortError') throw streamError
            try {
              if (roundContext) { clearRoundState(roundContext, assistantId) } else { resetAssistantStreamOutput(conversationId, assistantId) }
              const nonStreamCompletion = await requestNonStreamCompletion(settingsSnapshot, promptMessages, controller.signal)
              latestAssistantRawText = nonStreamCompletion.text
              replayNonStreamRound(nonStreamCompletion)
              flushQueuedAssistantStreamDelta()
              return nonStreamCompletion
            } catch (nonStreamError) {
              if (nonStreamError instanceof DOMException && nonStreamError.name === 'AbortError') throw nonStreamError
              lastError = nonStreamError
            }
          }
        }
        throw lastError instanceof Error ? lastError : new Error('模型调用失败')
      }

      const settingsState = useSettingsStore.getState().settings

      try {
        if (!currentUserEvent || currentUserEvent.kind !== 'user_message') throw new Error('当前对话无法定位本轮用户输入。')

        if (responseMode === 'text') {
          const promptMessages = buildApiMessagesFromTranscript(historyTranscript, settingsSnapshot.systemPrompt)
          appendSkillRoundLog({ event: 'round_input', traceId, round: 1, mode: 'plain-chat', promptMessages: normalizePromptMessagesForDebug(promptMessages) })
          const roundId = createId()
          const assistantId = createId()
          latestAssistantId = assistantId
          appendConversationTranscriptEvents(conversationId, [{ kind: 'assistant_message', id: assistantId, turnId, roundId, createdAt: Date.now(), rawText: '', reasoning: '', model: settingsSnapshot.currentModel }])
          const completion = await requestModelCompletion(assistantId, promptMessages, { mode: 'plain' })
          appendSkillRoundLog({ event: 'round_output', traceId, round: 1, mode: 'plain-chat', assistantText: truncateDebugLogText(completion.text), assistantReasoning: truncateDebugLogText(completion.reasoning ?? ''), usage: completion.usage ? { promptTokens: completion.usage.promptTokens, completionTokens: completion.usage.completionTokens, totalTokens: completion.usage.totalTokens } : undefined })
          applyAssistantResult(conversationId, assistantId, completion, promptMessages, { resolvedText: completion.text, preserveRawText: true })
          return 'completed'
        }

        const systemPrompt = await buildSkillAgentSystemPrompt(settingsSnapshot, skillRecords, runtimeRecords, conversationId, historyTranscript)
        const workingTranscript = [...historyTranscript]
        let finalCompletion: CompletionResult | null = null
        let finalCompletionDisplayText: string | undefined
        let executedRoundCount = 0
        let previousProgressFingerprint: string | null = null

        const appendHostMessage = (event: HostMessageTranscriptEvent, options?: { replacePreviousProtocolRetryReason?: string }): void => {
          const replacePreviousProtocolRetryReason = options?.replacePreviousProtocolRetryReason
          const lastEvent = workingTranscript[workingTranscript.length - 1]
          const shouldReplacePreviousProtocolRetry = replacePreviousProtocolRetryReason && lastEvent?.kind === 'host_message' && lastEvent.category === 'protocol_retry' && lastEvent.payload.reason === replacePreviousProtocolRetryReason
          if (shouldReplacePreviousProtocolRetry) { workingTranscript[workingTranscript.length - 1] = event; updateConversationTranscript(conversationId, [...workingTranscript]); return }
          appendConversationTranscriptEvents(conversationId, [event])
          workingTranscript.push(event)
        }

        const appendProtocolRetryMessage = (roundId: string, payload: { reason: string; prompt: string; displayText?: string; repairs?: unknown }): void => {
          appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'protocol_retry', payload }, { replacePreviousProtocolRetryReason: payload.reason })
        }

        for (let step = 0; ; step += 1) {
          if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')

          const promptMessages = buildApiMessagesFromTranscript(workingTranscript, systemPrompt)
          appendSkillRoundLog({ event: 'round_input', traceId, round: step + 1, mode: 'skill-agent', blockCount: workingTranscript.length, promptMessages: normalizePromptMessagesForDebug(promptMessages) })
          executedRoundCount = step + 1
          const roundId = createId()
          const assistantId = createId()
          latestAssistantId = assistantId
          appendConversationTranscriptEvents(conversationId, [{ kind: 'assistant_message', id: assistantId, turnId, roundId, createdAt: Date.now(), rawText: '', reasoning: '', model: settingsSnapshot.currentModel }])
          const roundContext: LiveRoundContext = { roundId, skillTokenOrder: [], skillKindByToken: new Map<string, SkillStepKind>(), hasVisibleFlow: false, markHasVisibleFlow: () => { roundContext.hasVisibleFlow = true }, resetTracking: () => { roundContext.skillTokenOrder.length = 0; roundContext.skillKindByToken.clear(); roundContext.hasVisibleFlow = false } }

          const completion = await requestModelCompletion(assistantId, promptMessages, { mode: 'tagged', roundContext })
          const protocolOutcome = normalizeSkillAgentProtocolResponse(completion.text)
          appendSkillRoundLog({
            event: 'round_output', traceId, round: step + 1, mode: 'skill-agent',
            assistantRaw: truncateDebugLogText(completion.text),
            assistantReasoning: truncateDebugLogText(completion.reasoning ?? ''),
            protocolKind: protocolOutcome.kind,
            assistantDisplayText: truncateDebugLogText(protocolOutcome.kind === 'final' ? protocolOutcome.finalText : protocolOutcome.displayText),
            repairs: protocolOutcome.repairs.map((repair) => repair.code),
            actions: protocolOutcome.kind === 'progress' ? protocolOutcome.actions.map((action) =>
              action.kind === 'read' ? { kind: action.kind, ...(action.path !== undefined ? { path: buildEnvVarPath(action.root, action.skill, action.path) } : {}), depth: action.depth, startLine: action.startLine, endLine: action.endLine }
              : action.kind === 'edit' ? { kind: action.kind, path: buildEnvVarPath(action.root, undefined, action.path), createIfMissing: action.createIfMissing, previewContextLines: action.previewContextLines, edits: action.edits }
              : action.kind === 'run' ? { kind: action.kind, id: action.id, command: action.command, session: action.session, waitMs: action.waitMs }
              : { kind: action.kind, id: action.id, skill: action.skill, script: action.script, argv: action.argv ?? [] },
            ) : [],
          })
          const roundDisplayText = protocolOutcome.kind === 'final' ? protocolOutcome.finalText : protocolOutcome.displayText
          const roundExplanation = roundDisplayText.trim()
          const storedRawText = protocolOutcome.kind === 'progress' || protocolOutcome.kind === 'final' ? protocolOutcome.normalizedEnvelope : ''
          const normalizedReasoning = [completion.reasoning, protocolOutcome.reasoningText].filter(Boolean).join('\n\n').trim()
          applyAssistantResult(conversationId, assistantId, completion, promptMessages, { resolvedText: roundDisplayText, storedRawText })

          workingTranscript.push({ kind: 'assistant_message', id: assistantId, turnId, roundId, createdAt: Date.now(), rawText: storedRawText, reasoning: normalizedReasoning || undefined, model: settingsSnapshot.currentModel, usage: completion.usage, firstTokenLatencyMs: completion.firstTokenLatencyMs, totalTimeMs: completion.totalTimeMs })

          if (roundContext.hasVisibleFlow) appendAssistantFlowRoundDivider(conversationId, assistantId, roundId, roundExplanation)

          if (protocolOutcome.kind === 'final') { finalCompletion = completion; finalCompletionDisplayText = protocolOutcome.finalText; break }

          if (protocolOutcome.kind === 'retry') {
            if (roundContext.skillTokenOrder.length > 0) markRoundSkillsAsError(roundContext, assistantId, protocolOutcome.retryPrompt)
            appendProtocolRetryMessage(roundId, { reason: protocolOutcome.retryReason, prompt: protocolOutcome.retryPrompt, displayText: protocolOutcome.displayText, repairs: protocolOutcome.repairs.map((repair) => repair.code) })
            previousProgressFingerprint = null; continue
          }

          if (protocolOutcome.normalizedEnvelope === previousProgressFingerprint) {
            appendProtocolRetryMessage(roundId, { reason: 'repeated_progress', prompt: '上一轮与本轮的 `<progress>` 请求完全相同，宿主不会重复执行。请基于最新的 host_message 结果继续推进，重发一条新的合法顶层回复。', displayText: protocolOutcome.displayText, repairs: protocolOutcome.repairs.map((repair) => repair.code) })
            previousProgressFingerprint = null; continue
          }

          previousProgressFingerprint = protocolOutcome.normalizedEnvelope

          for (let actionIndex = 0; actionIndex < protocolOutcome.actions.length; actionIndex += 1) {
            const action = protocolOutcome.actions[actionIndex]
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')

            if (action.kind === 'read') {
              const actionToken = roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-read-${actionIndex + 1}`
              const displayPath = resolveReadActionDisplayPath(action)
              patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'read', root: action.root, skill: action.skill, path: displayPath, depth: action.depth, startLine: action.startLine, endLine: action.endLine, status: 'running', error: undefined })
              try {
                const payload = await executeReadAction(action, conversationId)
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'read', status: 'success', error: undefined, result: formatSkillStepResult(serializeReadResultForHost(payload)) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'read_result', payload: { request: serializeReadActionForHost({ root: action.root, skill: action.skill, path: displayPath, depth: action.depth, startLine: action.startLine, endLine: action.endLine }), result: serializeReadResultForHost(payload) } })
              } catch (error) {
                const message = error instanceof Error ? error.message : '读取失败'
                const errorPayload = { ...(displayPath !== undefined ? { path: buildEnvVarPath(action.root, action.skill, displayPath) } : {}), depth: action.depth, startLine: action.startLine, endLine: action.endLine, error: message }
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'read', status: 'error', error: message, result: formatSkillStepResult(errorPayload) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'read_error', payload: { request: serializeReadActionForHost({ root: action.root, skill: action.skill, path: displayPath, depth: action.depth, startLine: action.startLine, endLine: action.endLine }), result: errorPayload } })
              }
              continue
            }

            if (action.kind === 'edit') {
              const actionToken = roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-edit-${actionIndex + 1}`
              patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'edit', root: action.root, path: action.path, status: 'running', error: undefined })
              try {
                const payload = await executeEditAction(action, conversationId)
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'edit', status: 'success', error: undefined, result: formatSkillStepResult(serializeEditResultForHost(payload)) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'edit_result', payload: { request: serializeEditActionForHost(action), result: serializeEditResultForHost(payload) } })
              } catch (error) {
                const message = error instanceof Error ? error.message : '编辑失败'
                const errorPayload = { ...serializeEditActionForHost(action), error: message }
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'edit', status: 'error', error: message, result: formatSkillStepResult(errorPayload) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'edit_error', payload: { request: serializeEditActionForHost(action), result: errorPayload } })
              }
              continue
            }

            if (action.kind === 'run') {
              const actionToken = roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-run-${actionIndex + 1}`
              const gatedAction = applyPermissionGatesToRun(action, settingsState.permissionToggles)
              let executableAction: RunAction
              try {
                executableAction = materializeRunAction(gatedAction)
              } catch (error) {
                const message = error instanceof Error ? error.message : 'run 执行失败'
                const errorPayload = { id: gatedAction.id, command: gatedAction.command, session: gatedAction.session, error: message }
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'run', root: gatedAction.root, skill: gatedAction.skill, command: gatedAction.command, session: gatedAction.session, status: 'error', error: message, result: formatSkillStepResult(errorPayload) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'run_error', payload: { request: serializeRunActionForHost(gatedAction), result: errorPayload } })
                continue
              }
              patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'run', root: executableAction.root, skill: executableAction.skill, command: executableAction.command, session: executableAction.session, status: 'running', error: undefined })
              try {
                const execution = await executeRunAction(executableAction, conversationId)
                const runPayload = { id: executableAction.id, command: executableAction.command, session: execution.session, running: execution.running, stdout: execution.stdout, stderr: execution.stderr, exitCode: execution.exitCode, elapsedMs: Math.round(execution.elapsedMs), waitedMs: execution.waitedMs, resolvedCommand: execution.resolvedCommand, resolvedCwd: execution.resolvedCwd, inferredRuntime: execution.inferredRuntime, pid: execution.pid, startedAt: execution.startedAt, updatedAt: execution.updatedAt, completedAt: execution.completedAt }
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'run', status: execution.running ? 'running' : execution.ok ? 'success' : 'error', error: execution.running ? undefined : execution.ok ? undefined : execution.stderr.trim() || `退出码 ${execution.exitCode}`, result: formatSkillStepResult(runPayload) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: execution.ok ? 'run_result' : 'run_error', payload: { request: serializeRunActionForHost(executableAction), result: runPayload } })
              } catch (error) {
                const message = error instanceof Error ? error.message : 'run 执行失败'
                const errorPayload = { id: executableAction.id, command: executableAction.command, session: executableAction.session, error: message }
                patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'run', status: 'error', error: message, result: formatSkillStepResult(errorPayload) })
                appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'run_error', payload: { request: serializeRunActionForHost(executableAction), result: errorPayload } })
              }
              continue
            }

            const actionToken = roundContext.skillTokenOrder[actionIndex] || `round-${roundId}-skill-call-${actionIndex + 1}`
            const executableSkillAction = applyPermissionGatesToSkillCall(action, settingsState.permissionToggles)
            patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'skill_call', skill: action.skill, script: action.script, status: 'running', error: undefined })
            try {
              const execution = await executeSkillCall(executableSkillAction, conversationId)
              const skillPayload = { ...parseActionExecutionPayload(executableSkillAction, execution.stdout, execution.stderr), exitCode: execution.exitCode, elapsedMs: Math.round(execution.elapsedMs), resolvedCommand: execution.resolvedCommand, inferredRuntime: execution.inferredRuntime }
              patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'skill_call', status: execution.ok ? 'success' : 'error', error: execution.ok ? undefined : execution.stderr.trim() || `退出码 ${execution.exitCode}`, result: formatSkillStepResult(skillPayload) })
              appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: execution.ok ? 'skill_result' : 'skill_error', payload: { request: executableSkillAction, result: skillPayload } })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'skill 执行失败'
              const errorPayload = { id: action.id, skill: action.skill, script: action.script, error: message }
              patchRoundSkillNode(roundContext, assistantId, actionToken, { actionKind: 'skill_call', status: 'error', error: message, result: formatSkillStepResult(errorPayload) })
              appendHostMessage({ kind: 'host_message', id: createId(), turnId, roundId, createdAt: Date.now(), category: 'skill_error', payload: { request: executableSkillAction, result: errorPayload } })
            }
          }
        }

        if (!finalCompletion) throw new Error('skill agent 未返回最终结果。')
        appendSkillRoundLog({ event: 'request_finalized', traceId, roundCount: executedRoundCount, finalAssistantText: truncateDebugLogText(finalCompletion.text), finalAssistantDisplayText: finalCompletionDisplayText !== undefined ? truncateDebugLogText(finalCompletionDisplayText) : undefined, finalReasoning: truncateDebugLogText(finalCompletion.reasoning ?? '') })
        return 'completed'
      } catch (error) {
        flushQueuedAssistantStreamDelta()
        appendSkillRoundLog({ event: 'request_error', traceId, aborted: error instanceof DOMException && error.name === 'AbortError', error: error instanceof Error ? truncateDebugLogText(error.message, 500) : '未知错误' })
        if (latestAssistantId) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            updateAssistantEvent(conversationId, latestAssistantId, (event) => ({ ...event, rawText: latestAssistantRawText, error: '已停止生成，可点击重生继续。' }))
          } else {
            const message = error instanceof Error ? error.message : '未知错误'
            updateAssistantEvent(conversationId, latestAssistantId, (event) => ({ ...event, rawText: latestAssistantRawText, error: `请求失败：${message}` }))
            pushNotice(`请求失败：${message}`, 'error')
          }
        }
        return error instanceof DOMException && error.name === 'AbortError' ? 'aborted' : 'failed'
      } finally {
        flushQueuedAssistantStreamDelta()
      }
    },
    [
      ensureReadyToRequest, getActiveProviderRequestSettings, appendSkillRoundLog, appendObjectFlowLog,
      updateAssistantEvent, appendConversationTranscriptEvents, appendAssistantStreamDelta,
      flushQueuedAssistantStreamDelta, appendAssistantFlowRoundDivider, clearAssistantFlowRoundState,
      updateAssistantFlow, resetAssistantStreamOutput, applyAssistantResult, updateConversationTranscript, pushNotice,
    ],
  )

  // ── Turn queue management ────────────────────────────────────────────────
  const processQueuedTurnExecutions = useCallback(async (): Promise<void> => {
    if (processingTurnQueueRef.current) return
    processingTurnQueueRef.current = true
    useUIStore.getState().setIsSending(true)
    try {
      for (;;) {
        const job = queuedTurnExecutionsRef.current.shift()
        if (!job) break
        const historyTranscript = job.historyTranscript ?? buildTurnHistoryTranscript(job.conversationId, job.turnId)
        if (!historyTranscript) { queuedTurnExecutionsRef.current = []; break }
        useUIStore.getState().setActiveRequestConversationId(job.conversationId)
        const controller = new AbortController()
        useChatStore.getState().setAbortController(controller)
        const outcome = await executeAssistantTurn(job.conversationId, historyTranscript, job.turnId, job.responseMode, controller)
        if (outcome !== 'completed') { queuedTurnExecutionsRef.current = []; break }
      }
    } finally {
      processingTurnQueueRef.current = false
      useUIStore.getState().setActiveRequestConversationId(null)
      const shouldRestart = queuedTurnExecutionsRef.current.length > 0
      if (!shouldRestart) useUIStore.getState().setIsSending(false)
      if (shouldRestart) void processQueuedTurnExecutions()
    }
  }, [buildTurnHistoryTranscript, executeAssistantTurn])

  const enqueueTurnExecution = useCallback((job: TurnExecutionJob): void => {
    queuedTurnExecutionsRef.current.push(job)
    if (processingTurnQueueRef.current) return
    void processQueuedTurnExecutions()
  }, [processQueuedTurnExecutions])

  const clearQueuedTurnExecutions = useCallback((): void => {
    queuedTurnExecutionsRef.current = []
  }, [])

  const stopGeneration = useCallback((): void => {
    clearQueuedTurnExecutions()
    useChatStore.getState().abortController?.abort()
  }, [clearQueuedTurnExecutions])

  // ── Handler functions ──────────────────────────────────────────────────

  const handleSend = useCallback(async (): Promise<void> => {
    if (!getCanSend()) return
    const conversation = getActiveConversation()
    if (!conversation) return
    const activeProviderRequestSettings = getActiveProviderRequestSettings()
    const activeConversationResponseMode = getActiveConversationResponseMode()
    const { draftsByConversation, pendingImages } = useChatStore.getState()
    const draft = draftsByConversation[conversation.id] ?? ''
    const trimmedDraft = draft.trim()

    // ── Debug command handling ──
    const normalizedDraftCommand = trimmedDraft.toLowerCase().replace(/\s+/g, '')
    const compactDraftCommand = normalizedDraftCommand.replace(/[^\w/:-]/g, '')
    const isDebugLogExportCommand =
      compactDraftCommand === '/debug-logs' || compactDraftCommand === 'debug-logs' || compactDraftCommand === 'debug_logs' ||
      compactDraftCommand === '/debug-log-export' || compactDraftCommand === 'debug-log-export' || compactDraftCommand === 'debug_log_export' ||
      compactDraftCommand === '/debug-log-dump' || compactDraftCommand === 'debug-log-dump' || compactDraftCommand === 'debug_log_dump'
    const isDebugLogClearCommand =
      compactDraftCommand === '/debug-clear-logs' || compactDraftCommand === 'debug-clear-logs' || compactDraftCommand === 'debug_clear_logs'
    const isObjectFlowDebugCommand =
      /debug[-_]?object[-_]?flow/i.test(trimmedDraft) || compactDraftCommand.includes('debug-object-flow') ||
      compactDraftCommand.includes('debug_object_flow') || compactDraftCommand.includes('/debug-object-flow') || compactDraftCommand.includes('/debug_object_flow')

    if (isDebugLogClearCommand) {
      clearDebugLogEntries(DEBUG_SKILL_ROUND_LOG_STORAGE_KEY)
      clearDebugLogEntries(DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY)
      lastSkillRoundLogKeyRef.current = ''
      lastObjectFlowLogKeyRef.current = ''
      const turnId = createId()
      appendConversationTranscriptEvents(conversation.id, [
        createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft)),
        createStaticAssistantEvent(turnId, '调试日志已清空。接下来可以运行真实 skill 测试，再用 /debug-log-export 导出两份日志。', activeProviderRequestSettings?.currentModel ?? 'debug-log'),
      ])
      resetComposerState(conversation.id)
      return
    }

    if (isDebugLogExportCommand) {
      const roundLogs = readDebugLogEntries(DEBUG_SKILL_ROUND_LOG_STORAGE_KEY)
      const objectLogs = readDebugLogEntries(DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY)
      const turnId = createId()
      appendConversationTranscriptEvents(conversation.id, [
        createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft)),
        createStaticAssistantEvent(turnId, buildDebugLogReportText(roundLogs, objectLogs), activeProviderRequestSettings?.currentModel ?? 'debug-log'),
      ])
      resetComposerState(conversation.id)
      return
    }

    if (isObjectFlowDebugCommand) {
      const turnId = createId()
      const userEvent = createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft))
      void [...conversation.transcript, userEvent]
      appendConversationTranscriptEvents(conversation.id, [userEvent])
      resetComposerState(conversation.id)
      // Inline object-flow debug scenario
      const assistantId = createId()
      appendConversationTranscriptEvents(conversation.id, [{ kind: 'assistant_message', id: assistantId, turnId, createdAt: Date.now(), rawText: '', model: activeProviderRequestSettings?.currentModel ?? 'debug-object-flow' }])
      useUIStore.getState().setIsSending(true)
      const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))
      try {
        const roundId = createId()
        const token = 'debug-skill-1'
        appendAssistantStreamDelta(conversation.id, assistantId, { content: '段落1（debug）\n\n', roundId })
        flushQueuedAssistantStreamDelta()
        await wait(120)
        appendAssistantStreamDelta(conversation.id, assistantId, { content: createSkillActionPlaceholder(token), roundId })
        flushQueuedAssistantStreamDelta()
        updateAssistantEvent(conversation.id, assistantId, (event) => {
          const nextFlow = upsertAssistantFlowSkillNodeByToken(event.assistantFlow, token, { actionKind: 'run', status: 'running', skill: 'device-info', script: 'scripts/get_device_info.internal', result: formatStructuredMarkdown({ stage: 'open', kind: 'run', skill: 'device-info', script: 'scripts/get_device_info.internal' }) }, { createId, roundId }).flow
          return applyAssistantFlowState(event, nextFlow)
        })
        await wait(120)
        appendAssistantStreamDelta(conversation.id, assistantId, { content: '\n\n段落2（debug）', roundId })
        flushQueuedAssistantStreamDelta()
        await wait(120)
        updateAssistantEvent(conversation.id, assistantId, (event) => {
          const nextFlow = upsertAssistantFlowSkillNodeByToken(event.assistantFlow, token, { actionKind: 'run', status: 'success', result: formatStructuredMarkdown({ stage: 'close', id: 'debug:run', skill: 'device-info', script: 'scripts/get_device_info.internal', exitCode: 0 }) }, { createId, roundId }).flow
          return applyAssistantFlowState(event, nextFlow)
        })
        appendAssistantFlowRoundDivider(conversation.id, assistantId, roundId)
        appendAssistantStreamDelta(conversation.id, assistantId, { content: '\n\n段落3（debug）' })
        flushQueuedAssistantStreamDelta()
      } finally {
        useUIStore.getState().setIsSending(false)
      }
      return
    }

    if (!ensureReadyToRequest()) return

    // ── Normal send path ──
    const outgoingImages = buildOutgoingImageAttachments(pendingImages)
    const turnId = createId()
    const userEvent = createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft, outgoingImages))
    const historyTranscript = [...conversation.transcript, userEvent]
    appendConversationTranscriptEvents(conversation.id, [userEvent])
    resetComposerState(conversation.id)
    enqueueTurnExecution({ conversationId: conversation.id, turnId, responseMode: activeConversationResponseMode, historyTranscript })
  }, [
    getCanSend, getActiveConversation, getActiveConversationResponseMode, getActiveProviderRequestSettings,
    ensureReadyToRequest, appendConversationTranscriptEvents, appendAssistantStreamDelta,
    flushQueuedAssistantStreamDelta, updateAssistantEvent, appendAssistantFlowRoundDivider,
    resetComposerState, enqueueTurnExecution, pushNotice,
  ])

  const handleAppend = useCallback((): void => {
    const conversation = getActiveConversation()
    const responseMode = getActiveConversationResponseMode()
    const isSending = useUIStore.getState().isSending
    const activeRequestId = useUIStore.getState().activeRequestConversationId
    const isRunningInActiveConversation = conversation !== null && activeRequestId !== null && conversation.id === activeRequestId

    if (!conversation || responseMode !== 'tool' || !isSending || !isRunningInActiveConversation) return

    const { draftsByConversation, pendingImages } = useChatStore.getState()
    const draft = draftsByConversation[conversation.id] ?? ''
    const trimmedDraft = draft.trim()
    const outgoingImages = buildOutgoingImageAttachments(pendingImages)
    if (!trimmedDraft && outgoingImages.length === 0) return

    const turnId = createId()
    const userEvent = createUserMessageTranscriptEvent(turnId, Date.now(), buildUserTranscriptContent(trimmedDraft, outgoingImages))
    appendConversationTranscriptEvents(conversation.id, [userEvent])
    resetComposerState(conversation.id)
    enqueueTurnExecution({ conversationId: conversation.id, turnId, responseMode })
  }, [getActiveConversation, getActiveConversationResponseMode, appendConversationTranscriptEvents, resetComposerState, enqueueTurnExecution])

  const handleImageSelect = useCallback(async (event: { target: { files: FileList | null } }): Promise<void> => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    try {
      const attachments = await createImageAttachments(files)
      const { pendingImages: existingPending, setPendingImages } = useChatStore.getState()
      const prepared: PendingImageAttachment[] = attachments.map((attachment) => ({ ...attachment, originalDataUrl: attachment.dataUrl, originalMimeType: attachment.mimeType, compressionRate: 0 }))
      setPendingImages([...existingPending, ...prepared])
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片读取失败'
      pushNotice(message, 'error')
    } finally {
      if ('value' in event.target) (event.target as HTMLInputElement).value = ''
    }
  }, [pushNotice])

  const cancelEdit = useCallback((): void => {
    useUIStore.getState().setEditingMessage(null)
    useUIStore.getState().setEditingText('')
  }, [])

  const regenerate = useCallback(async (assistantId: string): Promise<void> => {
    const conversation = getActiveConversation()
    const isSending = useUIStore.getState().isSending
    if (!conversation || isSending) { if (isSending) pushNotice('请先停止当前生成。', 'error'); return }
    const messages = projectConversationMessages(conversation)
    const target = messages.find((message) => message.id === assistantId && message.role === 'assistant')
    if (!target) return
    const userEventIndex = conversation.transcript.findIndex((event) => event.kind === 'user_message' && event.turnId === target.turnId)
    if (userEventIndex < 0) { pushNotice('无法定位该回答对应的用户输入。', 'error'); return }
    const historyTranscript = conversation.transcript.slice(0, userEventIndex + 1)
    updateConversationTranscript(conversation.id, historyTranscript)
    enqueueTurnExecution({ conversationId: conversation.id, turnId: target.turnId, responseMode: getActiveConversationResponseMode(), historyTranscript })
  }, [getActiveConversation, getActiveConversationResponseMode, updateConversationTranscript, enqueueTurnExecution, pushNotice])

  const copyMessageText = useCallback(async (text: string): Promise<void> => {
    const copied = await copyTextToClipboard(text)
    if (copied) pushNotice('已复制到剪贴板。', 'success')
    else pushNotice('复制失败，请检查剪贴板权限。', 'error')
  }, [copyTextToClipboard, pushNotice])

  // ── Return ─────────────────────────────────────────────────────────────
  return {
    executeAssistantTurn,
    handleSend,
    handleAppend,
    handleImageSelect,
    cancelEdit,
    regenerate,
    copyMessageText,
    enqueueTurnExecution,
    stopGeneration,
    processQueuedTurnExecutions,
    buildTurnHistoryTranscript,
    createStaticAssistantEvent,
    buildUserTranscriptContent,
    buildOutgoingImageAttachments,
    getUserTranscriptText,
    applyPermissionGatesToSkillCall,
    applyPermissionGatesToRun,
    formatSkillStepResult,
    resolveReadActionDisplayPath,
    parseActionExecutionPayload,
    buildSkillAgentSystemPrompt,
  }
}

export {
  createStaticAssistantEvent,
  buildUserTranscriptContent,
  buildOutgoingImageAttachments,
  getUserTranscriptText,
  applyPermissionGatesToSkillCall,
  applyPermissionGatesToRun,
  formatSkillStepResult,
  resolveReadActionDisplayPath,
  parseActionExecutionPayload,
  buildSkillAgentSystemPrompt,
}
