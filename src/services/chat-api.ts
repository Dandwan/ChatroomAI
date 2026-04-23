interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  reasoningTokens?: number
}

export type ApiRole = 'system' | 'user' | 'assistant'
export type ApiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ApiContentPart[]
}

export interface RequestSettings {
  apiBaseUrl: string
  apiKey: string
  currentModel: string
  temperature: number
  topP: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
}

interface StreamCallbacks {
  onContent: (chunk: string) => void
  onReasoning: (chunk: string) => void
}

export interface CompletionResult {
  text: string
  reasoning: string
  usage?: TokenUsage
  firstTokenLatencyMs: number
  totalTimeMs: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '')

export const buildApiUrl = (baseUrl: string, path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`
}

export const authHeaders = (apiKey: string): HeadersInit => ({
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

export const normalizeUsage = (raw: unknown): TokenUsage | undefined => {
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

export const readErrorMessage = async (response: Response): Promise<string> => {
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

const buildCompletionPayload = (
  settings: RequestSettings,
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

export const requestStreamCompletion = async (
  settings: RequestSettings,
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

export const requestNonStreamCompletion = async (
  settings: RequestSettings,
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
