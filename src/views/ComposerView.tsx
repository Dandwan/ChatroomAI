import { type ChangeEvent, type RefObject, type ReactNode } from 'react'
import { useUIStore } from '../state/ui-store'
import { useSettingsStore } from '../state/settings-store'
import type { AppSettings, Conversation, ConversationResponseMode, EnabledModelOption, Notice, PendingImageAttachment, SettingsView } from '../state/types'
import { buildHomepageModelTriggerLabel } from '../utils/app-formatting'
import { createProviderModelKey } from '../utils/model-utils'
import { buildPendingImageViewerKey } from '../utils/app-images'
import ChatInputBox from '../components/ChatInputBox'

// ── Inline type for enabledModelsByProvider (computed in App.tsx) ──
export interface EnabledModelsByProvider {
  providerId: string
  providerName: string
  models: { id: string; enabled: boolean }[]
}

// ── Model Picker Controls ──
export interface ComposerModelControls {
  openModelMenu: () => void
  closeModelMenu: () => void
  selectCurrentModel: (providerId: string, modelId: string) => void
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  openSettings: () => void
  navigateSettingsView: (view: SettingsView) => void
  updateConversationResponseMode: (conversationId: string, mode: ConversationResponseMode) => void
}

// ── Send / Composer Actions ──
export interface ComposerActions {
  handleSend: () => Promise<void>
  handleAppend: () => void
  stopGeneration: () => void
  handleImageSelect: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  handleScrollToBottomButtonClick: () => void
  pushNotice: (text: string, type?: Notice['type']) => void
  removePendingImage: (imageId: string) => void
  updatePendingImageCompression: (imageId: string, rate: number) => void
  updateConversationDraft: (conversationId: string, draft: string) => void
  openImageViewer: (key: string, image: { dataUrl: string; name: string }) => void
}

// ── Refs ──
export interface ComposerRefs {
  modelMenuRef: RefObject<HTMLDivElement | null>
  composerFooterRef: RefObject<HTMLElement | null>
  composerInputRef: RefObject<HTMLTextAreaElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  cameraInputRef: RefObject<HTMLInputElement | null>
}

export interface ComposerViewProps {
  // Conversation state
  draft: string
  activeConversation: Conversation | null
  activeConversationResponseMode: ConversationResponseMode
  activeConversationModeLocked: boolean
  isComposerLocked: boolean
  canSend: boolean
  canAppendWhileSending: boolean
  pendingImages: PendingImageAttachment[]

  // Computed model data
  enabledModelOptions: EnabledModelOption[]
  enabledModelsByProvider: EnabledModelsByProvider[]

  // UI state (from useChatUI)
  scrollToBottomButtonMounted: boolean
  scrollToBottomButtonVisible: boolean
  isSending: boolean

  // Grouped interfaces
  model: ComposerModelControls
  actions: ComposerActions
  refs: ComposerRefs
}

export function ComposerView(props: ComposerViewProps) {
  const {
    draft,
    activeConversation,
    activeConversationResponseMode,
    activeConversationModeLocked,
    isComposerLocked,
    canSend,
    canAppendWhileSending,
    pendingImages,
    enabledModelOptions,
    enabledModelsByProvider,
    scrollToBottomButtonMounted,
    scrollToBottomButtonVisible,
    isSending,
    model,
    actions,
    refs,
  } = props

  // Direct store reads (following E1 pattern)
  const settings = useSettingsStore((s) => s.settings)
  const modelMenuVisible = useUIStore((s) => s.modelMenuVisible)
  const modelMenuMounted = useUIStore((s) => s.modelMenuMounted)

  const renderComposerTools = ({ className = 'composer-tools' }: { className?: string } = {}): ReactNode => (
    <div className={className}>
      <div className="model-picker composer-model-picker homepage-model-picker" ref={refs.modelMenuRef}>
        <button
          type="button"
          className="model-trigger composer-model-trigger is-editorial-chat-shell"
          onClick={() => (modelMenuVisible ? model.closeModelMenu() : model.openModelMenu())}
        >
          <span className="model-trigger-label">
            {buildHomepageModelTriggerLabel(settings.currentModel, activeConversationResponseMode)}
          </span>
          <span className={`arrow ${modelMenuVisible ? 'open' : ''}`}>▾</span>
        </button>

        {modelMenuMounted ? (
          <div
            className={`model-popover composer-model-popover homepage-model-popover frosted-surface ${
              modelMenuVisible ? 'is-open' : 'is-closing'
            }`}
            style={{ top: 'auto', bottom: 'calc(100% + 8px)', transformOrigin: 'center bottom' }}
            onTransitionEnd={(event) => {
              if (!modelMenuVisible && event.target === event.currentTarget) {
                useUIStore.getState().setModelMenuVisibility(false, false)
              }
            }}
          >
            {enabledModelOptions.length === 0 ? (
              <div className="model-popover-empty">
                <p>暂无模型</p>
                <button
                  type="button"
                  className="tiny-button"
                  onClick={() => {
                    model.closeModelMenu()
                    model.openSettings()
                    model.navigateSettingsView('providers')
                  }}
                >
                  去设置
                </button>
              </div>
            ) : (
              enabledModelsByProvider.map((provider) => (
                <div key={provider.providerId} className="model-provider-group">
                  <div className="conversation-group-divider model-provider-divider">
                    <span className="conversation-group-label">{provider.providerName || '未命名服务商'}</span>
                    <span className="conversation-group-dash" aria-hidden="true" />
                  </div>

                  {provider.models.map((m: { id: string; enabled: boolean }) => (
                    <button
                      key={createProviderModelKey(provider.providerId, m.id)}
                      type="button"
                      className={`model-option ${
                        settings.currentProviderId === provider.providerId &&
                        settings.currentModel === m.id
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => {
                        model.selectCurrentModel(provider.providerId, m.id)
                        model.closeModelMenu()
                      }}
                    >
                      {m.id}
                    </button>
                  ))}
                </div>
              ))
            )}

            {enabledModelOptions.length > 0 ? (
              <div className="homepage-model-mode-footer">
                <span className="homepage-model-mode-label">Response mode</span>
                <div className="homepage-model-mode-actions" role="group" aria-label="选择首页响应模式">
                  <button
                    type="button"
                    className={`homepage-model-mode-button ${
                      activeConversationResponseMode === 'tool' ? 'active' : ''
                    }`}
                    disabled={activeConversationModeLocked || !activeConversation || isComposerLocked}
                    onClick={() => {
                      if (!activeConversation || activeConversationModeLocked || isComposerLocked) {
                        return
                      }
                      model.updateConversationResponseMode(activeConversation.id, 'tool')
                      model.updateSetting('defaultResponseMode', 'tool')
                      model.closeModelMenu()
                    }}
                  >
                    技能模式
                  </button>
                  <button
                    type="button"
                    className={`homepage-model-mode-button ${
                      activeConversationResponseMode === 'text' ? 'active' : ''
                    }`}
                    disabled={activeConversationModeLocked || !activeConversation || isComposerLocked}
                    onClick={() => {
                      if (!activeConversation || activeConversationModeLocked || isComposerLocked) {
                        return
                      }
                      model.updateConversationResponseMode(activeConversation.id, 'text')
                      model.updateSetting('defaultResponseMode', 'text')
                      model.closeModelMenu()
                    }}
                  >
                    文本模式
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="icon-button"
        aria-label="选择图片"
        disabled={isComposerLocked}
        onClick={() => refs.fileInputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8.8" cy="9.7" r="1.45" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.8 16.5l3.9-3.9a1.1 1.1 0 0 1 1.56 0l2 2a1.1 1.1 0 0 0 1.56 0l1.7-1.7a1.1 1.1 0 0 1 1.56 0l2.06 2.06" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        className="icon-button"
        aria-label="拍照"
        disabled={isComposerLocked}
        onClick={() => {
          if (isComposerLocked) {
            return
          }
          if (!settings.permissionToggles.camera) {
            actions.pushNotice('请先在权限设置中开启相机权限。', 'error')
            return
          }
          refs.cameraInputRef.current?.click()
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6.5 9.1 4.9h5.8L16 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
    </div>
  )

  return (
    <footer ref={refs.composerFooterRef} className="composer is-editorial-chat-shell">
      {scrollToBottomButtonMounted ? (
        <button
          type="button"
          className={`icon-button composer-scroll-bottom-button ${
            scrollToBottomButtonVisible ? 'is-open' : 'is-closing'
          }`}
          onClick={actions.handleScrollToBottomButtonClick}
          aria-label="回到底部"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5.5v11.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="m7.5 13.3 4.5 4.9 4.5-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}

      <div className="composer-panel">
        {pendingImages.length > 0 ? (
          <div className="pending-image-strip">
            {pendingImages.map((image) => (
              <div key={image.id} className="pending-image-item">
                <button
                  type="button"
                  className="pending-image-preview"
                  onClick={() => actions.openImageViewer(buildPendingImageViewerKey(image.id), image)}
                  aria-label={`查看图片 ${image.name}`}
                >
                  <img src={image.dataUrl} alt={image.name} />
                </button>
                <button
                  type="button"
                  className="pending-image-remove-button"
                  onClick={() => actions.removePendingImage(image.id)}
                  aria-label={`移除图片 ${image.name}`}
                >
                  ×
                </button>
                <div className="pending-image-controls">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={image.compressionRate}
                    onChange={(event) =>
                      actions.updatePendingImageCompression(image.id, Number(event.target.value))
                    }
                    aria-label={`压缩率 ${image.name}`}
                  />
                  <span>{image.compressionRate}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer-row">
          <ChatInputBox
            ref={refs.composerInputRef}
            className="chat-input-box composer-input"
            value={draft}
            onChange={(event) => {
              if (!activeConversation) {
                return
              }
              actions.updateConversationDraft(activeConversation.id, event.target.value)
            }}
            placeholder={isComposerLocked ? '请先等待历史对话载入完成' : '输入消息'}
            maxHeight={188}
            disabled={isComposerLocked}
          />

          {isSending ? (
            canAppendWhileSending ? (
              <button type="button" className="composer-send-button" onClick={actions.handleAppend}>
                追加
              </button>
            ) : (
              <button
                type="button"
                className="composer-send-button danger-button"
                onClick={actions.stopGeneration}
              >
                停止
              </button>
            )
          ) : (
            <button
              type="button"
              className="composer-send-button"
              disabled={!canSend}
              onClick={() => void actions.handleSend()}
            >
              发送
            </button>
          )}
        </div>

        {renderComposerTools()}
      </div>
    </footer>
  )
}
