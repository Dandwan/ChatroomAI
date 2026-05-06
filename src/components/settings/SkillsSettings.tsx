import type { RefObject } from 'react'
import type { SkillRecord } from '../../services/skills/types'

interface SkillsSettingsProps {
  skillArchiveInputRef: RefObject<HTMLInputElement | null>
  isInstallingSkillArchive: boolean
  isLoadingExtensions: boolean
  skillRecords: SkillRecord[]
  onRefresh: () => void
  onSetEnabled: (id: string, enabled: boolean) => void
  onOpenConfig: (id: string) => void
  onDelete: (id: string) => void
}

export default function SkillsSettings({
  skillArchiveInputRef,
  isInstallingSkillArchive,
  isLoadingExtensions,
  skillRecords,
  onRefresh,
  onSetEnabled,
  onOpenConfig,
  onDelete,
}: SkillsSettingsProps) {
  return (
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
          <button type="button" onClick={() => void onRefresh()}>
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
              <article
                key={skill.id}
                className={`settings-entity-card ${skill.loadError ? 'is-load-error' : ''}`}
              >
                <div className="settings-entity-main">
                  <div className="settings-entity-title-row">
                    <strong>{skill.frontmatter.name || skill.id}</strong>
                    <div className="summary-bar">
                      <span>{skill.id}</span>
                      <span>{skill.source === 'builtin' ? '内置' : '外部'}</span>
                      <span>{skill.frontmatter.version ? `v${skill.frontmatter.version}` : '未标版本'}</span>
                      {skill.overrideBuiltin ? <span>覆盖内置</span> : null}
                      {skill.loadError ? <span>加载失败</span> : null}
                    </div>
                  </div>

                  <p className="summary-muted">{skill.frontmatter.description}</p>
                  {skill.loadError ? (
                    <p className="message-error">加载失败：{skill.loadError}</p>
                  ) : null}
                </div>

                <div className="settings-entity-actions">
                  <label
                    className={`toggle-row settings-inline-toggle ${
                      skill.loadError ? 'is-disabled' : ''
                    }`}
                  >
                    <span>启用</span>
                    <input
                      className="toggle-switch"
                      type="checkbox"
                      checked={skill.enabled}
                      disabled={Boolean(skill.loadError)}
                      onChange={(event) =>
                        void onSetEnabled(skill.id, event.target.checked)
                      }
                    />
                  </label>

                  <div className="settings-inline-buttons">
                    <button
                      type="button"
                      className="tiny-button"
                      disabled={Boolean(skill.loadError)}
                      onClick={() => void onOpenConfig(skill.id)}
                    >
                      配置
                    </button>
                    <button
                      type="button"
                      className="tiny-button danger-button"
                      onClick={() => onDelete(skill.id)}
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
}
