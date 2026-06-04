import type { AppSettings } from '../../state/types'

interface ProvidersSettingsProps {
  settings: AppSettings
  onAddProvider: () => void
  onEditProvider: (id: string) => void
  onDeleteProvider: (id: string) => void
  isCloudLoggedIn: boolean
  onCloudLogin: () => void
}

export default function ProvidersSettings({
  settings,
  onAddProvider,
  onEditProvider,
  onDeleteProvider,
  isCloudLoggedIn,
  onCloudLogin,
}: ProvidersSettingsProps) {
  return (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">其它服务商</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="model-tools">
          <button type="button" onClick={onAddProvider}>
            添加服务商
          </button>
        </div>

        {!isCloudLoggedIn && settings.providers.length > 0 ? (
          <div className="model-tools" style={{ marginTop: 10 }}>
            <button type="button" className="cloud-provider-login-btn" onClick={onCloudLogin}>
              ActiNet 登录
            </button>
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">已配置服务商</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entity-list">
          {settings.providers.length === 0 ? (
            <p className="summary-muted">暂无服务商，请先添加。</p>
          ) : (
            settings.providers.map((provider) => {
              const enabledCount = provider.models.filter((model) => model.enabled).length
              const isCurrent = provider.id === settings.currentProviderId
              return (
                <article key={provider.id} className="settings-entity-card">
                  <div className="settings-entity-main">
                    <div className="settings-entity-title-row">
                      <strong>{provider.name.trim() || '未命名服务商'}</strong>
                      <div className="summary-bar">
                        <span>{provider.models.length} 个模型</span>
                        <span>{enabledCount} 个启用</span>
                        {isCurrent ? <span>当前服务商</span> : null}
                        {isCurrent && settings.currentModel ? <span>{settings.currentModel}</span> : null}
                      </div>
                    </div>

                    <p className="summary-muted">
                      {provider.apiBaseUrl.trim() || '尚未填写 URL'}
                    </p>
                  </div>

                  <div className="settings-entity-actions">
                    <div className="settings-inline-buttons">
                      <button
                        type="button"
                        className="tiny-button"
                        onClick={() => onEditProvider(provider.id)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="tiny-button danger-button"
                        onClick={() => onDeleteProvider(provider.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>
    </>
  )
}
