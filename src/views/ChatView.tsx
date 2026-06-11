import { type ReactNode } from 'react'
import { useUIStore } from '../state/ui-store'
import type { AppSettings, ChatMessage, ProviderConfig } from '../state/types'
import type { AssistantFlowNode, AssistantFlowSkillNode } from '../utils/assistant-flow'
import {
  formatSkillStepTarget,
  formatSkillStepStatus,
} from '../utils/assistant-flow'
import { stripSkillParsingHintLines } from '../utils/text-utils'
import { formatMs } from '../utils/time-utils'
import { buildMessageImageViewerKey } from '../utils/app-images'
import { getEffectiveActiNetModels } from '../services/actinet-models'
import { ACTINET_PROVIDER_NAME } from '../utils/app-module'
import MarkdownMessage from '../components/MarkdownMessage'
import ChatInputBox from '../components/ChatInputBox'
import ThinkingPhrase from '../components/ThinkingPhrase'

export interface ChatViewProps {
  activeMessages: ChatMessage[]
  settings: AppSettings | null
  providers: ProviderConfig[]
  // Actions
  toggleReasoning: (messageId: string) => void
  toggleSkillResult: (stepId: string) => void
  copyMessageText: (text: string) => Promise<void>
  beginEdit: (message: ChatMessage) => void
  saveAssistantEdit: () => void
  saveUserEdit: (resend: boolean) => Promise<void>
  cancelEdit: () => void
  regenerate: (messageId: string) => Promise<void>
  openImageViewer: (key: string, image: { dataUrl: string; name: string }) => void
}

export function ChatView(props: ChatViewProps) {
  const {
    activeMessages,
    settings,
    providers,
    toggleReasoning,
    toggleSkillResult,
    copyMessageText,
    beginEdit,
    saveAssistantEdit,
    saveUserEdit,
    cancelEdit,
    regenerate,
    openImageViewer,
  } = props

  // Direct store reads for UI state (following E1 pattern)
  const editingMessageId = useUIStore((s) => s.editingMessageId)
  const editingText = useUIStore((s) => s.editingText)
  const setEditingText = useUIStore((s) => s.setEditingText)
  const openReasoningByMessage = useUIStore((s) => s.openReasoningByMessage)
  const openSkillResultByStep = useUIStore((s) => s.openSkillResultByStep)
  const showReasoning = settings?.showReasoning ?? false

  // ── Helper functions (lifted from inside map callback) ──

  const resolveEmptyResponseProvider = (message: ChatMessage): { isActiNet: boolean; providerName: string } => {
    const modelId = message.model
    if (modelId) {
      const actiNetModels = getEffectiveActiNetModels()
      if (actiNetModels.some((m) => m.id === modelId)) {
        return { isActiNet: true, providerName: ACTINET_PROVIDER_NAME }
      }
      for (const provider of providers) {
        if (provider.models.some((m) => m.id === modelId)) {
          return { isActiNet: false, providerName: provider.name }
        }
      }
    }
    return { isActiNet: true, providerName: ACTINET_PROVIDER_NAME }
  }

  const renderSkillStepEntry = (step: AssistantFlowSkillNode, key: string): ReactNode => {
    const hasResult = Boolean(step.result?.trim())
    const resultOpen = openSkillResultByStep[step.id] === true
    const targetLabel = formatSkillStepTarget(step)

    return (
      <div key={key} className="skill-step-entry">
        <div className={`skill-step-card is-${step.status}`}>
          <div className="skill-step-meta">
            <span className="skill-step-target" title={targetLabel}>
              {targetLabel}
            </span>
            <span className="skill-step-status">{formatSkillStepStatus(step.status)}</span>
          </div>
          {step.explanation ? (
            <div className="markdown-content skill-step-content">
              <MarkdownMessage text={step.explanation} />
            </div>
          ) : null}
          {hasResult ? (
            <section className={`skill-step-result-panel ${resultOpen ? 'is-open' : ''}`}>
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
          {step.error ? <p className="message-error skill-step-error">{step.error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <>
      {activeMessages.map((message) => {
        const editing = editingMessageId === message.id
        const textValue = message.text.trim()
        const hasReasoning = Boolean(message.reasoning?.trim())
        const assistantFlow: AssistantFlowNode[] = message.role === 'assistant' ? message.assistantFlow ?? [] : []
        const hasAssistantFlow = assistantFlow.length > 0
        const isAssistantLoading =
          message.role === 'assistant' && !message.error && !textValue && !hasAssistantFlow
        const displayTextSanitized =
          message.role === 'assistant' ? stripSkillParsingHintLines(textValue) : textValue
        const shouldRenderText =
          displayTextSanitized.length > 0 || (message.role === 'user' && !(message.images?.length ?? 0))
        const isMessageTrulyEmpty =
          message.role === 'assistant' &&
          !isAssistantLoading &&
          !textValue &&
          !hasReasoning &&
          !hasAssistantFlow &&
          !message.error

        return (
          <article key={message.id} className={`message-card ${message.role}`}>
            <div className="message-meta">
              {message.role === 'user' ? (
                <span>YOU</span>
              ) : (
                <span className="message-model">
                  Assistant · {message.model ?? '未标记模型'}
                </span>
              )}
            </div>

            {!editing && (message.images?.some((image) => image.dataUrl.trim().length > 0) ?? false) ? (
              <div className="image-grid">
                {message.images
                  ?.filter((image) => image.dataUrl.trim().length > 0)
                  .map((image) => (
                    <figure key={image.id} className="image-item">
                      <button
                        type="button"
                        className="image-item-button"
                        onClick={() => openImageViewer(buildMessageImageViewerKey(message.id, image.id), image)}
                        aria-label={`查看图片 ${image.name}`}
                      >
                        <img src={image.dataUrl} alt={image.name} />
                      </button>
                    </figure>
                  ))}
              </div>
            ) : null}

            {editing ? (
              <div className="editor">
                <ChatInputBox
                  className="chat-input-box composer-input editor-message-input"
                  radiusMode="card"
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  maxHeight={260}
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
                {showReasoning && hasReasoning ? (
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

                {isAssistantLoading ? <ThinkingPhrase createdAt={message.createdAt} /> : null}

                {message.role === 'assistant' && hasAssistantFlow ? (
                  <div className="assistant-inline-flow">
                    {assistantFlow.map((node, index) => {
                      if (node.kind === 'divider') {
                        return <div key={node.id} className="assistant-round-divider" aria-hidden="true" />
                      }

                      if (node.kind === 'text') {
                        const segmentText = stripSkillParsingHintLines(node.text)
                        if (!segmentText.trim()) {
                          return null
                        }
                        return (
                          <div key={node.id} className="markdown-content">
                            <MarkdownMessage text={segmentText} />
                          </div>
                        )
                      }

                      return renderSkillStepEntry(node as AssistantFlowSkillNode, `inline-step-${message.id}-${node.id}-${index}`)
                    })}
                  </div>
                ) : shouldRenderText ? (
                  <div className="markdown-content">
                    <MarkdownMessage text={displayTextSanitized} />
                  </div>
                ) : isMessageTrulyEmpty ? (() => {
                  const pi = resolveEmptyResponseProvider(message)
                  return (
                    <div className="empty-response-notice">
                      {pi.isActiNet ? (
                        <>似乎......没有任何响应<br />稍安勿躁，ActiNet服务将很快恢复，如有不便敬请谅解！</>
                      ) : (
                        <>似乎......没有任何响应<br />请检查{pi.providerName}服务商提供的服务是否正常。</>
                      )}
                    </div>
                  )
                })() : null}

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
                  <button
                    type="button"
                    className="message-action-button"
                    onClick={() => void copyMessageText(message.text)}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    className="message-action-button"
                    onClick={() => beginEdit(message)}
                  >
                    编辑
                  </button>
                  {message.role === 'assistant' ? (
                    <button
                      type="button"
                      className="message-action-button"
                      onClick={() => void regenerate(message.id)}
                    >
                      重试
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </article>
        )
      })}
    </>
  )
}
