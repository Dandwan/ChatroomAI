import type { ChangeEvent } from 'react'
import type { SkillRecord } from '../../services/skills/types'
import ChatInputBox from '../ChatInputBox'
import SkillConfigJsonEditor, { type JsonObjectValue } from '../SkillConfigJsonEditor'

interface SkillConfigSettingsProps {
  skillConfigTarget: SkillRecord | null
  isLoadingSkillConfig: boolean
  skillConfigValue: JsonObjectValue
  skillConfigDraft: string
  skillConfigRawError: string | null
  isSavingSkillConfig: boolean
  onConfigValueChange: (value: JsonObjectValue) => void
  onDraftChange: (value: string) => void
  onFormat: () => void
  onSave: () => void
}

export default function SkillConfigSettings({
  skillConfigTarget,
  isLoadingSkillConfig,
  skillConfigValue,
  skillConfigDraft,
  skillConfigRawError,
  isSavingSkillConfig,
  onConfigValueChange,
  onDraftChange,
  onFormat,
  onSave,
}: SkillConfigSettingsProps) {
  return (
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
          <div className="skill-config-layout skill-config-loaded-content">
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

            <SkillConfigJsonEditor value={skillConfigValue} onChange={onConfigValueChange} />
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
          <div className="skill-config-loaded-content">
            <label className="field field-system-prompt skill-config-raw-field">
              <span>编辑后保存，运行时会通过环境变量回传给 skill。文本框会按内容自动调整高度。</span>
              <ChatInputBox
                className="settings-code-editor settings-chat-input settings-chat-input-card settings-chat-input-code skill-config-raw-editor"
                radiusMode="card"
                value={skillConfigDraft}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDraftChange(event.target.value)}
                placeholder={'{\n  "enabled": true\n}'}
                spellCheck={false}
                maxHeight={Math.max(420, Math.round(window.innerHeight * 0.62))}
              />
            </label>

            {skillConfigRawError ? (
              <p className="json-editor-error skill-config-raw-error">{skillConfigRawError}</p>
            ) : null}

            <div className="model-tools">
              <button type="button" onClick={onFormat}>
                格式化 JSON
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={isSavingSkillConfig || Boolean(skillConfigRawError)}
              >
                {isSavingSkillConfig ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        ) : (
          <p className="summary-muted">未找到目标 skill。</p>
        )}
      </section>
    </>
  )
}
